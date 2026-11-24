import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text, View } from 'react-native';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { getSession, logout } from '../src/services/authService';
import { ApiError } from '../src/services/api';
import {
  currentFirebaseUser,
  signOutFirebase,
  subscribeToFirebaseAuth,
} from '../src/services/firebaseAuthService';
import { useAuthRequest } from '../src/utils/useAuthRequest';
import type { User } from '../src/types/user';

jest.mock('../src/services/authService', () => ({
  getSession: jest.fn(),
  logout: jest.fn(),
}));
jest.mock('../src/services/firebaseAuthService', () => ({
  currentFirebaseUser: jest.fn(),
  signOutFirebase: jest.fn(),
  subscribeToFirebaseAuth: jest.fn(),
}));

type NativeUser = { uid: string } | null;
let nativeUser: NativeUser = null;
let authListener: ((user: NativeUser) => void) | undefined;
let app: ReactTestRenderer;

function Probe() {
  const { user, checking, sessionError, refreshSession } = useAuth();
  return (
    <View>
      <Text>
        {user?.email ?? (checking ? 'checking' : sessionError || 'signed out')}
      </Text>
      <Text accessibilityLabel="Refresh session" onPress={refreshSession}>
        Refresh
      </Text>
      {sessionError ? <Text accessibilityLabel="Session error">{sessionError}</Text> : null}
    </View>
  );
}

function LogoutProbe() {
  const { user, signOut } = useAuth();
  const request = useAuthRequest();
  return user ? (
    <Text accessibilityLabel="Log out" onPress={() => request.run(signOut, () => {})}>
      Log out
    </Text>
  ) : (
    <Text accessibilityLabel="Login screen">Login screen</Text>
  );
}

const accountA: User = {
  id: '507f1f77bcf86cd799439011',
  email: 'a@example.com',
  name: 'Account A',
  role: 'tenant',
};
const accountB: User = {
  id: '507f1f77bcf86cd799439012',
  email: 'b@example.com',
  name: 'Account B',
  role: 'landlord',
};

beforeEach(async () => {
  jest.useFakeTimers();
  nativeUser = null;
  authListener = undefined;
  jest.mocked(currentFirebaseUser).mockImplementation(() => nativeUser as never);
  jest.mocked(signOutFirebase).mockResolvedValue(undefined);
  jest.mocked(logout).mockResolvedValue(undefined);
  jest.mocked(getSession).mockResolvedValue(null);
  jest.mocked(subscribeToFirebaseAuth).mockImplementation(callback => {
    authListener = callback as (user: NativeUser) => void;
    callback(null as never);
    return jest.fn();
  });
  await act(async () => {
    app = create(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
  });
});

afterEach(async () => {
  await act(async () => app.unmount());
  jest.useRealTimers();
  jest.clearAllMocks();
});

function renderedText() {
  return app.root.findAllByType(Text)[0].props.children as string;
}

it('clears Account A before switching and only restores Account B', async () => {
  jest.mocked(getSession).mockImplementation(async () =>
    nativeUser?.uid === 'firebase-b' ? accountB : accountA,
  );
  nativeUser = { uid: 'firebase-a' };
  await act(async () => {
    authListener?.(nativeUser);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(renderedText()).toBe(accountA.email);

  let finishB!: (user: User) => void;
  let finishLogout!: () => void;
  jest.mocked(getSession).mockImplementationOnce(
    () => new Promise(resolve => { finishB = resolve; }),
  );
  jest.mocked(logout).mockImplementationOnce(
    () => new Promise(resolve => { finishLogout = resolve; }),
  );
  const checksBeforeSwitch = jest.mocked(getSession).mock.calls.length;
  nativeUser = { uid: 'firebase-b' };
  await act(async () => {
    authListener?.(nativeUser);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(renderedText()).not.toBe(accountA.email);
  expect(logout).toHaveBeenCalled();
  expect(getSession).toHaveBeenCalledTimes(checksBeforeSwitch);

  await act(async () => finishLogout());
  expect(getSession).toHaveBeenCalledTimes(checksBeforeSwitch + 1);
  await act(async () => finishB(accountB));
  expect(renderedText()).toBe(accountB.email);
});

it('clears local account data even when Django logout fails', async () => {
  jest.mocked(getSession).mockResolvedValue(accountA);
  nativeUser = { uid: 'firebase-a' };
  await act(async () => {
    authListener?.(nativeUser);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(renderedText()).toBe(accountA.email);

  jest.mocked(logout).mockRejectedValueOnce(new Error('offline'));
  nativeUser = null;
  await act(async () => {
    authListener?.(null);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(renderedText()).toContain('could not confirm sign-out');
  expect(renderedText()).not.toBe(accountA.email);
  expect(logout).toHaveBeenCalled();
});

it('does not let the Settings unmount cancel the first successful logout request', async () => {
  await act(async () => app.unmount());
  jest.mocked(getSession).mockResolvedValue(accountA);
  nativeUser = null;
  jest.mocked(subscribeToFirebaseAuth).mockImplementation(callback => {
    authListener = callback as (user: NativeUser) => void;
    callback(null as never);
    return jest.fn();
  });
  await act(async () => {
    app = create(
      <AuthProvider>
        <LogoutProbe />
      </AuthProvider>,
    );
  });
  nativeUser = { uid: 'firebase-a' };
  await act(async () => {
    authListener?.(nativeUser);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(app.root.findByProps({ accessibilityLabel: 'Log out' })).toBeTruthy();

  let finishLogout!: () => void;
  jest.mocked(logout).mockImplementationOnce(
    () => new Promise(resolve => { finishLogout = resolve; }),
  );
  await act(async () => {
    app.root.findByProps({ accessibilityLabel: 'Log out' }).props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  // Clearing local auth unmounts the screen and aborts its request controller.
  // Logout is deliberately detached from that screen-owned signal.
  expect(logout).toHaveBeenCalledWith(undefined, 'firebase-a');
  expect(app.root.findByProps({ accessibilityLabel: 'Login screen' })).toBeTruthy();
  await act(async () => finishLogout());
  expect(signOutFirebase).toHaveBeenCalledTimes(1);
  expect(app.root.findAllByProps({ accessibilityLabel: 'Session error' })).toHaveLength(0);
});

it('preserves the mounted account through a temporary backend outage and restores it on retry', async () => {
  jest.mocked(getSession).mockResolvedValue(accountA);
  nativeUser = { uid: 'firebase-a' };
  await act(async () => {
    authListener?.(nativeUser);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(renderedText()).toBe(accountA.email);

  jest.mocked(getSession).mockRejectedValueOnce(
    new ApiError('Unable to reach LeaseGuard. Check your connection and try again.'),
  );
  await act(async () => {
    app.root.findByProps({ accessibilityLabel: 'Refresh session' }).props.onPress();
  });
  expect(renderedText()).toBe(accountA.email);
  expect(app.root.findByProps({ accessibilityLabel: 'Session error' }).props.children)
    .toContain('Unable to reach LeaseGuard');

  jest.mocked(getSession).mockResolvedValueOnce(accountA);
  await act(async () => {
    app.root.findByProps({ accessibilityLabel: 'Refresh session' }).props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(renderedText()).toBe(accountA.email);
  expect(app.root.findAllByProps({ accessibilityLabel: 'Session error' })).toHaveLength(0);
});
