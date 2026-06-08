/* eslint-disable @typescript-eslint/no-explicit-any */

// DOM/image export utilities (clone, inline images, rasterize SVG) extracted from InternalMapModal.
export const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('file-read-error'));
    reader.readAsDataURL(blob);
  });

export const loadImageAsDataUrl = async (src: string) => {
  const raw = String(src || '').trim();
  if (!raw) return '';
  if (/^data:/i.test(raw)) return raw;
  try {
    const response = await fetch(raw, { credentials: 'include', mode: 'cors' });
    if (!response.ok) throw new Error(`http-${response.status}`);
    const blob = await response.blob();
    return await blobToDataUrl(blob);
  } catch {
    return raw;
  }
};

export const waitForNodeImagesReady = async (node: HTMLElement) => {
  const htmlImgs = Array.from(node.querySelectorAll('img')) as HTMLImageElement[];
  const svgImgs = Array.from(node.querySelectorAll('image')) as SVGImageElement[];
  const waitHtml = htmlImgs.map((img) =>
    img.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
  );
  const waitSvg = svgImgs.map((svgImg) => {
    const href = String(svgImg.getAttribute('href') || svgImg.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '').trim();
    if (!href) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const img = new Image();
      if (/^https?:\/\//i.test(href)) img.crossOrigin = 'anonymous';
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = href;
    });
  });
  await Promise.all([...waitHtml, ...waitSvg]);
};

export const inlineImagesForExport = async (node: HTMLElement) => {
  const cache = new Map<string, Promise<string>>();
  const resolveDataUrl = (rawSrc: string) => {
    const src = String(rawSrc || '').trim();
    if (!src) return Promise.resolve('');
    if (/^data:/i.test(src)) return Promise.resolve(src);
    const cached = cache.get(src);
    if (cached) return cached;
    const task = loadImageAsDataUrl(src);
    cache.set(src, task);
    return task;
  };

  const svgImages = Array.from(node.querySelectorAll('svg image'));
  for (const entry of svgImages) {
    const href = String(entry.getAttribute('href') || entry.getAttribute('xlink:href') || '').trim();
    if (!href) continue;
    const dataUrl = await resolveDataUrl(href);
    if (!dataUrl || !/^data:/i.test(dataUrl)) continue;
    entry.setAttribute('href', dataUrl);
    entry.setAttribute('xlink:href', dataUrl);
  }

  const htmlImages = Array.from(node.querySelectorAll('img')) as HTMLImageElement[];
  for (const entry of htmlImages) {
    const src = String(entry.currentSrc || entry.src || '').trim();
    if (!src) continue;
    const dataUrl = await resolveDataUrl(src);
    if (!dataUrl || !/^data:/i.test(dataUrl)) continue;
    entry.src = dataUrl;
    try {
      if (typeof entry.decode === 'function') await entry.decode();
    } catch {
      // ignore decode issues
    }
  }
};

export const rasterizeSvgsForExport = async (node: HTMLElement) => {
  const svgNodes = Array.from(node.querySelectorAll('svg')) as SVGSVGElement[];
  for (const svg of svgNodes) {
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    const serialized = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const snapshot = new Image();
    const loaded = await new Promise<boolean>((resolve) => {
      const done = (ok: boolean) => {
        snapshot.onload = null;
        snapshot.onerror = null;
        URL.revokeObjectURL(objectUrl);
        resolve(ok);
      };
      const timeout = window.setTimeout(() => done(false), 3500);
      snapshot.onload = () => {
        window.clearTimeout(timeout);
        done(true);
      };
      snapshot.onerror = () => {
        window.clearTimeout(timeout);
        done(false);
      };
      snapshot.src = objectUrl;
    });
    if (!loaded) continue;

    const computed = window.getComputedStyle(svg);
    const rect = svg.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || parseFloat(computed.width) || 1));
    const height = Math.max(1, Math.round(rect.height || parseFloat(computed.height) || 1));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(snapshot, 0, 0, width, height);
    const replacement = document.createElement('img');
    replacement.alt = '';
    replacement.src = canvas.toDataURL('image/png');
    replacement.width = width;
    replacement.height = height;
    replacement.style.display = computed.display === 'inline' ? 'block' : computed.display || 'block';
    replacement.style.width = computed.width && computed.width !== 'auto' ? computed.width : '100%';
    replacement.style.height = computed.height && computed.height !== 'auto' ? computed.height : `${height}px`;
    replacement.style.maxWidth = '100%';
    replacement.style.verticalAlign = computed.verticalAlign || 'baseline';
    try {
      if (typeof replacement.decode === 'function') await replacement.decode();
    } catch {
      // ignore decode failures
    }
    svg.replaceWith(replacement);
  }
};

export const buildCaptureNode = (source: HTMLElement) => {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-100000px';
  host.style.top = '-100000px';
  host.style.pointerEvents = 'none';
  host.style.opacity = '0';
  host.style.zIndex = '-1';
  const clone = source.cloneNode(true) as HTMLElement;
  host.appendChild(clone);
  document.body.appendChild(host);
  return { host, node: clone };
};
