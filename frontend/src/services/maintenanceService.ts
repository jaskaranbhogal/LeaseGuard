import type { Asset } from 'react-native-image-picker';
import { API_BASE_URL, ApiError, authPost, request } from './api';
import { privatePhotoUpload } from './privatePhotoUpload';

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

export function uploadMaintenancePhoto(
  id: string,
  asset: Asset,
  progress: (value: number) => void,
): Promise<MaintenanceRequest> {
  return privatePhotoUpload(
    `/maintenance/${encodeURIComponent(id)}/photos/`,
    asset,
    {},
    'request',
    progress,
  );
}
