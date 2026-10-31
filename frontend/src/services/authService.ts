import { ApiError, authPost } from './api';
import type { User, UserRole } from '../types/user';
import { currentFirebaseUser } from './firebaseAuthService';

export async function chooseRole(
  role: UserRole,
  signal?: AbortSignal,
): Promise<User> {
  const result = await authPost<{ user: User }>(
    '/auth/role/',
    { role },
    signal,
  );
  if (!isUser(result.user) || result.user.role !== role) {
    throw new ApiError(
      'LeaseGuard could not save your account type. Please try again.',
    );
  }
  return result.user;
}

export async function logout(signal?: AbortSignal): Promise<void> {
  await authPost('/auth/logout/', {}, signal);
}

export async function synchronizeFirebaseUser(
  idToken: string,
  signal?: AbortSignal,
): Promise<User> {
  const result = await authPost<{ user: User }>(
    '/auth/firebase/session/',
    { idToken },
    signal,
  );
  if (!isUser(result.user)) {
    throw new ApiError('LeaseGuard could not load your account. Please try again.');
  }
  return result.user;
}

export async function linkLegacyAccount(
  idToken: string,
  legacyPassword: string,
  signal?: AbortSignal,
): Promise<User> {
  const result = await authPost<{ user: User }>(
    '/auth/firebase/link/',
    { idToken, legacyPassword },
    signal,
  );
  if (!isUser(result.user)) {
    throw new ApiError('LeaseGuard could not link your account. Please try again.');
  }
  return result.user;
}

function isUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const user = value as Partial<User>;
  return (
    typeof user.id === 'number' &&
    user.id > 0 &&
    typeof user.email === 'string' &&
    typeof user.name === 'string' &&
    (user.role === 'tenant' || user.role === 'landlord' || user.role === null)
  );
}

export async function getSession(signal?: AbortSignal): Promise<User | null> {
  const firebaseUser = currentFirebaseUser();
  if (!firebaseUser || (!firebaseUser.emailVerified && firebaseUser.providerData.some(provider => provider.providerId === 'password'))) {
    return null;
  }
  try {
    return await synchronizeFirebaseUser(await firebaseUser.getIdToken(), signal);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}
