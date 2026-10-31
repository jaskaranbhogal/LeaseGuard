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
import Button from '../src/components/Button';
import * as auth from '../src/services/authService';

jest.mock('../src/services/authService');

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
  await act(async () => app.unmount());
  jest.useRealTimers();
});

function loginScreen() {
  return app.root.findByType(LoginScreen);
}

it('opens Login first and keeps Register and Forgot Password navigation', async () => {
  expect(navigation.getRootState()!.routes.map(route => route.name)).toEqual([
    'Login',
  ]);
  await act(async () => {
    loginScreen().findByProps({ accessibilityLabel: 'Register' }).props.onPress();
  });
  expect(navigation.getCurrentRoute()?.name).toBe('Register');
  expect(app.root.findByType(RegisterScreen)).toBeTruthy();
  await act(async () => {
    app.root.findByType(RegisterScreen)
      .findByProps({ accessibilityLabel: 'Sign in' }).props.onPress();
    loginScreen().findAllByProps({ accessibilityRole: 'link' })[0].props.onPress();
  });
  expect(navigation.getCurrentRoute()?.name).toBe('ForgotPassword');
  expect(app.root.findByType(ForgotPasswordScreen)).toBeTruthy();
});

it('preserves login validation while keeping email authentication unavailable', async () => {
  const button = loginScreen().findByType(Button);
  expect(button.props.disabled).toBe(true);
  await act(async () => button.props.onPress());
  expect(JSON.stringify(app.toJSON())).toContain('Enter your email address.');
  expect(JSON.stringify(app.toJSON())).toContain('Enter your password.');
  expect(JSON.stringify(app.toJSON())).toContain(
    'Email and password sign-in will be available when Firebase is connected.',
  );
  expect(auth.getSession).toHaveBeenCalled();
  expect(app.root.findAllByType(LoginScreen)).toHaveLength(1);
});

it('keeps the Google button design visible but disabled until Firebase is connected', () => {
  const google = loginScreen().findByProps({
    accessibilityLabel: 'Continue with Google',
  });
  expect(google.props.disabled).toBe(true);
  expect(google.props.accessibilityState.disabled).toBe(true);
  expect(JSON.stringify(app.toJSON())).toContain('Sign in with Google');
  expect(JSON.stringify(app.toJSON())).toContain(
    'Google sign-in will be available when Firebase is connected.',
  );
  expect(JSON.stringify(app.toJSON())).not.toContain('Apple');
});

it('keeps registration fields and validation while disabling account creation', async () => {
  await act(async () => {
    loginScreen().findByProps({ accessibilityLabel: 'Register' }).props.onPress();
  });
  const register = app.root.findByType(RegisterScreen);
  expect(register.findAllByType(TextInput)).toHaveLength(4);
  expect(register.findByType(Button).props.disabled).toBe(true);
  expect(JSON.stringify(app.toJSON())).toContain(
    'Account creation will be available when Firebase is connected.',
  );
});

it('keeps password reset navigation but does not claim to send a reset email', async () => {
  await act(async () => {
    loginScreen().findAllByProps({ accessibilityRole: 'link' })[0].props.onPress();
  });
  const reset = app.root.findByType(ForgotPasswordScreen);
  expect(reset.findAllByType(Button)[0].props.disabled).toBe(true);
  expect(JSON.stringify(app.toJSON())).toContain(
    'Password reset will be available when Firebase is connected.',
  );
  expect(navigation.getCurrentRoute()?.name).toBe('ForgotPassword');
});
