import { NativeModules, Platform } from 'react-native';
import config from './api.config.json';

function baseUrl(): string {
  if (!__DEV__) {
    return config.productionBaseUrl.replace(/\/$/, '');
  }
  if (config.developmentBaseUrl) {
    return config.developmentBaseUrl.replace(/\/$/, '');
  }
  // Physical devices use Metro's LAN host; simulators use their host loopback.
  const scriptURL = NativeModules.SourceCode?.scriptURL as string | undefined;
  const host = scriptURL ? new URL(scriptURL).hostname : '';
  const localHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  return `http://${
    host && host !== 'localhost' && host !== '127.0.0.1' ? host : localHost
  }:8000/api`;
}
export const API_BASE_URL = baseUrl();

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
  }
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (!API_BASE_URL || (!__DEV__ && !API_BASE_URL.startsWith('https://'))) {
    throw new ApiError(
      'The authentication server is not configured. Please contact the LeaseGuard team.',
    );
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort);
  if (options.signal?.aborted) {
    controller.abort();
  }
  const timer = setTimeout(abort, 15000);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const fallback =
        response.status === 403
          ? 'Your session expired. Please try again.'
          : response.status === 429
          ? 'Too many attempts. Try again in a minute.'
          : 'Unable to complete your request. Please try again.';
      throw new ApiError(
        typeof data?.detail === 'string' ? data.detail : fallback,
        response.status,
      );
    }
    if (!data || typeof data !== 'object') {
      throw new ApiError(
        'The server returned an unexpected response. Please try again.',
      );
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      controller.signal.aborted
        ? 'The request timed out. Please try again.'
        : 'Unable to reach LeaseGuard. Check your connection and try again.',
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}

export async function authPost<T>(
  path: string,
  data: object,
  signal?: AbortSignal,
): Promise<T> {
  const { csrfToken } = await request<{ csrfToken: string }>('/auth/csrf/', {
    signal,
  });
  if (!csrfToken) {
    throw new ApiError('Unable to start a secure session. Please try again.');
  }
  return request<T>(path, {
    method: 'POST',
    body: JSON.stringify(data),
    signal,
    headers: { 'X-CSRFToken': csrfToken },
  });
}
