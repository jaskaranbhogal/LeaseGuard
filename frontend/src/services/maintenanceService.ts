import type { Asset } from 'react-native-image-picker';
import { API_BASE_URL, ApiError, authPost, request } from './api';
import { normalizePhotoAsset } from './photoAsset';

export type MaintenancePhoto = {
  id: string;
  state: 'ready' | 'failed' | 'uploading';
  available: boolean;
  retain_until: string;
};
export type MaintenanceRequest = {
  id: string;
  unit_id: string;
  property: string;
  unit: string;
  area: string;
  description: string;
  urgency: 'normal' | 'urgent';
  status: 'draft' | 'submitted' | 'in-review' | 'in-progress' | 'resolved';
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  photos: MaintenancePhoto[];
  history: Array<{ status: string; at: string; actor: string }>;
  comparison_available: boolean;
  comparison_limitation: string;
};
export type AssignedUnit = { id: string; label: string; property: string };
export type DraftFields = Pick<
  MaintenanceRequest,
  'area' | 'description' | 'urgency'
>;
export type MaintenancePage = {
  requests: MaintenanceRequest[];
  next: string | null;
};
export const listMaintenance = (before?: string) =>
  request<MaintenancePage>(
    `/maintenance/${before ? `?before=${encodeURIComponent(before)}` : ''}`,
  );
export const getMaintenance = async (id: string) =>
  (
    await request<{ request: MaintenanceRequest }>(
      `/maintenance/${encodeURIComponent(id)}/`,
    )
  ).request;
export const assignedUnits = async () =>
  (await request<{ units: AssignedUnit[] }>('/maintenance/units/')).units;
export const createDraft = async (
  unit_id: string,
  fields: DraftFields,
  idempotency_key: string,
) =>
  (
    await authPost<{ request: MaintenanceRequest }>('/maintenance/', {
      unit_id,
      ...fields,
      idempotency_key,
    })
  ).request;

async function mutate(
  path: string,
  method: 'PATCH' | 'DELETE',
  fields?: DraftFields,
) {
  const { csrfToken } = await request<{ csrfToken: string }>('/auth/csrf/');
  if (!csrfToken) throw new ApiError('Cannot verify your secure session.');
  return (
    await request<{ request: MaintenanceRequest }>(path, {
      method,
      headers: { 'X-CSRFToken': csrfToken },
      ...(fields ? { body: JSON.stringify(fields) } : {}),
    })
  ).request;
}
export const saveDraft = (id: string, fields: DraftFields) =>
  mutate(`/maintenance/${encodeURIComponent(id)}/`, 'PATCH', fields);
export const removePhoto = (id: string, photo: string) =>
  mutate(
    `/maintenance/${encodeURIComponent(id)}/photos/${encodeURIComponent(
      photo,
    )}/`,
    'DELETE',
  );
export const submitMaintenance = async (id: string) =>
  (
    await authPost<{ request: MaintenanceRequest }>(
      `/maintenance/${encodeURIComponent(id)}/submit/`,
      {},
    )
  ).request;
export const updateMaintenanceStatus = async (id: string, status: string) =>
  (
    await authPost<{ request: MaintenanceRequest }>(
      `/maintenance/${encodeURIComponent(id)}/status/`,
      { status },
    )
  ).request;
export const maintenancePhotoUrl = (id: string, photo: string) =>
  `${API_BASE_URL}/maintenance/${encodeURIComponent(
    id,
  )}/photos/${encodeURIComponent(photo)}/`;

export async function uploadMaintenancePhoto(
  id: string,
  asset: Asset,
  progress: (value: number) => void,
): Promise<MaintenanceRequest> {
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
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      'POST',
      `${API_BASE_URL}/maintenance/${encodeURIComponent(id)}/photos/`,
    );
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
        if (xhr.status >= 200 && xhr.status < 300 && data.request)
          resolve(data.request);
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
          'Upload interrupted. Refresh; retry the same photo after a minute if needed.',
        ),
      );
    xhr.send(form);
  });
}
