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
};

export const runNpmAudit = async (): Promise<NpmAuditResult> => {
  const res = await fetch('/api/settings/npm-audit', {
    method: 'POST',
    credentials: 'include'
  });
  if (!res.ok) {
    throw new Error(`Failed to run npm audit (${res.status})`);
  }
  return res.json();
};
