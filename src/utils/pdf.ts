import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { FloorPlan, IconName, MapObject } from '../store/types';
import { WALL_TYPE_IDS } from '../store/data';
import { loadImage } from './pdfShared';
import { clamp } from './pdfRender/helpers';
import type { PlanRenderContext, PlanRenderOpts } from './pdfRender/context';
import { drawRooms } from './pdfRender/rooms';
import { drawWalls } from './pdfRender/walls';
import { drawQuotes } from './pdfRender/quotes';
import { drawLinks } from './pdfRender/links';
import { drawObjects } from './pdfRender/objects';
import { drawSafetySheet } from './pdfRender/safetySheet';
import { drawScale } from './pdfRender/scale';

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

export const renderFloorPlanToJpegDataUrl = async (
  plan: FloorPlan,
  opts: PlanRenderOpts
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

  const worldToPxX = scaleX * outScale;
  const worldToPxY = scaleY * outScale;
  const worldToPx = (worldToPxX + worldToPxY) / 2;

  const drawArrowHead = (x1: number, y1: number, x2: number, y2: number, size: number) => {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const a1 = angle + Math.PI * 0.82;
    const a2 = angle - Math.PI * 0.82;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 + Math.cos(a1) * size, y2 + Math.sin(a1) * size);
    ctx.lineTo(x2 + Math.cos(a2) * size, y2 + Math.sin(a2) * size);
    ctx.closePath();
    ctx.fill();
  };

  const wallTypeSet = new Set<string>(WALL_TYPE_IDS as string[]);
  const isWallObject = (obj: any) =>
    wallTypeSet.has(String(obj?.type || '')) || String(obj?.type || '').startsWith('wall') || !!(obj as any)?.wallGroupId;

  // Layers are drawn back-to-front by dedicated renderers (src/utils/pdfRender/*).
  const rc: PlanRenderContext = {
    plan, opts, ctx, img, naturalW, naturalH, logicalW, logicalH, scaleX, scaleY,
    ax, ay, aw, ah, srcX, srcY, srcW, srcH, outScale, outW, outH,
    worldToPxX, worldToPxY, worldToPx, drawArrowHead, isWallObject
  };
  if (opts.includeRooms) drawRooms(rc);
  if (opts.includeWalls) drawWalls(rc);
  if (opts.includeQuotes) drawQuotes(rc);
  if (opts.includeLinks) drawLinks(rc);
  if (opts.includeObjects) await drawObjects(rc);
  if (opts.includeSafetySheet ?? true) drawSafetySheet(rc);
  if (opts.includeScale) drawScale(rc);
  const jpegQ = clamp(opts.jpegQuality || 0.9, 0.5, 0.95);
  return { dataUrl: canvas.toDataURL('image/jpeg', jpegQ), width: outW, height: outH };
};

export const exportPlansToPdf = async (
  plans: { breadcrumb: string; clientName?: string; clientLogoUrl?: string; plan: FloorPlan }[],
  options: {
    includeIndex?: boolean;
    includeObjects?: boolean;
    includeDesks?: boolean;
    includeSafety?: boolean;
    includeSafetySheet?: boolean;
    includeLinks?: boolean;
    includeRooms?: boolean;
    includeWalls?: boolean;
    includeQuotes?: boolean;
    includeScale?: boolean;
    objectTypeIcons?: Record<string, IconName | undefined>;
    jpegQuality?: number;
    targetLongPx?: number;
    filename?: string;
  } = {}
) => {
  const includeIndex = options.includeIndex ?? true;
  const filename = options.filename || `plixmap_print_${new Date().toISOString().slice(0, 10)}.pdf`;
  const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4', compress: true });
  const margin = 18;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const maxW = pageWidth - margin * 2;
  const footerH = 26;
  const maxH = pageHeight - margin * 2 - footerH;

  const getPlanRevisionMeta = (plan: FloorPlan) => {
    const revs = Array.isArray(plan.revisions) ? [...plan.revisions] : [];
    revs.sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0));
    const latest = revs[0];
    const major =
      latest && typeof (latest as any).revMajor === 'number'
        ? Number((latest as any).revMajor)
        : latest && typeof (latest as any).version === 'number'
          ? 1
          : 1;
    const minor =
      latest && typeof (latest as any).revMinor === 'number'
        ? Number((latest as any).revMinor)
        : latest && typeof (latest as any).version === 'number'
          ? Math.max(0, Number((latest as any).version) - 1)
          : 0;
    const createdAt = latest && Number.isFinite(Number(latest.createdAt)) ? Number(latest.createdAt) : Date.now();
    const date = new Date(createdAt);
    const dateLabel = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { revLabel: `Rev: ${major}.${minor}`, dateLabel };
  };

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
      jpegQuality: options.jpegQuality || 0.9,
      includeObjects: options.includeObjects ?? true,
      includeDesks: options.includeDesks ?? true,
      includeSafety: options.includeSafety ?? true,
      includeSafetySheet: options.includeSafetySheet ?? true,
      includeLinks: options.includeLinks ?? true,
      includeRooms: options.includeRooms ?? true,
      includeWalls: options.includeWalls ?? true,
      includeQuotes: options.includeQuotes ?? true,
      includeScale: options.includeScale ?? true,
      objectTypeIcons: options.objectTypeIcons
    });
    const scale = Math.min(maxW / img.width, maxH / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const x = (pageWidth - drawW) / 2;
    const y = (pageHeight - footerH - drawH) / 2;
    pdf.addImage(img.dataUrl, 'JPEG', x, y, drawW, drawH, undefined, 'FAST');

    const meta = getPlanRevisionMeta(item.plan);
    pdf.setFontSize(9);
    pdf.setTextColor(100);
    pdf.text(meta.revLabel, margin, pageHeight - margin - 6);
    pdf.text(meta.dateLabel, pageWidth - margin - pdf.getTextWidth(meta.dateLabel), pageHeight - margin - 6);
    pdf.setTextColor(0);

    entries.push({ title: item.breadcrumb, page: pageNo, clientName: String(item.clientName || ''), clientLogoUrl: String(item.clientLogoUrl || '') });
    firstPlan = false;
  }

  if (includeIndex) {
    // Load Plixmap logo (best effort) for the first page
    let desklyLogo: string | null = null;
    try {
      const img = await loadImage('/plixmap-logo.png').catch(() => loadImage('/favicon.svg'));
      const c = document.createElement('canvas');
      const max = 96;
      const w = img.naturalWidth || (img as any).width || max;
      const h = img.naturalHeight || (img as any).height || max;
      const s = Math.min(1, max / Math.max(w, h));
      c.width = Math.max(1, Math.round(w * s));
      c.height = Math.max(1, Math.round(h * s));
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        desklyLogo = c.toDataURL('image/png');
      }
    } catch {
      desklyLogo = null;
    }

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
      if (p === 1) {
        // Header card
        pdf.setFillColor(241, 245, 249); // slate-100
        pdf.roundedRect(margin, margin, pageWidth - margin * 2, 74, 12, 12, 'F');

        const logoSize = 28;
        if (desklyLogo) {
          try {
            pdf.addImage(desklyLogo, 'PNG', margin + 14, margin + 18, logoSize, logoSize);
          } catch {
            // ignore
          }
        }

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(22);
        pdf.setTextColor(15, 23, 42); // slate-900
        pdf.text('Plixmap', margin + 14 + (desklyLogo ? logoSize + 10 : 0), margin + 38);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11);
        pdf.setTextColor(51, 65, 85); // slate-700
        pdf.text('PDF Export', margin + 14 + (desklyLogo ? logoSize + 10 : 0), margin + 56);

        const generatedOn = new Date().toISOString().slice(0, 10);
        const includeObjects = options.includeObjects ?? true;
        const includeDesks = options.includeDesks ?? true;
        const includeSafety = options.includeSafety ?? true;
        const includeSafetySheet = options.includeSafetySheet ?? true;
        const optsLine = [
          includeObjects ? 'Objects' : null,
          includeObjects && includeDesks ? 'Desks' : null,
          includeObjects && includeSafety ? 'Safety layer' : null,
          includeSafetySheet ? 'Safety sheet' : null,
          options.includeWalls ?? true ? 'Walls' : null,
          options.includeLinks ?? true ? 'Links' : null,
          options.includeRooms ?? true ? 'Rooms' : null,
          options.includeQuotes ?? true ? 'Quotes' : null,
          options.includeScale ?? true ? 'Scale' : null
        ]
          .filter(Boolean)
          .join(' · ');
        const rightBlock = [`Generated on ${generatedOn}`, optsLine ? `Includes: ${optsLine}` : 'Includes: none'].filter(Boolean);
        pdf.setFontSize(10);
        pdf.setTextColor(71, 85, 105); // slate-600
        let ry = margin + 30;
        for (const line of rightBlock) {
          const w = pdf.getTextWidth(line);
          pdf.text(line, pageWidth - margin - 14 - w, ry);
          ry += 14;
        }
      }
      pdf.setFontSize(10);
      pdf.setTextColor(0);
      pdf.setFontSize(11);

      const baseY = p === 1 ? margin + 98 : margin + 56;
      const startIdx = (p - 1) * linesPerPage;
      const chunk = entries.slice(startIdx, startIdx + linesPerPage);

      // Center the menu (TOC) on the first page for readability.
      let y = baseY;
      if (p === 1 && chunk.length) {
        let totalH = 0;
        let lastClient = '';
        for (const e of chunk) {
          const cn = e.clientName || '';
          if (cn && cn !== lastClient) {
            totalH += 18; // client header row
            lastClient = cn;
          }
          totalH += 14; // entry row
        }
        const centered = (pageHeight - totalH) / 2;
        y = Math.max(baseY, Math.min(centered, pageHeight - margin - totalH));
      }

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

  // Page counters (all pages, bottom-center)
  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    const label = `${p} / ${totalPages}`;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(120);
    pdf.text(label, (pageWidth - pdf.getTextWidth(label)) / 2, pageHeight - margin - 6);
    pdf.setTextColor(0);
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

// Standalone document exporters live in pdfDocuments.ts; re-exported here to
// keep the existing import surface (`from '../utils/pdf'`) stable.
export {
  exportChangelogToPdf,
  exportClientNotesToPdf,
  exportClientIpMapToPdf,
  exportClientDirectoryToPdf,
  type ClientDirectoryPdfColumnKey
} from './pdfDocuments';
