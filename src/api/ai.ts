import { apiFetch } from './client';

export const testOpenAiApiKey = async (
  apiKey: string
): Promise<{ ok: boolean; firstModel?: string | null; provider?: string; detail?: string | null }> => {
  const res = await apiFetch('/api/settings/openai/test', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.detail || body?.error || `OpenAI API test failed (${res.status})`);
  }
  return body || { ok: true };
};

export const transformMeetingNoteWithAi = async (
  meetingId: string,
  payload: { mode: 'translate' | 'correct'; text: string; targetLanguage?: string }
): Promise<{ ok: true; mode: 'translate' | 'correct'; transformedText: string; targetLanguage?: string | null }> => {
  const res = await apiFetch(`/api/meetings/${encodeURIComponent(String(meetingId || '').trim())}/notes/ai-transform`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.detail || body?.error || `AI transform failed (${res.status})`);
  }
  return body;
};

export const transformClientNoteWithAi = async (
  clientId: string,
  payload: { mode: 'translate' | 'correct'; text: string; targetLanguage?: string }
): Promise<{ ok: true; mode: 'translate' | 'correct'; transformedText: string; targetLanguage?: string | null }> => {
  const res = await apiFetch(`/api/clients/${encodeURIComponent(String(clientId || '').trim())}/notes/ai-transform`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.detail || body?.error || `AI transform failed (${res.status})`);
  }
  return body;
};
