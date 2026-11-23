import type { Asset } from 'react-native-image-picker';
import { API_BASE_URL, authPost, request } from './api';
import { privatePhotoUpload } from './privatePhotoUpload';
import type { Step, Photo } from './guidedInspectionService';
export type BaselineDraft = {
  id: string;
  unit_id: string;
  status: string;
  revision: number;
  expected_active_id: string;
  template_id: string;
  template_version: number;
  steps: Step[];
  progress: number;
  required: number;
  photos: Photo[];
  uploads: Photo[];
  history: { action: string; at: string }[];
};
export type BaselineHistory = {
  active_id: string;
  status: string;
  drafts: BaselineDraft[];
  versions: {
    id: string;
    status: string;
    source: string;
    approved_at: string;
    photos: Photo[];
  }[];
};
const root = '/guided-inspections/';
export const getBaselines = (unit: string) =>
  request<BaselineHistory>(`${root}units/${unit}/baselines/`);
export const createBaseline = async (unit: string, template_id: string) =>
  (
    await authPost<{ draft: BaselineDraft }>(
      `${root}units/${unit}/baselines/`,
      { template_id },
    )
  ).draft;
export const getBaselineDraft = async (id: string) =>
  (await request<{ draft: BaselineDraft }>(`${root}baseline-drafts/${id}/`))
    .draft;
export const approveBaseline = async (draft: BaselineDraft) =>
  (
    await authPost<{ draft: BaselineDraft }>(
      `${root}baseline-drafts/${draft.id}/`,
      {
        revision: draft.revision,
        supersedes: draft.expected_active_id,
      },
    )
  ).draft;
export const uploadBaseline = (
  draft: BaselineDraft,
  step: string,
  slot: number,
  asset: Asset,
  progress: (n: number) => void,
): Promise<BaselineDraft> =>
  privatePhotoUpload(
    `${root}baseline-drafts/${draft.id}/photos/`,
    asset,
    { step_id: step, slot: String(slot), revision: String(draft.revision) },
    'draft',
    progress,
  );
export const baselinePhotoUrl = (draft: string, photo: string) =>
  `${API_BASE_URL}${root}baseline-drafts/${draft}/photos/${photo}/`;
export const versionPhotoUrl = (unit: string, version: string, photo: string) =>
  `${API_BASE_URL}${root}units/${unit}/baselines/${version}/photos/${photo}/`;
