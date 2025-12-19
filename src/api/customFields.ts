export type CustomFieldValueType = 'string' | 'number' | 'boolean';

export interface CustomField {
  id: string;
  typeId: string;
  fieldKey: string;
  label: string;
  valueType: CustomFieldValueType;
  createdAt: number;
  updatedAt: number;
}

export const fetchCustomFields = async (): Promise<{ fields: CustomField[] }> => {
  const res = await fetch('/api/custom-fields', { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch custom fields (${res.status})`);
  return res.json();
};

export const createCustomField = async (payload: {
  typeId: string;
  fieldKey: string;
  label: string;
  valueType: CustomFieldValueType;
}): Promise<{ ok: boolean; id: string }> => {
  const res = await fetch('/api/custom-fields', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Failed to create custom field (${res.status})`);
  return res.json();
};

export const updateCustomField = async (id: string, payload: { label: string }): Promise<void> => {
  const res = await fetch(`/api/custom-fields/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Failed to update custom field (${res.status})`);
};

export const deleteCustomField = async (id: string): Promise<void> => {
  const res = await fetch(`/api/custom-fields/${id}`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to delete custom field (${res.status})`);
};

export const fetchObjectCustomValues = async (objectId: string): Promise<{ values: Record<string, any> }> => {
  const res = await fetch(`/api/object-custom/${objectId}`, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch object custom values (${res.status})`);
  return res.json();
};

export const saveObjectCustomValues = async (objectId: string, payload: { typeId: string; values: Record<string, any> }): Promise<void> => {
  const res = await fetch(`/api/object-custom/${objectId}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Failed to save object custom values (${res.status})`);
};

