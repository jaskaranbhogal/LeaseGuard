import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Image, TextInput } from 'react-native';
import RootNavigator from '../src/navigation/RootNavigator';
import { AuthProvider } from '../src/context/AuthContext';
import type { AuthStackParamList } from '../src/navigation/types';
import LoginScreen from '../src/screens/auth/LoginScreen';
import RegisterScreen from '../src/screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../src/screens/auth/ForgotPasswordScreen';
import ResetEmailSentScreen from '../src/screens/auth/ResetEmailSentScreen';
import Button from '../src/components/Button';
import * as firebase from '../src/services/firebaseAuthService';
import ChooseYourRoleScreen from '../src/screens/auth/ChooseYourRoleScreen';
import * as auth from '../src/services/authService';
import { ApiError } from '../src/services/api';

jest.mock('../src/services/authService');
jest.mock('../src/services/firebaseAuthService', () => ({
  ...jest.requireActual('../src/services/firebaseAuthService'),
  signInWithEmail: jest.fn(),
  registerWithEmail: jest.fn(),
  sendPasswordReset: jest.fn(),
  refreshEmailVerification: jest.fn(),
}));
const login = jest.mocked(firebase.signInWithEmail);
const register = jest.mocked(firebase.registerWithEmail);
const verifiedUser = { emailVerified: true, getIdToken: jest.fn().mockResolvedValue('firebase-token') } as unknown as Awaited<ReturnType<typeof firebase.signInWithEmail>>;
const registrationResult = { user: verifiedUser, profileUpdated: true, verificationSent: true };
const reset = jest.mocked(auth.requestPasswordReset);
let app: ReactTestRenderer;
let navigation: ReturnType<
  typeof createNavigationContainerRef<AuthStackParamList>
>;

beforeEach(async () => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.mocked(auth.getSession).mockResolvedValue(null);
  navigation = createNavigationContainerRef<AuthStackParamList>();
  await act(async () => {
    app = create(
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer ref={navigation}>
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>,
    );
  });
  await act(async () => {
    app.root.findByType(Image).props.onLoadEnd();
  });
  await act(async () => {
    jest.advanceTimersByTime(1500);
  });
});
afterEach(async () => {
  await act(async () => {
    app.unmount();
  });
  jest.useRealTimers();
});
function screen() {
  return app.root.findByType(LoginScreen);
}
async function typeLogin(email: string, password: string) {
  await act(async () => {
    const fields = screen().findAllByType(TextInput);
    fields[0].props.onChangeText(email);
    fields[1].props.onChangeText(password);
  });
}
async function forgot(legacy = false) {
  await act(async () => {
    if (legacy) {
      screen().findAllByProps({ accessibilityLabel: 'Reset a legacy LeaseGuard password' })[0].props.onPress();
    } else {
      screen().findAllByProps({ accessibilityRole: 'link' })[0].props.onPress();
    }
  });
}

it('removes Loading from history and links to the existing Register route', async () => {
  expect(navigation.getRootState()!.routes.map(r => r.name)).toEqual(['Login']);
  await act(async () => {
    screen()
      .findAllByProps({ accessibilityLabel: 'Register' })[0]
      .props.onPress();
  });
  expect(navigation.getCurrentRoute()?.name).toBe('Register');
});
it('validates login without a request and uses secure password entry', async () => {
  await act(async () => {
    screen().findByType(Button).props.onPress();
  });
  expect(login).not.toHaveBeenCalled();
  expect(JSON.stringify(app.toJSON())).toContain('Enter your email address.');
  expect(JSON.stringify(app.toJSON())).toContain('Enter your password.');
  expect(screen().findAllByType(TextInput)[1].props.secureTextEntry).toBe(true);
});
it('passes credentials to the service and never treats a rejection as success', async () => {
  login.mockRejectedValue(new ApiError('Email or password is incorrect.', 401));
  await typeLogin('resident@example.com', 'incorrect');
  await act(async () => {
    screen().findByType(Button).props.onPress();
  });
  expect(login).toHaveBeenCalledWith(
    'resident@example.com',
    'incorrect',
  );
  expect(JSON.stringify(app.toJSON())).toContain(
    'Email or password is incorrect.',
  );
  expect(JSON.stringify(app.toJSON())).not.toContain('Signed in as');
});
it('acknowledges a legacy account without granting access to a role dashboard', async () => {
  login.mockResolvedValue(verifiedUser);
  jest.mocked(auth.synchronizeFirebaseUser).mockResolvedValue({
    id: '000000000000000000000001',
    email: 'resident@example.com',
    name: 'Resident',
    role: null,
  });
  await typeLogin('resident@example.com', 'test-fixture-only');
  await act(async () => {
    screen().findByType(Button).props.onPress();
  });
  expect(app.root.findAllByType(LoginScreen)).toHaveLength(0);
  expect(JSON.stringify(app.toJSON())).toContain('Account type not assigned');
  expect(JSON.stringify(app.toJSON())).not.toContain('Start inspection');
});
it('validates reset input and preserves request failures on the form', async () => {
  await forgot(true);
  const form = app.root.findByType(ForgotPasswordScreen);
  await act(async () => {
    form.findAllByType(Button)[0].props.onPress();
  });
  expect(reset).not.toHaveBeenCalled();
  await act(async () => {
    form.findByType(TextInput).props.onChangeText('person@example.com');
  });
  reset.mockRejectedValue(new ApiError('Unable to reach LeaseGuard.'));
  await act(async () => {
    form.findAllByType(Button)[0].props.onPress();
  });
  expect(navigation.getCurrentRoute()?.name).toBe('ForgotPassword');
  expect(JSON.stringify(app.toJSON())).toContain('Unable to reach LeaseGuard.');
});
it('blocks duplicate requests, confirms acceptance, and clears reset history', async () => {
  await typeLogin('person@example.com', '');
  await forgot(true);
  const form = app.root.findByType(ForgotPasswordScreen);
  expect(form.findByType(TextInput).props.value).toBe('person@example.com');
  let accept!: (value: auth.ResetDelivery) => void;
  reset.mockImplementation(
    () =>
      new Promise(resolve => {
        accept = resolve;
      }),
  );
  await act(async () => {
    form.findAllByType(Button)[0].props.onPress();
    form.findAllByType(Button)[0].props.onPress();
  });
  expect(reset).toHaveBeenCalledTimes(1);
  expect(form.findAllByType(Button)[0].props.loading).toBe(true);
  expect(navigation.getCurrentRoute()?.name).toBe('ForgotPassword');
  await act(async () => {
    accept('console');
  });
  expect(navigation.getCurrentRoute()?.params).toEqual({
    email: 'person@example.com',
    delivery: 'console',
  });
  expect(JSON.stringify(app.toJSON())).toContain('No email was sent.');
  await act(async () => {
    app.root
      .findByType(ResetEmailSentScreen)
      .findByType(Button)
      .props.onPress();
  });
  expect(navigation.getRootState()!.routes.map(r => r.name)).toEqual(['Login']);
});
it('returns from Forgot Password directly to Login', async () => {
  await forgot(true);
  await act(async () => {
    app.root
      .findByType(ForgotPasswordScreen)
      .findAllByType(Button)[1]
      .props.onPress();
  });
  expect(navigation.getRootState()!.routes.map(r => r.name)).toEqual(['Login']);
});
it('cancels requests when leaving the reset form', async () => {
  await forgot(true);
  const form = app.root.findByType(ForgotPasswordScreen);
  await act(async () => {
    form.findByType(TextInput).props.onChangeText('person@example.com');
  });
  let accept!: (value: auth.ResetDelivery) => void;
  reset.mockImplementation(
    () =>
      new Promise(resolve => {
        accept = resolve;
      }),
  );
  await act(async () => {
    form.findAllByType(Button)[0].props.onPress();
  });
  const signal = reset.mock.calls[0][1];
  await act(async () => {
    navigation.goBack();
  });
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    accept('email');
  });
  expect(navigation.getCurrentRoute()?.name).toBe('Login');
});

async function registrationForm() {
  await act(async () => {
    navigation.navigate('Register');
  });
  return app.root.findByType(RegisterScreen);
}
async function fillRegistration(
  form: ReturnType<typeof screen>,
  confirmation = 'Fresh-Passphrase-583!',
) {
  await act(async () => {
    const fields = form.findAllByType(TextInput);
    [
      'New Resident',
      'new@example.com',
      'Fresh-Passphrase-583!',
      confirmation,
    ].forEach((value, index) => fields[index].props.onChangeText(value));
  });
}
it('validates registration fields and confirmation before sending credentials', async () => {
  const form = await registrationForm();
  await act(async () => {
    form.findByType(Button).props.onPress();
  });
  expect(register).not.toHaveBeenCalled();
  expect(JSON.stringify(app.toJSON())).toContain('Enter your full name');
  await fillRegistration(form, 'mismatch');
  await act(async () => {
    form.findByType(Button).props.onPress();
  });
  expect(register).not.toHaveBeenCalled();
  expect(JSON.stringify(app.toJSON())).toContain('Passwords do not match.');
  expect(
    form
      .findAllByType(TextInput)
      .slice(2)
      .every(field => field.props.secureTextEntry),
  ).toBe(true);
});
it('keeps failed registrations editable and allows retry', async () => {
  const form = await registrationForm();
  await fillRegistration(form);
  register
    .mockRejectedValue(
      new ApiError('An account with this email already exists.', 409),
    );
  await act(async () => {
    form.findByType(Button).props.onPress();
  });
  expect(JSON.stringify(app.toJSON())).toContain(
    'An account with this email already exists.',
  );
  expect(form.findAllByType(TextInput)).toHaveLength(4);
  expect(form.findByType(Button).props.loading).toBe(false);
});
it('blocks duplicate registration and confirms creation before returning to sign in', async () => {
  const form = await registrationForm();
  await fillRegistration(form);
  let accept!: (value: typeof registrationResult) => void;
  register.mockImplementation(
    () =>
      new Promise(resolve => {
        accept = resolve;
      }),
  );
  await act(async () => {
    form.findByType(Button).props.onPress();
    form.findByType(Button).props.onPress();
  });
  expect(register).toHaveBeenCalledTimes(1);
  expect(
    form.findAllByType(TextInput).every(field => !field.props.editable),
  ).toBe(true);
  expect(register).toHaveBeenCalledWith(
    'new@example.com', 'Fresh-Passphrase-583!', 'New Resident',
  );
  await act(async () => accept(registrationResult));
  expect(JSON.stringify(app.toJSON())).toContain('We sent a verification link');
  await act(async () => app.root.findByProps({ accessibilityLabel: 'Sign in' }).props.onPress());
  expect(navigation.getRootState()!.routes.map(route => route.name)).toEqual([
    'Login',
  ]);
});
it('cancels registration on leaving the screen', async () => {
  const form = await registrationForm();
  await fillRegistration(form);
  let accept!: (value: typeof registrationResult) => void;
  register.mockImplementation(
    () =>
      new Promise(resolve => {
        accept = resolve;
      }),
  );
  await act(async () => {
    form.findByType(Button).props.onPress();
  });
  await act(async () => navigation.goBack());
  await act(async () => accept(registrationResult));
  expect(navigation.getCurrentRoute()?.name).toBe('Login');
});

it('requires email verification before choosing an account role', async () => {
  const form = await registrationForm();
  await fillRegistration(form);
  register.mockResolvedValueOnce(registrationResult);
  jest.mocked(firebase.refreshEmailVerification).mockResolvedValueOnce(null);
  await act(async () => form.findByType(Button).props.onPress());
  await act(async () => form.findAllByType(Button).find(button => button.props.title === 'I verified my email')!.props.onPress());
  expect(auth.synchronizeFirebaseUser).not.toHaveBeenCalled();
  expect(JSON.stringify(app.toJSON())).toContain('Your email is not verified yet');
});

it.each(['tenant', 'landlord'] as const)(
  'routes a verified Firebase account choosing %s to the existing navigator',
  async role => {
    const form = await registrationForm();
    await fillRegistration(form);
    register.mockResolvedValueOnce(registrationResult);
    jest.mocked(firebase.refreshEmailVerification).mockResolvedValueOnce(verifiedUser);
    const user = { id: '000000000000000000000014', name: 'New Resident', email: 'new@example.com' };
    jest.mocked(auth.synchronizeFirebaseUser).mockResolvedValueOnce({ ...user, role: null, canChooseRole: true });
    jest.mocked(auth.chooseRole).mockResolvedValueOnce({ ...user, role });
    await act(async () => form.findByType(Button).props.onPress());
    await act(async () => form.findAllByType(Button).find(button => button.props.title === 'I verified my email')!.props.onPress());
    const roleScreen = app.root.findByType(ChooseYourRoleScreen);
    await act(async () => roleScreen.findAllByProps({ accessibilityRole: 'radio' })
      .find(item => item.props.accessibilityLabel?.toLowerCase().startsWith(`i'm a ${role}`))!.props.onPress());
    await act(async () => roleScreen.findAllByProps({ accessibilityLabel: 'Continue' })[0].props.onPress());
    expect(auth.chooseRole).toHaveBeenCalledWith(role, expect.any(AbortSignal));
    expect(app.root.findAllByType(ChooseYourRoleScreen)).toHaveLength(0);
    expect(navigation.getCurrentRoute()?.name).toBe(role === 'tenant' ? 'Home' : 'Dashboard');
  },
);

it('sends a Firebase reset request from the default Forgot Password link', async () => {
  await typeLogin('person@example.com', '');
  await forgot();
  await act(async () => app.root.findByType(ForgotPasswordScreen).findAllByType(Button)[0].props.onPress());
  expect(firebase.sendPasswordReset).toHaveBeenCalledWith('person@example.com');
  expect(navigation.getCurrentRoute()?.name).toBe('ResetEmailSent');
});
