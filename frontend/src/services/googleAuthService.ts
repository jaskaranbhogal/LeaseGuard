import { authorize } from 'react-native-app-auth';
import { Platform } from 'react-native';
import config from './api.config.json';
import { ApiError, authPost } from './api';
import type { User, UserRole } from '../types/user';

const GOOGLE_ISSUER = 'https://accounts.google.com';

export async function signInWithGoogle(role: UserRole): Promise<User | null> {
  const clientId = Platform.OS === 'ios'
    ? config.googleIosClientId
    : config.googleAndroidClientId;
  const redirectScheme = Platform.OS === 'ios'
    ? config.googleIosRedirectScheme
    : config.googleAndroidRedirectScheme;
  if (!clientId || !redirectScheme) {
    throw new ApiError('Google Sign-In is not configured yet. Please use email and password.');
  }

  const { nonce } = await authPost<{ nonce: string }>('/auth/google/nonce/', {});
  if (!nonce) {
    throw new ApiError('Unable to start Google Sign-In. Please try again.');
  }
  let result;
  try {
    result = await authorize({
    issuer: GOOGLE_ISSUER,
    clientId,
    redirectUrl: `${redirectScheme}:/oauth2redirect/google`,
    scopes: ['openid', 'email', 'profile'],
    additionalParameters: { nonce },
    });
  } catch (error) {
    if ((error as { code?: string })?.code === 'user_canceled_authorization') {
      return null;
    }
    throw error;
  }
  if (!result.idToken) {
    throw new ApiError('Google did not return a verified identity. Please try again.');
  }
  const response = await authPost<{ user: User }>('/auth/google/', {
    idToken: result.idToken,
    nonce,
    role,
  });
  if (!response.user) {
    throw new ApiError('LeaseGuard could not finish Google sign-in. Please try again.');
  }
  return response.user;
}
