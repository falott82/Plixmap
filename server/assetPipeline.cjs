// Image/PDF data-URL validation and externalization pipeline, extracted from
// index.cjs. Validates inline data: assets against size/mime limits and rewrites
// them to files under uploadsDir. Built as a factory so uploadsDir is injected
// (and so the unit surface is testable in isolation).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { serverConfig } = require('./config.cjs');

const createAssetPipeline = ({ uploadsDir }) => {
const parseDataUrl = (value) => {
  if (typeof value !== 'string') return null;
  // Allow optional data URL parameters like `data:audio/webm;codecs=opus;base64,...`
  const m = /^data:([^;]+)(?:;[^,]+)*;base64,(.*)$/.exec(value);
  if (!m) return null;
  return { mime: m[1], base64: m[2] };
};

const extForMime = (mime) => {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/jpg') return 'jpg';
  if (mime === 'image/gif') return 'gif';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'application/pdf') return 'pdf';
  return null;
};

const MAX_IMAGE_BYTES = (() => {
  return serverConfig.uploadMaxImageBytes;
})();
const MAX_PDF_BYTES = (() => {
  return serverConfig.uploadMaxPdfBytes;
})();
const allowedDataMimes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf']);

const base64SizeBytes = (base64) => {
  const len = base64.length;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((len * 3) / 4) - padding);
};

const validateDataUrl = (dataUrl) => {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return { ok: false, reason: 'invalid' };
  const mime = String(parsed.mime || '').toLowerCase();
  if (!allowedDataMimes.has(mime)) return { ok: false, reason: 'mime', mime };
  const maxBytes = mime === 'application/pdf' ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
  const sizeBytes = base64SizeBytes(parsed.base64 || '');
  if (sizeBytes > maxBytes) return { ok: false, reason: 'size', mime, maxBytes, sizeBytes };
  return { ok: true, mime, sizeBytes };
};

const validateImagesInHtml = (html) => {
  if (typeof html !== 'string' || !html.includes('data:image/')) return { ok: true };
  const re = /<img\b[^>]*?\bsrc\s*=\s*"(data:image\/[^;"]+;base64,[^"]+)"[^>]*?>/gi;
  let match;
  while ((match = re.exec(html))) {
    const res = validateDataUrl(match[1]);
    if (!res.ok) return { ok: false, reason: res.reason, mime: res.mime, maxBytes: res.maxBytes, sizeBytes: res.sizeBytes };
  }
  return { ok: true };
};

const validateImagesInLexicalState = (stateJson) => {
  if (typeof stateJson !== 'string' || !stateJson.includes('data:image/')) return { ok: true };
  try {
    const obj = JSON.parse(stateJson);
    let invalid = null;
    const walk = (node) => {
      if (!node || typeof node !== 'object' || invalid) return;
      if (node.type === 'image' && typeof node.src === 'string' && node.src.startsWith('data:')) {
        const res = validateDataUrl(node.src);
        if (!res.ok) invalid = res;
        return;
      }
      for (const k of Object.keys(node)) {
        const v = node[k];
        if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === 'object') walk(v);
      }
    };
    walk(obj);
    if (invalid) return { ok: false, reason: invalid.reason, mime: invalid.mime, maxBytes: invalid.maxBytes, sizeBytes: invalid.sizeBytes };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
};

const validateAssetsInClients = (clients) => {
  if (!Array.isArray(clients)) return { ok: true };
  for (const client of clients) {
    if (client?.logoUrl && typeof client.logoUrl === 'string' && client.logoUrl.startsWith('data:')) {
      const res = validateDataUrl(client.logoUrl);
      if (!res.ok) return { ok: false, field: 'client.logoUrl', ...res };
    }
    if (Array.isArray(client?.attachments)) {
      for (const a of client.attachments) {
        if (a?.dataUrl && typeof a.dataUrl === 'string' && a.dataUrl.startsWith('data:')) {
          const res = validateDataUrl(a.dataUrl);
          if (!res.ok) return { ok: false, field: 'client.attachments', ...res };
        }
      }
    }
    if (client?.notesHtml && typeof client.notesHtml === 'string' && client.notesHtml.includes('data:image/')) {
      const res = validateImagesInHtml(client.notesHtml);
      if (!res.ok) return { ok: false, field: 'client.notesHtml', ...res };
    }
    if (client?.notesLexical && typeof client.notesLexical === 'string' && client.notesLexical.includes('data:image/')) {
      const res = validateImagesInLexicalState(client.notesLexical);
      if (!res.ok) return { ok: false, field: 'client.notesLexical', ...res };
    }
    if (Array.isArray(client?.notes)) {
      for (const note of client.notes) {
        if (note?.notesHtml && typeof note.notesHtml === 'string' && note.notesHtml.includes('data:image/')) {
          const res = validateImagesInHtml(note.notesHtml);
          if (!res.ok) return { ok: false, field: 'client.notes[].notesHtml', ...res };
        }
        if (note?.notesLexical && typeof note.notesLexical === 'string' && note.notesLexical.includes('data:image/')) {
          const res = validateImagesInLexicalState(note.notesLexical);
          if (!res.ok) return { ok: false, field: 'client.notes[].notesLexical', ...res };
        }
      }
    }
    for (const site of client?.sites || []) {
      for (const plan of site?.floorPlans || []) {
        if (plan?.imageUrl && typeof plan.imageUrl === 'string' && plan.imageUrl.startsWith('data:')) {
          const res = validateDataUrl(plan.imageUrl);
          if (!res.ok) return { ok: false, field: 'plan.imageUrl', ...res };
        }
        for (const rev of plan?.revisions || []) {
          if (rev?.imageUrl && typeof rev.imageUrl === 'string' && rev.imageUrl.startsWith('data:')) {
            const res = validateDataUrl(rev.imageUrl);
            if (!res.ok) return { ok: false, field: 'plan.revisions[].imageUrl', ...res };
          }
        }
      }
    }
  }
  return { ok: true };
};

const externalizeDataUrl = (dataUrl) => {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  const validation = validateDataUrl(dataUrl);
  if (!validation.ok) return null;
  const ext = extForMime(parsed.mime);
  if (!ext) return null;
  const id = crypto.randomUUID();
  const filename = `${id}.${ext}`;
  const filePath = path.join(uploadsDir, filename);
  try {
    const buf = Buffer.from(parsed.base64, 'base64');
    fs.writeFileSync(filePath, buf);
    return `/uploads/${filename}`;
  } catch {
    return null;
  }
};

const externalizeImagesInHtml = (html) => {
  if (typeof html !== 'string' || !html.includes('data:image/')) return html;
  return html.replace(/<img\b([^>]*?)\bsrc\s*=\s*"(data:image\/[^;"]+;base64,[^"]+)"([^>]*?)>/gi, (m, pre, dataUrl, post) => {
    const url = externalizeDataUrl(dataUrl);
    if (!url) return m;
    return `<img${pre}src="${url}"${post}>`;
  });
};

const externalizeImagesInLexicalState = (stateJson) => {
  if (typeof stateJson !== 'string' || !stateJson.includes('data:image/')) return stateJson;
  try {
    const obj = JSON.parse(stateJson);
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'image' && typeof node.src === 'string' && node.src.startsWith('data:')) {
        const url = externalizeDataUrl(node.src);
        if (url) node.src = url;
      }
      for (const k of Object.keys(node)) {
        const v = node[k];
        if (Array.isArray(v)) {
          for (const item of v) walk(item);
        } else if (v && typeof v === 'object') {
          walk(v);
        }
      }
    };
    walk(obj);
    return JSON.stringify(obj);
  } catch {
    return stateJson;
  }
};

const externalizeAssetsInClients = (clients) => {
  if (!Array.isArray(clients)) return;
  for (const client of clients) {
    if (client?.logoUrl && typeof client.logoUrl === 'string' && client.logoUrl.startsWith('data:')) {
      const url = externalizeDataUrl(client.logoUrl);
      if (url) client.logoUrl = url;
    }
    if (Array.isArray(client?.attachments)) {
      for (const a of client.attachments) {
        if (a?.dataUrl && typeof a.dataUrl === 'string' && a.dataUrl.startsWith('data:')) {
          const url = externalizeDataUrl(a.dataUrl);
          if (url) a.dataUrl = url;
        }
      }
    }
    if (client?.notesHtml && typeof client.notesHtml === 'string' && client.notesHtml.includes('data:image/')) {
      client.notesHtml = externalizeImagesInHtml(client.notesHtml);
    }
    if (client?.notesLexical && typeof client.notesLexical === 'string' && client.notesLexical.includes('data:image/')) {
      client.notesLexical = externalizeImagesInLexicalState(client.notesLexical);
    }
    if (Array.isArray(client?.notes)) {
      for (const note of client.notes) {
        if (note?.notesHtml && typeof note.notesHtml === 'string' && note.notesHtml.includes('data:image/')) {
          note.notesHtml = externalizeImagesInHtml(note.notesHtml);
        }
        if (note?.notesLexical && typeof note.notesLexical === 'string' && note.notesLexical.includes('data:image/')) {
          note.notesLexical = externalizeImagesInLexicalState(note.notesLexical);
        }
      }
    }
    for (const site of client?.sites || []) {
      for (const plan of site?.floorPlans || []) {
        if (plan?.imageUrl && typeof plan.imageUrl === 'string' && plan.imageUrl.startsWith('data:')) {
          const url = externalizeDataUrl(plan.imageUrl);
          if (url) plan.imageUrl = url;
        }
        for (const rev of plan?.revisions || []) {
          if (rev?.imageUrl && typeof rev.imageUrl === 'string' && rev.imageUrl.startsWith('data:')) {
            const url = externalizeDataUrl(rev.imageUrl);
            if (url) rev.imageUrl = url;
          }
        }
      }
    }
  }
};

  return {
    parseDataUrl,
    validateDataUrl,
    validateAssetsInClients,
    externalizeDataUrl,
    externalizeAssetsInClients
  };
};

module.exports = { createAssetPipeline };
