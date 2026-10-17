import { ApiError, authPost, request } from './api';
import type { User, UserRole } from '../types/user';

export type ResetDelivery = 'email' | 'console';

export interface RegistrationDetails {
  role: UserRole;
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export async function register(
  details: RegistrationDetails,
  signal?: AbortSignal,
): Promise<User> {
  const result = await authPost<{ user: User }>(
    '/auth/register/',
    { ...details, name: details.name.trim(), email: details.email.trim() },
    signal,
  );
  if (!isUser(result.user) || result.user.role === null) {
    throw new ApiError(
      'The server did not confirm your account was created. Try signing in or resetting your password.',
    );
  }
  return result.user;
}

export async function login(
  email: string,
  password: string,
  signal?: AbortSignal,
): Promise<User> {
  const result = await authPost<{ user: User }>(
    '/auth/login/',
    { email: email.trim(), password },
    signal,
  );
  if (!isUser(result.user)) {
    throw new ApiError(
      'The server returned an invalid sign-in response. Please try again.',
    );
  }
  return result.user;
}

export async function requestPasswordReset(
  email: string,
  signal?: AbortSignal,
): Promise<ResetDelivery> {
  const result = await authPost<{ delivery: ResetDelivery }>(
    '/auth/password-reset/',
    { email: email.trim() },
    signal,
  );
  if (result.delivery !== 'email' && result.delivery !== 'console') {
    throw new ApiError(
      'The server did not confirm your reset request. Please try again.',
    );
  }
  return result.delivery;
}

export async function logout(signal?: AbortSignal): Promise<void> {
  await authPost('/auth/logout/', {}, signal);
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
  try {
    const result = await request<{ user: User }>('/auth/session/', { signal });
    if (!isUser(result.user)) {
      throw new ApiError(
        'The server returned an invalid session. Please sign in again.',
      );
    }
    return result.user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}
