import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Pure DOM/canvas export utilities extracted from SafetyPanel.tsx. None of these
// close over component state — they operate purely on the DOM nodes passed in.

/** Rasterize an element with html2canvas and save it as a centered A4-landscape PDF. */
export const exportElementToPdf = async (element: HTMLElement | null, filename: string) => {
  if (!element) return;
  const canvas = await html2canvas(element, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
  const pdf = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4', compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const targetW = pageW - margin * 2;
  const targetH = pageH - margin * 2;
  const ratio = Math.min(targetW / canvas.width, targetH / canvas.height);
  const drawW = canvas.width * ratio;
  const drawH = canvas.height * ratio;
  const x = (pageW - drawW) / 2;
  const y = (pageH - drawH) / 2;
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, drawW, drawH, undefined, 'FAST');
  pdf.save(filename);
};

/** Inline every <img> and <svg image> in a node as a data URL so it survives html2canvas. */
export const inlineImagesForExport = async (node: HTMLElement) => {
  const toDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
      reader.readAsDataURL(blob);
    });

  const cache = new Map<string, Promise<string | null>>();
  const resolveDataUrl = (rawUrl: string): Promise<string | null> => {
    const url = String(rawUrl || '').trim();
    if (!url) return Promise.resolve(null);
    if (url.startsWith('data:')) return Promise.resolve(url);
    const existing = cache.get(url);
    if (existing) return existing;
    const task = (async () => {
      try {
        const response = await fetch(url, { credentials: 'include', cache: 'force-cache' });
        if (!response.ok) return null;
        const blob = await response.blob();
        if (!blob || blob.size === 0) return null;
        return await toDataUrl(blob);
      } catch {
        return null;
      }
    })();
    cache.set(url, task);
    return task;
  };

  const svgImages = Array.from(node.querySelectorAll('svg image'));
  for (const entry of svgImages) {
    const href = entry.getAttribute('href') || entry.getAttribute('xlink:href') || '';
    const dataUrl = await resolveDataUrl(href);
    if (!dataUrl) continue;
    entry.setAttribute('href', dataUrl);
    entry.setAttribute('xlink:href', dataUrl);
  }

  const htmlImages = Array.from(node.querySelectorAll('img')) as HTMLImageElement[];
  for (const entry of htmlImages) {
    const src = entry.currentSrc || entry.src || '';
    const dataUrl = await resolveDataUrl(src);
    if (!dataUrl) continue;
    entry.src = dataUrl;
    try {
      if (typeof entry.decode === 'function') await entry.decode();
    } catch {
      // ignore
    }
  }
};

/** Wait (with per-image timeout) until all <img> and <svg image> sources in a node are loaded. */
export const waitForNodeImagesReady = async (node: HTMLElement | null) => {
  if (!node) return;
  const waitForSource = (rawSrc: string) =>
    new Promise<void>((resolve) => {
      const src = String(rawSrc || '').trim();
      if (!src) {
        resolve();
        return;
      }
      const probe = new Image();
      const done = () => {
        probe.onload = null;
        probe.onerror = null;
        resolve();
      };
      const timeout = window.setTimeout(done, 2500);
      probe.onload = () => {
        window.clearTimeout(timeout);
        done();
      };
      probe.onerror = () => {
        window.clearTimeout(timeout);
        done();
      };
      probe.src = src;
    });

  const htmlJobs = Array.from(node.querySelectorAll('img')).map((entry) =>
    new Promise<void>((resolve) => {
      const img = entry as HTMLImageElement;
      if (img.complete && img.naturalWidth > 0) {
        resolve();
        return;
      }
      const wrappedDone = () => {
        window.clearTimeout(timeout);
        img.removeEventListener('load', wrappedDone);
        img.removeEventListener('error', wrappedDone);
        resolve();
      };
      const timeout = window.setTimeout(wrappedDone, 2500);
      img.addEventListener('load', wrappedDone, { once: true });
      img.addEventListener('error', wrappedDone, { once: true });
    })
  );
  const svgJobs = Array.from(node.querySelectorAll('svg image')).map((entry) =>
    waitForSource(entry.getAttribute('href') || entry.getAttribute('xlink:href') || '')
  );
  await Promise.all([...htmlJobs, ...svgJobs]);
};

/** Replace each <svg> in a node with a rasterized <img> so html2canvas captures it faithfully. */
export const rasterizeSvgsForExport = async (node: HTMLElement) => {
  const svgNodes = Array.from(node.querySelectorAll('svg')) as SVGSVGElement[];
  for (const svg of svgNodes) {
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    const serialized = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
    const svgObjectUrl = URL.createObjectURL(svgBlob);
    const snapshot = new Image();
    const loaded = await new Promise<boolean>((resolve) => {
      const done = (ok: boolean) => {
        snapshot.onload = null;
        snapshot.onerror = null;
        URL.revokeObjectURL(svgObjectUrl);
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
      snapshot.src = svgObjectUrl;
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
