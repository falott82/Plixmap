import jsPDF from 'jspdf';
import { createElement } from 'react';
import html2canvas from 'html2canvas';
import { renderToStaticMarkup } from 'react-dom/server';
import { FloorPlan, IconName, MapObject } from '../store/types';
import { ReleaseNote } from '../version/history';
import Icon from '../components/ui/Icon';

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

const drawRoundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  if ((ctx as any).roundRect) {
    (ctx as any).beginPath();
    (ctx as any).roundRect(x, y, w, h, radius);
    ctx.closePath();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
};

const svgIconToImage = async (iconName: IconName, opts?: { size?: number; color?: string; strokeWidth?: number }) => {
  const svg = renderToStaticMarkup(
    createElement(Icon, {
      name: iconName,
      size: opts?.size || 18,
      color: opts?.color || '#2563eb',
      strokeWidth: opts?.strokeWidth || 1.8
    })
  );
  const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  return loadImage(dataUrl);
};

export const renderFloorPlanToJpegDataUrl = async (
  plan: FloorPlan,
  opts: {
    targetLongPx: number;
    jpegQuality: number;
    includeObjects?: boolean;
    includeLinks?: boolean;
    includeRooms?: boolean;
    objectTypeIcons?: Record<string, IconName | undefined>;
  }
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

  if (opts.includeRooms) {
    const rooms = (plan.rooms || []) as any[];
    for (const r of rooms) {
      const color = String((r as any).color || '#94a3b8');
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, Math.round(2 * worldToPx));
      ctx.setLineDash([Math.max(4, Math.round(6 * worldToPx)), Math.max(3, Math.round(5 * worldToPx))]);
      if ((r as any).kind === 'poly' && Array.isArray((r as any).points) && (r as any).points.length >= 3) {
        const pts = (r as any).points as { x: number; y: number }[];
        ctx.beginPath();
        for (let i = 0; i < pts.length; i += 1) {
          const px = (Number(pts[i].x) - ax) * worldToPxX;
          const py = (Number(pts[i].y) - ay) * worldToPxY;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      } else {
        const rx = (Number((r as any).x || 0) - ax) * worldToPxX;
        const ry = (Number((r as any).y || 0) - ay) * worldToPxY;
        const rw = Number((r as any).width || 0) * worldToPxX;
        const rh = Number((r as any).height || 0) * worldToPxY;
        if (rw > 1 && rh > 1) ctx.strokeRect(rx, ry, rw, rh);
      }
      ctx.restore();
    }
  }

  if (opts.includeLinks) {
    const objectsById = new Map<string, MapObject>((plan.objects || []).map((o) => [o.id, o]));
    const links = ((plan as any).links || []) as any[];

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

    for (const l of links) {
      const from = objectsById.get(String((l as any).fromId || ''));
      const to = objectsById.get(String((l as any).toId || ''));
      if (!from || !to) continue;
      const x1 = (Number(from.x) - ax) * worldToPxX;
      const y1 = (Number(from.y) - ay) * worldToPxY;
      const x2 = (Number(to.x) - ax) * worldToPxX;
      const y2 = (Number(to.y) - ay) * worldToPxY;
      if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) continue;

      const kind = String((l as any).kind || 'arrow') === 'cable' ? 'cable' : 'arrow';
      const color = String((l as any).color || '#94a3b8');
      const widthWorld = Number((l as any).width || (kind === 'cable' ? 3 : 2)) || (kind === 'cable' ? 3 : 2);
      const dash = (l as any).dashed ? [Math.max(4, Math.round(8 * worldToPx)), Math.max(3, Math.round(6 * worldToPx))] : null;
      const route = ((l as any).route || 'vh') as 'vh' | 'hv';

      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = Math.max(1, widthWorld * worldToPx);
      if (dash) ctx.setLineDash(dash);
      else ctx.setLineDash([]);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (kind === 'cable') {
        const pts =
          route === 'hv'
            ? [x1, y1, x2, y1, x2, y2]
            : [x1, y1, x1, y2, x2, y2];
        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
        ctx.stroke();

        const label = String((l as any).name || (l as any).label || '').trim();
        if (label) {
          // find mid point along polyline
          let total = 0;
          for (let i = 0; i < pts.length - 2; i += 2) total += Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]);
          const half = total / 2;
          let acc = 0;
          let mx = (x1 + x2) / 2;
          let my = (y1 + y2) / 2;
          for (let i = 0; i < pts.length - 2; i += 2) {
            const sx = pts[i];
            const sy = pts[i + 1];
            const ex = pts[i + 2];
            const ey = pts[i + 3];
            const seg = Math.hypot(ex - sx, ey - sy);
            if (acc + seg >= half) {
              const t = seg ? (half - acc) / seg : 0;
              mx = sx + (ex - sx) * t;
              my = sy + (ey - sy) * t;
              break;
            }
            acc += seg;
          }
          ctx.save();
          ctx.setLineDash([]);
          ctx.fillStyle = '#0f172a';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const fs = Math.max(8, Math.round(11 * worldToPx));
          ctx.font = `bold ${fs}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`;
          ctx.fillText(label, mx, my - fs);
          ctx.restore();
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
        drawArrowHead(x1, y1, x2, y2, Math.max(6, Math.round(8 * worldToPx)));
      }

      ctx.restore();
    }
  }

  if (opts.includeObjects) {
    const iconCache = new Map<string, HTMLImageElement>();
    const getIconImg = async (typeId: string) => {
      const iconName = opts.objectTypeIcons?.[typeId];
      if (!iconName) return null;
      if (iconCache.has(iconName)) return iconCache.get(iconName) || null;
      try {
        const ii = await svgIconToImage(iconName, { size: 18, color: '#2563eb', strokeWidth: 1.8 });
        iconCache.set(iconName, ii);
        return ii;
      } catch {
        iconCache.set(iconName, null as any);
        return null;
      }
    };

    const objects = (plan.objects || []) as any[];
    for (const obj of objects) {
      const cx = (Number(obj.x) - ax) * worldToPxX;
      const cy = (Number(obj.y) - ay) * worldToPxY;
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
      if (cx < -200 || cy < -200 || cx > outW + 200 || cy > outH + 200) continue;

      const oScale = Number(obj.scale ?? 1) || 1;
      const markerSize = 36 * worldToPx * oScale;
      const iconSize = 18 * worldToPx * oScale;
      const corner = 12 * worldToPx * oScale;

      // label (same logic as CanvasStage)
      const labelText =
        obj.type === 'real_user' && (((obj as any).firstName && String((obj as any).firstName).trim()) || ((obj as any).lastName && String((obj as any).lastName).trim()))
          ? `${String((obj as any).firstName || '').trim()}\n${String((obj as any).lastName || '').trim()}`.trim()
          : String(obj.name || '');
      const lines = labelText.split('\n').slice(0, 2);
      const labelLines = lines.length;

      const labelX = cx;
      const labelLineHeight = 1.2;
      const fontSize = 10 * worldToPx * oScale;
      const fontPx = Math.max(4, Math.round(fontSize));
      const lineH = Math.max(6, Math.round(fontPx * labelLineHeight));
      const textH = labelLines * lineH;
      const gapPx = Math.max(3, Math.round(6 * worldToPx));
      const labelY = cy - 18 * worldToPx * oScale - gapPx - textH;
      ctx.save();
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = `bold ${fontPx}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`;
      for (let i = 0; i < lines.length; i += 1) {
        ctx.fillText(lines[i], labelX, labelY + i * lineH);
      }
      ctx.restore();

      // marker background
      const half = markerSize / 2;
      ctx.save();
      drawRoundRect(ctx, cx - half, cy - half, markerSize, markerSize, corner);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = Math.max(1, 2 * worldToPx);
      ctx.stroke();
      ctx.restore();

      // icon
      const icon = await getIconImg(String(obj.type || ''));
      if (icon) {
        const ih = iconSize;
        const iw = iconSize;
        ctx.drawImage(icon, cx - iw / 2, cy - ih / 2, iw, ih);
      } else {
        ctx.save();
        ctx.fillStyle = '#2563eb';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${Math.max(10, Math.round(15 * worldToPx * oScale))}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`;
        ctx.fillText('?', cx, cy);
        ctx.restore();
      }
    }
  }

  const jpegQ = clamp(opts.jpegQuality || 0.9, 0.5, 0.95);
  return { dataUrl: canvas.toDataURL('image/jpeg', jpegQ), width: outW, height: outH };
};

export const exportPlansToPdf = async (
  plans: { breadcrumb: string; clientName?: string; clientLogoUrl?: string; plan: FloorPlan }[],
  options: {
    includeIndex?: boolean;
    includeObjects?: boolean;
    includeLinks?: boolean;
    includeRooms?: boolean;
    objectTypeIcons?: Record<string, IconName | undefined>;
    jpegQuality?: number;
    targetLongPx?: number;
    filename?: string;
  } = {}
) => {
  const includeIndex = options.includeIndex ?? true;
  const filename = options.filename || `deskly_print_${new Date().toISOString().slice(0, 10)}.pdf`;
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
      includeLinks: options.includeLinks ?? true,
      includeRooms: options.includeRooms ?? true,
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
    // Load Deskly logo (best effort) for the first page
    let desklyLogo: string | null = null;
    try {
      const img = await loadImage('/favicon.svg');
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
        pdf.text('Deskly', margin + 14 + (desklyLogo ? logoSize + 10 : 0), margin + 38);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11);
        pdf.setTextColor(51, 65, 85); // slate-700
        pdf.text('PDF Export', margin + 14 + (desklyLogo ? logoSize + 10 : 0), margin + 56);

        const generatedOn = new Date().toISOString().slice(0, 10);
        const optsLine = [
          options.includeObjects ?? true ? 'Objects' : null,
          options.includeLinks ?? true ? 'Links' : null,
          options.includeRooms ?? true ? 'Rooms' : null
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
