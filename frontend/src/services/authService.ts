import { ApiError, authPost, request } from './api';
import type { User, UserRole } from '../types/user';

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
