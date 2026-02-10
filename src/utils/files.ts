export const uploadLimits = {
  planImageBytes: 12 * 1024 * 1024,
  logoImageBytes: 2 * 1024 * 1024,
  avatarImageBytes: 2 * 1024 * 1024,
  noteImageBytes: 5 * 1024 * 1024,
  pdfBytes: 20 * 1024 * 1024
};

export const uploadMimes = {
  images: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'],
  pdf: ['application/pdf']
};

export const formatBytes = (bytes: number): string => {
  const mb = Math.max(1, Math.ceil(bytes / (1024 * 1024)));
  return `${mb}MB`;
};

const extToMime: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf'
};

export const validateFile = (
  file: File,
  options: { allowedTypes?: string[]; maxBytes?: number }
): { ok: boolean; reason?: 'type' | 'size' } => {
  const allowed = options.allowedTypes?.map((t) => t.toLowerCase());
  if (allowed && allowed.length) {
    const raw = String(file.type || '').toLowerCase();
    const ext = String(file.name || '').toLowerCase().split('.').pop() || '';
    const effective = raw || extToMime[ext] || '';
    if (!effective || !allowed.includes(effective)) return { ok: false, reason: 'type' };
  }
  if (options.maxBytes && file.size > options.maxBytes) return { ok: false, reason: 'size' };
  return { ok: true };
};

export const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
