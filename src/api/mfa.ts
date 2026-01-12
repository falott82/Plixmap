export const getMfaStatus = async (): Promise<{ enabled: boolean }> => {
  const res = await apiFetch('/api/auth/mfa', { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to fetch MFA status (${res.status})`);
  return res.json();
};

export const setupMfa = async (payload: { password: string }): Promise<{ secret: string; otpauthUrl: string }> => {
  const res = await apiFetch('/api/auth/mfa/setup', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Failed to setup MFA (${res.status})`);
  return res.json();
};

export const enableMfa = async (payload: { otp: string }): Promise<void> => {
  const res = await apiFetch('/api/auth/mfa/enable', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Failed to enable MFA (${res.status})`);
};

export const disableMfa = async (payload: { password: string; otp: string }): Promise<void> => {
  const res = await apiFetch('/api/auth/mfa/disable', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Failed to disable MFA (${res.status})`);
};
import { apiFetch } from './client';
