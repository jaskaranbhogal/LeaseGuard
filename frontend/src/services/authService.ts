import { ApiError, authPost } from './api';
import type { User } from '../types/user';

export type ResetDelivery = 'email' | 'console';

export interface RegistrationDetails {
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
  if (!result.user?.id || typeof result.user.email !== 'string') {
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
  if (!result.user?.id || typeof result.user.email !== 'string') {
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
