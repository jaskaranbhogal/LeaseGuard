import type { Asset } from 'react-native-image-picker';
import { API_BASE_URL, ApiError, authPost, request } from './api';

export type AIComparisonResult = {
  analysis_status: 'completed' | 'unavailable';
  requires_manual_review: boolean;
  photo_quality: string;
  same_area: boolean | null;
  change_detected: boolean;
  classification: 'none' | 'normal_wear' | 'damage';
  severity: 'low' | 'medium' | 'high' | null;
  confidence: 'low' | 'medium' | 'high';
  findings: Array<{
    description: string;
    classification: 'normal_wear' | 'damage';
    pre_existing_worsened: boolean;
  }>;
  summary: string;
};

export type Comparison = {
  id: string;
  room: string;
  area: string;
  created_at: string;
  retain_until: string;
  status: 'pending' | 'completed';
  result: AIComparisonResult | null;
  decision: 'confirmed' | 'dismissed' | 'resolved' | null;
};

function attachment(asset: Asset, name: string): Blob {
  if (!asset.uri) {
    throw new ApiError('Please choose two valid photos.');
  }
  // React Native FormData accepts a file-like object (not a browser Blob).
  return {
    uri: asset.uri,
    type: asset.type || 'image/jpeg',
    name,
  } as unknown as Blob;
}

export async function uploadComparison(
  baseline: Asset,
  current: Asset,
  room: string,
  area: string,
  notes = '',
): Promise<Comparison> {
  if (!__DEV__ && !API_BASE_URL.startsWith('https://')) {
    throw new ApiError('Secure HTTPS server configuration required.');
  }
  // Django validates this CSRF token and the existing signed-in session.
  const { csrfToken } = await request<{ csrfToken: string }>('/auth/csrf/');
  if (!csrfToken) {
    throw new ApiError('Cannot verify your secure session.');
  }
  const form = new FormData();
  form.append('baseline', attachment(baseline, 'baseline.jpg'));
  form.append('current', attachment(current, 'current.jpg'));
  form.append('room', room.trim());
  form.append('area', area.trim());
  form.append('notes', notes.trim().slice(0, 1200));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000);
  try {
    const response = await fetch(`${API_BASE_URL}/inspections/compare/`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'X-CSRFToken': csrfToken },
      body: form,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.comparison) {
      throw new ApiError(
        data?.detail || 'Could not securely save and compare photos.',
        response.status,
      );
    }
    return data.comparison as Comparison;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      controller.signal.aborted
        ? 'Comparison request timed out. Check recent comparisons before retrying.'
        : 'Could not reach the comparison server. Check your connection.',
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function recentComparisons(): Promise<Comparison[]> {
  const result = await request<{ comparisons: Comparison[] }>('/inspections/recent/');
  return result.comparisons;
}

export async function setComparisonDecision(
  comparisonId: string,
  decision: 'confirmed' | 'dismissed' | 'resolved',
): Promise<Comparison> {
  const result = await authPost<{ comparison: Comparison }>(
    `/inspections/${encodeURIComponent(comparisonId)}/decision/`,
    { decision },
  );
  return result.comparison;
}
