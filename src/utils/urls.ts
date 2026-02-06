export const normalizeUrl = (value: string): string | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.href;
  } catch {
    return null;
  }
};
