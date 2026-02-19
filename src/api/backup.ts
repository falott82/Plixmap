import { apiFetch } from './client';

export interface ServerBackupRow {
  fileName: string;
  sizeBytes: number;
  createdAt: number;
  updatedAt: number;
}

export interface ServerBackupsResponse {
  backupDir: string;
  retention: number;
  backups: ServerBackupRow[];
}

export interface CreateServerBackupResponse {
  ok: boolean;
  backup: {
    fileName: string;
    sizeBytes: number;
    createdAt: number;
    pruned: string[];
  };
}

export const fetchServerBackups = async (): Promise<ServerBackupsResponse> => {
  const res = await apiFetch('/api/settings/backups', { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to load backups (${res.status})`);
  return res.json();
};

export const createServerBackup = async (): Promise<CreateServerBackupResponse> => {
  const res = await apiFetch('/api/settings/backups', {
    method: 'POST',
    credentials: 'include'
  });
  if (!res.ok) throw new Error(`Failed to create backup (${res.status})`);
  return res.json();
};

export const getServerBackupDownloadUrl = (fileName: string): string =>
  `/api/settings/backups/${encodeURIComponent(fileName)}`;
