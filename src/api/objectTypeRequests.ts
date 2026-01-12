import { IconName } from '../store/types';

export type CustomFieldDraft = {
  label: string;
  valueType: 'string' | 'number' | 'boolean';
};

export interface ObjectTypeRequestPayload {
  typeId: string;
  nameIt: string;
  nameEn: string;
  icon: IconName;
  customFields?: CustomFieldDraft[];
}

export interface ObjectTypeRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: number;
  requestedBy: { id: string; username: string };
  reviewedAt?: number | null;
  reviewedBy?: { id: string; username: string } | null;
  reason?: string | null;
  payload: ObjectTypeRequestPayload;
  finalPayload?: ObjectTypeRequestPayload | null;
}

export const fetchObjectTypeRequests = async (): Promise<{ requests: ObjectTypeRequest[] }> => {
  const res = await apiFetch('/api/object-type-requests', { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to fetch object type requests (${res.status})`);
  return res.json();
};

export const createObjectTypeRequest = async (payload: ObjectTypeRequestPayload): Promise<{ ok: boolean; id: string }> => {
  const res = await apiFetch('/api/object-type-requests', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Failed to create request (${res.status})`);
  return res.json();
};

export const resolveObjectTypeRequest = async (
  id: string,
  payload: { status: 'approved' | 'rejected'; reason?: string; finalPayload?: ObjectTypeRequestPayload }
): Promise<{ ok: boolean }> => {
  const res = await apiFetch(`/api/object-type-requests/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Failed to update request (${res.status})`);
  return res.json();
};

export const updateObjectTypeRequest = async (
  id: string,
  payload: ObjectTypeRequestPayload
): Promise<{ ok: boolean }> => {
  const res = await apiFetch(`/api/object-type-requests/${id}/user`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Failed to update request (${res.status})`);
  return res.json();
};

export const deleteObjectTypeRequest = async (id: string): Promise<{ ok: boolean }> => {
  const res = await apiFetch(`/api/object-type-requests/${id}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  if (!res.ok) throw new Error(`Failed to delete request (${res.status})`);
  return res.json();
};
import { apiFetch } from './client';
