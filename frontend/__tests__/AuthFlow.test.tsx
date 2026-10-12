import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Image, TextInput } from 'react-native';
import AuthNavigator from '../src/navigation/AuthNavigator';
import type { AuthStackParamList } from '../src/navigation/types';
import LoginScreen from '../src/screens/auth/LoginScreen';
import ForgotPasswordScreen from '../src/screens/auth/ForgotPasswordScreen';
import ResetEmailSentScreen from '../src/screens/auth/ResetEmailSentScreen';
import Button from '../src/components/Button';
import * as auth from '../src/services/authService';
import { ApiError } from '../src/services/api';

jest.mock('../src/services/authService');
const login = jest.mocked(auth.login);
const reset = jest.mocked(auth.requestPasswordReset);
let app: ReactTestRenderer;
let navigation: ReturnType<
  typeof createNavigationContainerRef<AuthStackParamList>
>;

beforeEach(async () => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  navigation = createNavigationContainerRef<AuthStackParamList>();
  await act(async () => {
    app = create(
      <SafeAreaProvider>
        <NavigationContainer ref={navigation}>
          <AuthNavigator />
        </NavigationContainer>
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
async function forgot() {
  await act(async () => {
    screen().findAllByProps({ accessibilityRole: 'link' })[0].props.onPress();
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
  login.mockRejectedValue(new ApiError('Email or password is incorrect.'));
  await typeLogin('resident@example.com', 'incorrect');
  await act(async () => {
    screen().findByType(Button).props.onPress();
  });
  expect(login).toHaveBeenCalledWith(
    'resident@example.com',
    'incorrect',
    expect.any(AbortSignal),
  );
  expect(JSON.stringify(app.toJSON())).toContain(
    'Email or password is incorrect.',
  );
  expect(JSON.stringify(app.toJSON())).not.toContain('Signed in as');
});
it('acknowledges an authenticated account without opening an unfinished dashboard', async () => {
  login.mockResolvedValue({
    id: 1,
    email: 'resident@example.com',
    name: 'Resident',
  });
  await typeLogin('resident@example.com', 'test-fixture-only');
  await act(async () => {
    screen().findByType(Button).props.onPress();
  });
  expect(JSON.stringify(app.toJSON())).toContain('Signed in as');
  expect(screen().findAllByType(TextInput)).toHaveLength(0);
  expect(navigation.getCurrentRoute()?.name).toBe('Login');
});
it('validates reset input and preserves request failures on the form', async () => {
  await forgot();
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
  await forgot();
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
  await forgot();
  await act(async () => {
    app.root
      .findByType(ForgotPasswordScreen)
      .findAllByType(Button)[1]
      .props.onPress();
  });
  expect(navigation.getRootState()!.routes.map(r => r.name)).toEqual(['Login']);
});
it('cancels requests when leaving the reset form', async () => {
  await forgot();
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
