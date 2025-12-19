import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { FloorPlan, MapObject } from '../store/types';
import { ReleaseNote } from '../version/history';

export type PdfOrientation = 'auto' | 'portrait' | 'landscape';

export interface PdfExportOptions {
  orientation?: PdfOrientation;
  includeList?: boolean;
}

const getPdfOrientation = (options: PdfExportOptions | undefined, pixelWidth: number, pixelHeight: number): 'p' | 'l' => {
  if (options?.orientation === 'portrait') return 'p';
  if (options?.orientation === 'landscape') return 'l';
  return pixelWidth >= pixelHeight ? 'l' : 'p';
};

export const exportPlanImageOnlyToPdf = async (
  image: { dataUrl: string; width: number; height: number },
  planName: string,
  options: PdfExportOptions = {}
) => {
  const orientation = getPdfOrientation(options, image.width, image.height);
  const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4', compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const maxW = pageWidth - margin * 2;
  const maxH = pageHeight - margin * 2;
  const scale = Math.min(maxW / image.width, maxH / image.height);
  const drawW = image.width * scale;
  const drawH = image.height * scale;
  const x = (pageWidth - drawW) / 2;
  const y = (pageHeight - drawH) / 2;
  const format = image.dataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
  pdf.addImage(image.dataUrl, format as any, x, y, drawW, drawH, undefined, 'FAST');
  pdf.save(`${planName.replace(/\s+/g, '_')}.pdf`);
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    if (/^https?:\/\//.test(src)) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const renderFloorPlanToJpegDataUrl = async (
  plan: FloorPlan,
  opts: { targetLongPx: number; jpegQuality: number }
): Promise<{ dataUrl: string; width: number; height: number }> => {
  const img = await loadImage(plan.imageUrl);
  const naturalW = img.naturalWidth || (img as any).width || 1;
  const naturalH = img.naturalHeight || (img as any).height || 1;
  const logicalW = plan.width || naturalW;
  const logicalH = plan.height || naturalH;
  const scaleX = naturalW / logicalW;
  const scaleY = naturalH / logicalH;

  const area = plan.printArea
    ? {
        x: plan.printArea.x,
        y: plan.printArea.y,
        width: plan.printArea.width,
        height: plan.printArea.height
      }
    : { x: 0, y: 0, width: logicalW, height: logicalH };

  const ax = clamp(area.x, 0, logicalW);
  const ay = clamp(area.y, 0, logicalH);
  const aw = clamp(area.width, 1, logicalW - ax);
  const ah = clamp(area.height, 1, logicalH - ay);

  const srcX = Math.round(ax * scaleX);
  const srcY = Math.round(ay * scaleY);
  const srcW = Math.round(aw * scaleX);
  const srcH = Math.round(ah * scaleY);

  const targetLong = Math.max(900, Math.min(5200, Math.round(opts.targetLongPx || 2600)));
  const outScale = targetLong / Math.max(srcW, srcH);
  const outW = Math.max(1, Math.round(srcW * outScale));
  const outH = Math.max(1, Math.round(srcH * outScale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);

  const jpegQ = clamp(opts.jpegQuality || 0.9, 0.5, 0.95);
  return { dataUrl: canvas.toDataURL('image/jpeg', jpegQ), width: outW, height: outH };
};

export const exportPlansToPdf = async (
  plans: { breadcrumb: string; clientName?: string; clientLogoUrl?: string; plan: FloorPlan }[],
  options: { includeIndex?: boolean; jpegQuality?: number; targetLongPx?: number; filename?: string } = {}
) => {
  const includeIndex = options.includeIndex ?? true;
  const filename = options.filename || `deskly_print_${new Date().toISOString().slice(0, 10)}.pdf`;
  const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4', compress: true });
  const margin = 18;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const maxW = pageWidth - margin * 2;
  const maxH = pageHeight - margin * 2;

  const linesPerPage = Math.floor((pageHeight - margin * 2 - 60) / 14);
  const tocPages = includeIndex ? Math.max(1, Math.ceil(plans.length / Math.max(1, linesPerPage))) : 0;

  if (includeIndex) {
    for (let i = 1; i < tocPages; i++) pdf.addPage();
  }

  const entries: { title: string; page: number; clientName: string; clientLogoUrl: string }[] = [];

  let firstPlan = true;
  for (const item of plans) {
    if (includeIndex) {
      pdf.addPage();
    } else if (!firstPlan) {
      pdf.addPage();
    }
    const pageNo = pdf.getNumberOfPages();
    const img = await renderFloorPlanToJpegDataUrl(item.plan, {
      targetLongPx: options.targetLongPx || 2600,
      jpegQuality: options.jpegQuality || 0.9
    });
    const scale = Math.min(maxW / img.width, maxH / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const x = (pageWidth - drawW) / 2;
    const y = (pageHeight - drawH) / 2;
    pdf.addImage(img.dataUrl, 'JPEG', x, y, drawW, drawH, undefined, 'FAST');
    entries.push({ title: item.breadcrumb, page: pageNo, clientName: String(item.clientName || ''), clientLogoUrl: String(item.clientLogoUrl || '') });
    firstPlan = false;
  }

  if (includeIndex) {
    // Preload client logos (best effort)
    const clientLogoByName = new Map<string, string>();
    for (const e of entries) {
      const cn = e.clientName || '';
      if (!cn || clientLogoByName.has(cn)) continue;
      const url = e.clientLogoUrl || '';
      if (!url) continue;
      try {
        const img = await loadImage(url);
        const c = document.createElement('canvas');
        const max = 64;
        const w = img.naturalWidth || (img as any).width || max;
        const h = img.naturalHeight || (img as any).height || max;
        const s = Math.min(1, max / Math.max(w, h));
        c.width = Math.max(1, Math.round(w * s));
        c.height = Math.max(1, Math.round(h * s));
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          clientLogoByName.set(cn, c.toDataURL('image/png'));
        }
      } catch {
        // ignore
      }
    }

    // Fill TOC pages
    for (let p = 1; p <= tocPages; p++) {
      pdf.setPage(p);
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      pdf.setTextColor(0);
      pdf.setFontSize(18);
      if (p === 1) {
        pdf.text('Deskly — PDF Export', margin, margin + 14);
        pdf.setFontSize(11);
        pdf.setTextColor(100);
        pdf.text(`Generated on ${new Date().toISOString().slice(0, 10)}`, margin, margin + 32);
      }
      pdf.setFontSize(10);
      pdf.setTextColor(0);
      pdf.setFontSize(11);

      let y = margin + 56;
      const startIdx = (p - 1) * linesPerPage;
      const chunk = entries.slice(startIdx, startIdx + linesPerPage);

      let lastClient = '';
      for (const e of chunk) {
        const cn = e.clientName || '';
        if (cn && cn !== lastClient) {
          // Client header
          const logo = clientLogoByName.get(cn);
          if (logo) {
            try {
              pdf.addImage(logo, 'PNG', margin, y - 10, 18, 18);
            } catch {
              // ignore
            }
          }
          pdf.setFontSize(12);
          pdf.setTextColor(0);
          pdf.text(cn, margin + (logo ? 24 : 0), y + 4);
          y += 18;
          pdf.setFontSize(11);
          lastClient = cn;
        }

        const label = e.title;
        const pageLabel = String(e.page);
        const textW = pdf.getTextWidth(label);
        pdf.setTextColor(40);
        pdf.text(label, margin + 8, y);
        pdf.setTextColor(120);
        pdf.text(pageLabel, pageWidth - margin - pdf.getTextWidth(pageLabel), y);
        pdf.setTextColor(0);
        pdf.link(margin, y - 10, Math.min(maxW, textW + 40), 14, { pageNumber: e.page });
        y += 14;
      }
    }
  }
  pdf.save(filename);
};

export const exportPlanToPdf = async (
  mapElement: HTMLElement,
  _objects: MapObject[],
  planName: string,
  options: PdfExportOptions = {},
  _typeLabelById?: Record<string, string>
) => {
  const canvas = await html2canvas(mapElement, { backgroundColor: '#ffffff' });
  const imgData = canvas.toDataURL('image/jpeg', 0.82);
  await exportPlanImageOnlyToPdf({ dataUrl: imgData, width: canvas.width, height: canvas.height }, planName, options);
};

export const exportChangelogToPdf = (
  history: ReleaseNote[],
  options: { lang?: 'it' | 'en'; filename?: string } = {}
) => {
  const lang = options.lang === 'en' ? 'en' : 'it';
  const filename = options.filename || 'deskly_changelog.pdf';
  const pdf = new jsPDF('p', 'pt', 'a4');
  const margin = 32;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = 44;

  pdf.setFontSize(18);
  pdf.text('Deskly — Changelog', margin, y);
  y += 22;

  pdf.setFontSize(10);
  pdf.setTextColor(100);
  pdf.text(
    lang === 'en'
      ? `Generated on ${new Date().toISOString().slice(0, 10)}`
      : `Generato il ${new Date().toISOString().slice(0, 10)}`,
    margin,
    y
  );
  pdf.setTextColor(0);
  y += 18;

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageHeight - margin) return;
    pdf.addPage();
    y = margin;
  };

  for (const rel of history) {
    ensureSpace(42);
    pdf.setFontSize(12);
    pdf.setTextColor(0);
    pdf.text(`v${rel.version}`, margin, y);
    pdf.setFontSize(10);
    pdf.setTextColor(100);
    pdf.text(rel.date, margin + 120, y);
    pdf.setTextColor(0);
    y += 14;

    pdf.setFontSize(10);
    for (const note of rel.notes) {
      const text = lang === 'en' ? note.en : note.it;
      const lines = pdf.splitTextToSize(`• ${text}`, maxWidth);
      ensureSpace(lines.length * 12 + 6);
      pdf.text(lines, margin, y);
      y += lines.length * 12;
    }
    y += 10;
  }

  pdf.save(filename);
};
