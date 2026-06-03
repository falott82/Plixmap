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

export type PackageUpdateRow = {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  scope: 'dependencies' | 'devDependencies' | 'optionalDependencies' | 'peerDependencies' | 'unknown';
  dependent?: string | null;
  homepage?: string | null;
  type?: string | null;
};

export type PackageUpdateResult = {
  ok: boolean;
  packages: PackageUpdateRow[];
  count: number;
  checkedAt: number;
  durationMs?: number;
  exitCode?: number;
  error?: string;
  stderr?: string;
  lastCheckBy?: string | null;
  lastCheckUserId?: string | null;
};

export type PackageUpdateStatus = {
  lastCheckAt: number | null;
  lastCheckBy?: string | null;
  lastCheckUserId?: string | null;
  count?: number | null;
};

export type CodeAnalyzerFile = {
  rank: number;
  name: string;
  path: string;
  codeLines: number;
  hooks: number;
  responsive: number;
  jsx: number;
  functions: number;
  propTypes: number;
  propRefs: number;
  bytes: number;
  weight: string;
};

export type CodeAnalyzerResult = {
  ok: boolean;
  root: string;
  filesScanned: number;
  totalLines: number;
  largestFileLines: number;
  updatedAt: number;
  files: CodeAnalyzerFile[];
  error?: string;
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

export const fetchPackageUpdateStatus = async (): Promise<PackageUpdateStatus> => {
  const res = await apiFetch('/api/settings/package-updates', { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to fetch package update status (${res.status})`);
  return res.json();
};

export const checkPackageUpdates = async (): Promise<PackageUpdateResult> => {
  const res = await apiFetch('/api/settings/package-updates', {
    method: 'POST',
    credentials: 'include'
  });
  if (!res.ok) {
    throw new Error(`Failed to check package updates (${res.status})`);
  }
  return res.json();
};

export const fetchCodeAnalyzer = async (): Promise<CodeAnalyzerResult> => {
  const res = await apiFetch('/api/settings/code-analyzer', {
    method: 'POST',
    credentials: 'include'
  });
  if (!res.ok) {
    throw new Error(`Failed to analyze code (${res.status})`);
  }
  return res.json();
};

export interface ReadinessStatus {
  ok: boolean;
  status: string;
  db?: string;
  schemaVersion?: number;
  latestVersion?: number;
  wsClients?: number;
  ts?: number;
  error?: string;
}

export interface MigrationStatus {
  schemaVersion: number;
  latestVersion: number;
  upToDate: boolean;
  applied: Array<{ version: number; name: string; appliedAt: number }>;
}

export const fetchReadiness = async (): Promise<ReadinessStatus> => {
  const res = await apiFetch('/api/health/ready', { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to fetch readiness (${res.status})`);
  return res.json();
};

export const fetchMigrationStatus = async (): Promise<MigrationStatus> => {
  const res = await apiFetch('/api/settings/db/migrations', { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to fetch migrations (${res.status})`);
  return res.json();
};
import { apiFetch } from './client';
