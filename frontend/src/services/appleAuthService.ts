import { appleAuth } from '@invertase/react-native-apple-authentication';
import { Platform } from 'react-native';
import { ApiError, authPost } from './api';
import type { User } from '../types/user';

export async function signInWithApple(
  signal?: AbortSignal,
): Promise<User | null> {
  if (Platform.OS !== 'ios' || !appleAuth.isSupported) {
    throw new ApiError(
      'Apple Sign-In is available on supported Apple devices.',
    );
  }

  const { nonce } = await authPost<{ nonce: string }>(
    '/auth/apple/nonce/',
    {},
    signal,
  );
  if (!nonce) {
    throw new ApiError('Unable to start Apple Sign-In. Please try again.');
  }

  let credentials;
  try {
    credentials = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      nonce,
    });
  } catch (error) {
    if ((error as { code?: string })?.code === appleAuth.Error.CANCELED) {
      return null;
    }
    throw error;
  }

  if (!credentials.identityToken) {
    throw new ApiError(
      'Apple did not return a verified identity. Please try again.',
    );
  }
  const name = [
    credentials.fullName?.givenName,
    credentials.fullName?.middleName,
    credentials.fullName?.familyName,
  ]
    .filter(Boolean)
    .join(' ');
  const response = await authPost<{ user: User }>(
    '/auth/apple/',
    { identityToken: credentials.identityToken, name },
    signal,
  );
  if (!response.user) {
    throw new ApiError(
      'LeaseGuard could not finish Apple Sign-In. Please try again.',
    );
  }
  return response.user;
}
