import { apiFetch } from './client';

export interface UpdateStatusResponse {
  ok: boolean;
  currentVersion: string;
  latestVersion: string | null;
  minSupportedVersion: string | null;
  updateAvailable: boolean;
  unsupported: boolean;
  mandatory: boolean;
  downloadUrl: string | null;
  releaseNotesUrl: string | null;
  publishedAt: string | null;
  checkedAt: number;
  error?: string;
}

export const fetchUpdateStatus = async (): Promise<UpdateStatusResponse> => {
  const res = await apiFetch('/api/update/latest', { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to check updates (${res.status})`);
  return res.json();
};
