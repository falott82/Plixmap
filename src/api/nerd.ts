export type NpmAuditSummary = {
  info: number;
  low: number;
  moderate: number;
  high: number;
  critical: number;
  total: number;
};

export type NpmAuditResult = {
  ok: boolean;
  summary?: NpmAuditSummary | null;
  durationMs?: number;
  exitCode?: number;
  error?: string;
  stderr?: string;
  lastCheckAt?: number | null;
  lastCheckBy?: string | null;
  lastCheckUserId?: string | null;
};

export const fetchNpmAuditStatus = async (): Promise<{ lastCheckAt: number | null; lastCheckBy?: string | null; lastCheckUserId?: string | null }> => {
  const res = await apiFetch('/api/settings/npm-audit', { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to fetch npm audit status (${res.status})`);
  return res.json();
};

export const runNpmAudit = async (): Promise<NpmAuditResult> => {
  const res = await apiFetch('/api/settings/npm-audit', {
    method: 'POST',
    credentials: 'include'
  });
  if (!res.ok) {
    throw new Error(`Failed to run npm audit (${res.status})`);
  }
  return res.json();
};
import { apiFetch } from './client';
