import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
  type AuthCredential,
} from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

// Set this to the Web OAuth client ID from Firebase Authentication's Google
// provider settings after that provider has been enabled for leaseguard-9141a.
const GOOGLE_WEB_CLIENT_ID = '';

GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

class AuthFlowError extends Error {}

export class GoogleAccountConflictError extends AuthFlowError {
  constructor(
    public readonly credential: AuthCredential,
    public readonly googleEmail?: string,
  ) {
    super('This Google email already has a LeaseGuard sign-in. Sign in with that account to link Google.');
  }
}

export function currentFirebaseUser(): User | null {
  return getAuth().currentUser;
}

export function subscribeToFirebaseAuth(
  callback: (user: User | null) => void,
) {
  return onAuthStateChanged(getAuth(), callback);
}

export async function signInWithEmail(email: string, password: string) {
  const result = await signInWithEmailAndPassword(getAuth(), email.trim(), password);
  return result.user;
}

export async function sendPasswordReset(email: string) {
  try {
    await firebaseSendPasswordResetEmail(getAuth(), email.trim());
  } catch (error) {
    // Keep the same user-facing outcome whether or not that address exists.
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';
    if (code !== 'auth/user-not-found') throw error;
  }
}

export async function registerWithEmail(email: string, password: string, displayName: string) {
  const result = await createUserWithEmailAndPassword(getAuth(), email.trim(), password);
  let profileUpdated = true;
  try {
    await updateProfile(result.user, { displayName: displayName.trim().slice(0, 150) });
  } catch {
    profileUpdated = false;
  }

  let verificationSent = true;
  try {
    await sendEmailVerification(result.user);
  } catch {
    verificationSent = false;
  }

  // Account creation succeeded. The screen reports each follow-up outcome and
  // lets the user retry verification email delivery.
  return { user: result.user, profileUpdated, verificationSent };
}

export async function resendVerificationEmail() {
  const user = getAuth().currentUser;
  if (!user || user.emailVerified) {
    throw new AuthFlowError('Sign in with the account that needs email verification.');
  }
  await sendEmailVerification(user);
}

export async function refreshEmailVerification() {
  const user = getAuth().currentUser;
  if (!user) {
    throw new AuthFlowError('Sign in again to check email verification.');
  }
  await reload(user);
  const refreshed = getAuth().currentUser;
  if (!refreshed?.emailVerified) {
    return null;
  }
  return refreshed;
}

export async function signInWithGoogle() {
  let pendingCredential: AuthCredential | null = null;
  let googleEmail: string | undefined;
  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false });
    }
    const response = await GoogleSignin.signIn();
    if (response.type === 'cancelled') {
      return null;
    }
    const idToken = response.data.idToken;
    if (!idToken) {
      throw new AuthFlowError(
        'Google Sign-In needs the Web OAuth client ID from the leaseguard-9141a Firebase project.',
      );
    }
    pendingCredential = GoogleAuthProvider.credential(idToken);
    googleEmail = response.data.user.email ?? undefined;
    return (await signInWithCredential(getAuth(), pendingCredential)).user;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === statusCodes.SIGN_IN_CANCELLED
    ) {
      return null;
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'auth/account-exists-with-different-credential' &&
      pendingCredential
    ) {
      throw new GoogleAccountConflictError(pendingCredential, googleEmail);
    }
    throw error;
  }
}

export async function linkGoogleToEmailAccount(
  email: string,
  password: string,
  credential: AuthCredential,
  googleEmail?: string,
) {
  const user = (await signInWithEmailAndPassword(getAuth(), email.trim(), password)).user;
  if (googleEmail && user.email?.toLowerCase() !== googleEmail.toLowerCase()) {
    await signOut(getAuth());
    throw new AuthFlowError('Sign in with the email address used for Google.');
  }
  return (await linkWithCredential(user, credential)).user;
}

export async function signOutFirebase() {
  await signOut(getAuth());
  await GoogleSignin.signOut().catch(() => undefined);
}

export function firebaseErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Unable to sign in. Please try again.';
  }
  if (error instanceof AuthFlowError) {
    return error.message;
  }
  if ('status' in error && typeof error.status === 'number') {
    // Django returns intentional user-facing details for authentication flows.
    return error.message;
  }
  const code = 'code' in error ? String(error.code) : '';
  const messages: Record<string, string> = {
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/user-not-found': 'Email or password is incorrect.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
    'auth/weak-password': 'Choose a stronger password with at least 8 characters.',
    'auth/network-request-failed': 'Unable to reach Firebase. Check your connection and try again.',
    'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase yet.',
    'auth/account-exists-with-different-credential': 'This email already uses another sign-in method. Sign in with that method, then link providers in account settings.',
  };
  return messages[code] ?? 'Unable to sign in. Please try again.';
}
