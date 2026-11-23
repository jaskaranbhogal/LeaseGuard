import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import type { AuthCredential } from '@react-native-firebase/auth';
import {
  registerWithEmail,
  GoogleAccountConflictError,
  linkGoogleToEmailAccount,
  signInWithEmail,
  signInWithGoogle,
  signOutFirebase,
  firebaseErrorMessage,
} from '../src/services/firebaseAuthService';

const firebaseSdk = jest.requireMock('@react-native-firebase/auth');
const googleSdk = jest.requireMock('@react-native-google-signin/google-signin');
const mockFirebaseAuth = firebaseSdk.getAuth();
const mockFirebaseUser = { emailVerified: true };

beforeEach(() => jest.clearAllMocks());

it('uses Firebase email/password sign-in with a trimmed email', async () => {
  firebaseSdk.signInWithEmailAndPassword.mockResolvedValue({ user: mockFirebaseUser });
  await expect(signInWithEmail(' resident@example.com ', 'password'))
    .resolves.toBe(mockFirebaseUser);
  expect(firebaseSdk.signInWithEmailAndPassword).toHaveBeenCalledWith(
    mockFirebaseAuth, 'resident@example.com', 'password',
  );
});

it('creates an email account and sends verification', async () => {
  firebaseSdk.createUserWithEmailAndPassword.mockResolvedValue({ user: mockFirebaseUser });
  await expect(registerWithEmail('resident@example.com', 'password', 'Resident'))
    .resolves.toEqual({ user: mockFirebaseUser, profileUpdated: true, verificationSent: true });
  expect(firebaseSdk.updateProfile).toHaveBeenCalledWith(mockFirebaseUser, { displayName: 'Resident' });
  expect(firebaseSdk.sendEmailVerification).toHaveBeenCalledWith(mockFirebaseUser);
});

it('continues to a verification-pending state if email delivery fails', async () => {
  firebaseSdk.createUserWithEmailAndPassword.mockResolvedValue({ user: mockFirebaseUser });
  firebaseSdk.sendEmailVerification.mockRejectedValueOnce(new Error('offline'));
  await expect(registerWithEmail('resident@example.com', 'password', 'Resident'))
    .resolves.toEqual({ user: mockFirebaseUser, profileUpdated: true, verificationSent: false });
});

it('keeps registration successful and reports a failed profile update separately', async () => {
  firebaseSdk.createUserWithEmailAndPassword.mockResolvedValue({ user: mockFirebaseUser });
  firebaseSdk.updateProfile.mockRejectedValueOnce(new Error('private SDK details'));
  await expect(registerWithEmail('resident@example.com', 'password', 'Resident'))
    .resolves.toEqual({ user: mockFirebaseUser, profileUpdated: false, verificationSent: true });
  expect(firebaseSdk.sendEmailVerification).toHaveBeenCalledWith(mockFirebaseUser);
});

it('exchanges a Google ID token with Firebase and handles cancellation', async () => {
  googleSdk.GoogleSignin.signIn.mockResolvedValueOnce({
    type: 'success', data: {
      idToken: 'mock-google-id-token',
      user: { email: 'resident@example.com' },
    },
  });
  firebaseSdk.signInWithCredential.mockResolvedValue({ user: mockFirebaseUser });
  await expect(signInWithGoogle()).resolves.toBe(mockFirebaseUser);
  expect(firebaseSdk.GoogleAuthProvider.credential).toHaveBeenCalledWith('mock-google-id-token');
  expect(firebaseSdk.signInWithCredential).toHaveBeenCalledWith(
    mockFirebaseAuth, 'google-credential',
  );

  googleSdk.GoogleSignin.signIn.mockResolvedValueOnce({ type: 'cancelled', data: null });
  await expect(signInWithGoogle()).resolves.toBeNull();
  expect(statusCodes.SIGN_IN_CANCELLED).toBe('SIGN_IN_CANCELLED');
  expect(firebaseSdk.signInWithCredential).toHaveBeenCalledTimes(1);
});

it('reports missing Google OAuth configuration instead of accepting an incomplete token', async () => {
  googleSdk.GoogleSignin.signIn.mockResolvedValueOnce({
    type: 'success', data: { idToken: null },
  });
  await expect(signInWithGoogle()).rejects.toThrow('Web OAuth client ID');
});

it('hides unknown SDK error details and configures Google at initialization', () => {
  const sdkError = Object.assign(new Error('private SDK details'), { code: 'auth/internal-error' });
  expect(firebaseErrorMessage(sdkError)).toBe('Unable to sign in. Please try again.');

  jest.isolateModules(() => {
    require('../src/services/firebaseAuthService');
  });
  expect(GoogleSignin.configure).toHaveBeenCalledWith({ webClientId: '' });
});

it('requires the existing Firebase password before linking a Google provider', async () => {
  const conflict = Object.assign(new Error('provider conflict'), {
    code: 'auth/account-exists-with-different-credential',
  });
  googleSdk.GoogleSignin.signIn.mockResolvedValueOnce({
    type: 'success',
    data: { idToken: 'mock-google-id-token', user: { email: 'resident@example.com' } },
  });
  firebaseSdk.signInWithCredential.mockRejectedValueOnce(conflict);
  await expect(signInWithGoogle()).rejects.toBeInstanceOf(GoogleAccountConflictError);

  const existingUser = { email: 'resident@example.com' };
  const pendingCredential = { providerId: 'google.com' } as unknown as AuthCredential;
  firebaseSdk.signInWithEmailAndPassword.mockResolvedValueOnce({ user: existingUser });
  firebaseSdk.linkWithCredential.mockResolvedValueOnce({ user: existingUser });
  await expect(linkGoogleToEmailAccount(
    'resident@example.com', 'existing-password', pendingCredential, 'resident@example.com',
  )).resolves.toBe(existingUser);
  expect(firebaseSdk.linkWithCredential).toHaveBeenCalledWith(
    existingUser, pendingCredential,
  );
});

it('signs out of Firebase and clears the Google SDK session', async () => {
  await signOutFirebase();
  expect(firebaseSdk.signOut).toHaveBeenCalledWith(mockFirebaseAuth);
  expect(GoogleSignin.signOut).toHaveBeenCalled();
});
