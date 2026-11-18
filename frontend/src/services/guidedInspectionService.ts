import type { Asset } from 'react-native-image-picker';
import { API_BASE_URL, authPost, request } from './api';
import { privatePhotoUpload } from './privatePhotoUpload';
export type Step = {
  id: string;
  room: string;
  instructions: string;
  count: number;
};
export type Photo = {
  id: string;
  step_id: string;
  slot: number;
  state: string;
};
export type GuidedInspection = {
  id: string;
  unit_id: string;
  unit: string;
  property: string;
  inspection_type: string;
  due_at: string;
  status: string;
  overdue: boolean;
  upcoming: boolean;
  revision: number;
  progress: number;
  required: number;
  steps: Step[];
  photos: Photo[];
  uploads: Photo[];
  baseline_available: boolean;
  baseline_photos: Photo[];
  history: { action: string; at: string; reason?: string }[];
  comparisons: {
    id: string;
    photo_id: string;
    status: string;
    decision: string | null;
    result: {
      summary: string;
      classification: string;
      severity: string | null;
      confidence: string;
      findings: unknown[];
    } | null;
    maintenance_id?: string;
    baseline_photo_id?: string;
    current_photo_id?: string;
  }[];
};
export type AssignmentOptions = {
  units: {
    id: string;
    label: string;
    property: string;
    tenants: { id: string; label: string }[];
  }[];
  templates: { id: string; name: string; version: number; steps: Step[] }[];
  default_steps: Step[];
};
const root = '/guided-inspections/';
export const listGuided = (before?: string) =>
  request<{ inspections: GuidedInspection[]; next: string | null }>(
    root + (before ? `?before=${encodeURIComponent(before)}` : ''),
  );
export const getGuided = async (id: string) =>
  (await request<{ inspection: GuidedInspection }>(`${root}${id}/`)).inspection;
export const getAssignmentOptions = () =>
  request<AssignmentOptions>(root + 'options/');
export const createTemplate = (name: string, steps: Step[]) =>
  authPost<{ id: string }>(root + 'templates/', { name, steps });
export const createAssignment = async (data: object) =>
  (await authPost<{ inspection: GuidedInspection }>(root, data)).inspection;
export const guidedAction = async (
  record: GuidedInspection,
  action: string,
  data: object = {},
) =>
  (
    await authPost<{ inspection: GuidedInspection }>(
      `${root}${record.id}/${action}/`,
      { revision: record.revision, ...data },
    )
  ).inspection;
export const guidedPhotoUrl = (id: string, photo: string, baseline = false) =>
  `${API_BASE_URL}${root}${id}/photos/${photo}/${
    baseline ? '?baseline=1' : ''
  }`;
export const guidedNotifications = () =>
  request<{
    notifications: {
      id: string;
      inspection_id: string;
      message: string;
      read: boolean;
      created_at: string;
    }[];
  }>(root + 'notifications/');
export const readNotification = (id: string) =>
  authPost(root + 'notifications/', { id });
export function uploadGuided(
  record: GuidedInspection,
  step: string,
  slot: number,
  asset: Asset,
  progress: (n: number) => void,
): Promise<GuidedInspection> {
  return privatePhotoUpload(
    `${root}${record.id}/photos/`,
    asset,
    { step_id: step, slot: String(slot), revision: String(record.revision) },
    'inspection',
    progress,
  );
}

export const createGuidedMaintenance = (id: string, comparison_id: string) =>
  authPost<{ maintenance_id: string }>(`${root}${id}/maintenance-draft/`, {
    comparison_id,
  });

export const comparisonPhotoUrl = (
  id: string,
  photo: string,
  comparison: string,
) =>
  `${API_BASE_URL}${root}${id}/photos/${photo}/?comparison=${encodeURIComponent(
    comparison,
  )}`;
