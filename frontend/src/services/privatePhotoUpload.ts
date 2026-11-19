import type { Asset } from 'react-native-image-picker';
import { API_BASE_URL, ApiError, request } from './api';
import { normalizePhotoAsset } from './photoAsset';

/** Shared session/CSRF multipart transport. 100% transfer is not storage success. */
export async function privatePhotoUpload<T>(
  path: string,
  asset: Asset,
  fields: Record<string, string>,
  resultKey: string,
  progress: (value: number) => void,
): Promise<T> {
  if (!asset.uri || (!__DEV__ && !API_BASE_URL.startsWith('https://')))
    throw new ApiError('A valid photo and secure server are required.');
  const { csrfToken } = await request<{ csrfToken: string }>('/auth/csrf/');
  if (!csrfToken) throw new ApiError('Cannot verify your secure session.');
  const normalized = normalizePhotoAsset(asset);
  const form = new FormData();
  form.append('photo', {
    uri: normalized.uri,
    type: normalized.type || 'image/jpeg',
    name: normalized.fileName || 'photo.jpg',
  } as unknown as Blob);
  Object.entries(fields).forEach(([key, value]) => form.append(key, value));
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}${path}`);
    xhr.withCredentials = true;
    xhr.timeout = 65000;
    xhr.setRequestHeader('X-CSRFToken', csrfToken);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.upload.onprogress = event => {
      if (event.lengthComputable)
        progress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && data[resultKey])
          resolve(data[resultKey]);
        else
          reject(
            new ApiError(
              data.detail || 'Photo could not be saved. Refresh and retry.',
              xhr.status,
            ),
          );
      } catch {
        reject(
          new ApiError('Unexpected upload response. Refresh before retrying.'),
        );
      }
    };
    xhr.onerror = xhr.ontimeout = () =>
      reject(
        new ApiError(
          'Upload interrupted. Refresh; retry the same photo after 90 seconds if needed.',
        ),
      );
    xhr.send(form);
  });
}
