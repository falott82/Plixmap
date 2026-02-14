import jsPDF from 'jspdf';
import { createElement } from 'react';
import html2canvas from 'html2canvas';
import { renderToStaticMarkup } from 'react-dom/server';
import { FloorPlan, IconName, MapObject } from '../store/types';
import { WALL_LAYER_COLOR, WALL_TYPE_IDS } from '../store/data';
import { ReleaseNote } from '../version/history';
import Icon from '../components/ui/Icon';
import { sanitizeHtmlBasic } from './sanitizeHtml';
import { isDeskType } from '../components/plan/deskTypes';
import { isSecurityTypeId } from '../store/security';

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
    includeDesks?: boolean;
    includeSafety?: boolean;
    includeLinks?: boolean;
    includeRooms?: boolean;
    includeWalls?: boolean;
    includeQuotes?: boolean;
    includeScale?: boolean;
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

  if (opts.includeWalls) {
    const walls = (plan.objects || []).filter((o) => isWallObject(o));
    for (const wall of walls) {
      const pts = Array.isArray(wall.points) ? wall.points : [];
      if (pts.length < 2) continue;
      const stroke = String((wall as any).strokeColor || WALL_LAYER_COLOR);
      const opacity = clamp(Number((wall as any).opacity ?? 1) || 1, 0.1, 1);
      const widthWorld = Number((wall as any).strokeWidth ?? 1) || 1;
      ctx.save();
      ctx.strokeStyle = stroke;
      ctx.globalAlpha = opacity;
      ctx.lineWidth = Math.max(1, widthWorld * worldToPx);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < pts.length; i += 1) {
        const px = (Number(pts[i].x) - ax) * worldToPxX;
        const py = (Number(pts[i].y) - ay) * worldToPxY;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  if (opts.includeQuotes) {
    const quotes = (plan.objects || []).filter((o) => o.type === 'quote');
    const metersPerPixel = Number(plan.scale?.metersPerPixel);
    for (const quote of quotes) {
      const pts = Array.isArray(quote.points) ? quote.points : [];
      if (pts.length < 2) continue;
      const start = pts[0];
      const end = pts[pts.length - 1];
      const scale = clamp(Number((quote as any).scale ?? 1) || 1, 0.5, 1.6);
      const labelScale = clamp(Number((quote as any).quoteLabelScale ?? 1) || 1, 0.6, 2);
      const stroke = String((quote as any).strokeColor || '#f97316');
      const opacity = clamp(Number((quote as any).opacity ?? 1) || 1, 0.2, 1);
      const strokeWidth = Math.max(1, (Number((quote as any).strokeWidth ?? 2) || 2) * scale * worldToPx);
      const dashed = !!(quote as any).quoteDashed;
      const endpoint = String((quote as any).quoteEndpoint || 'arrows');
      const x1 = (Number(start.x) - ax) * worldToPxX;
      const y1 = (Number(start.y) - ay) * worldToPxY;
      const x2 = (Number(end.x) - ax) * worldToPxX;
      const y2 = (Number(end.y) - ay) * worldToPxY;
      if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) continue;
      ctx.save();
      ctx.strokeStyle = stroke;
      ctx.fillStyle = stroke;
      ctx.globalAlpha = opacity;
      ctx.lineWidth = strokeWidth;
      if (dashed) ctx.setLineDash([8 * scale, 6 * scale]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
      const headSize = Math.max(4, Math.round(5 * scale * worldToPx));
      if (endpoint === 'arrows') {
        drawArrowHead(x1, y1, x2, y2, headSize);
        drawArrowHead(x2, y2, x1, y1, headSize);
      } else if (endpoint === 'dots') {
        ctx.beginPath();
        ctx.arc(x1, y1, Math.max(2, Math.round(3 * scale * worldToPx)), 0, Math.PI * 2);
        ctx.arc(x2, y2, Math.max(2, Math.round(3 * scale * worldToPx)), 0, Math.PI * 2);
        ctx.fill();
      }

      const lengthPx = Math.hypot(end.x - start.x, end.y - start.y);
      const label =
        Number.isFinite(metersPerPixel) && metersPerPixel > 0
          ? `${(lengthPx * metersPerPixel).toFixed(2)} m`
          : `${Math.round(lengthPx)} px`;
      const fontSize = Math.max(8, Math.round(9 * labelScale * worldToPx));
      const padding = Math.max(6, Math.round(8 * labelScale * worldToPx));
      const textW = Math.max(20, label.length * fontSize * 0.6 + padding);
      const textH = Math.max(12, Math.round(14 * labelScale * worldToPx));
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const orientation = Math.abs(y2 - y1) > Math.abs(x2 - x1) ? 'vertical' : 'horizontal';
      const labelPos = String((quote as any).quoteLabelPos || 'center');
      const labelBg = labelPos === 'center' || (quote as any).quoteLabelBg === true;
      const labelColor = String((quote as any).quoteLabelColor || '#0f172a');
      const labelOffsetRaw = Number((quote as any).quoteLabelOffset);
      const labelOffsetFactor = Number.isFinite(labelOffsetRaw) && labelOffsetRaw > 0 ? labelOffsetRaw : null;
      const baseOffset = Math.max(6, Math.round(6 * labelScale * worldToPx));
      const perpSize = orientation === 'vertical' ? textW : textH;
      const sideFactor = orientation === 'vertical' && (labelPos === 'left' || labelPos === 'right') ? 0.2 : 0.5;
      const defaultFactor =
        orientation === 'horizontal' && labelPos === 'below'
          ? 1.15
          : 1;
      const offset = (baseOffset + perpSize / 2) * sideFactor * (labelOffsetFactor ?? defaultFactor);
      let offsetX = 0;
      let offsetY = 0;
      if (orientation === 'vertical') {
        if (labelPos === 'left') offsetX = -offset;
        if (labelPos === 'right') offsetX = offset;
      } else {
        if (labelPos === 'above') offsetY = -offset;
        if (labelPos === 'below') offsetY = offset;
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = opacity;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.save();
      ctx.translate(midX + offsetX, midY + offsetY);
      if (orientation === 'vertical') ctx.rotate(-Math.PI / 2);
      if (labelBg) {
        drawRoundRect(ctx, -textW / 2, -textH / 2, textW, textH, Math.max(3, Math.round(4 * labelScale)));
        ctx.fill();
      }
      ctx.fillStyle = labelColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`;
      ctx.fillText(label, 0, 0);
      ctx.restore();
      ctx.restore();
    }
  }

  if (opts.includeLinks) {
    const objectsById = new Map<string, MapObject>((plan.objects || []).map((o) => [o.id, o]));
    const links = ((plan as any).links || []) as any[];

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
      const arrowMode = (l as any).arrow ?? 'none';
      const arrowStart = arrowMode === 'start' || arrowMode === 'both';
      const arrowEnd = arrowMode === 'end' || arrowMode === 'both';
      const color = String((l as any).color || '#94a3b8');
      const widthRaw = Number((l as any).width);
      const widthWorld = Number.isFinite(widthRaw) && widthRaw > 0 ? widthRaw : 1;
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
        const headSize = Math.max(6, Math.round(8 * worldToPx));
        if (arrowEnd) drawArrowHead(x1, y1, x2, y2, headSize);
        if (arrowStart) drawArrowHead(x2, y2, x1, y1, headSize);
      }

      ctx.restore();
    }
  }

  if (opts.includeObjects) {
    const includeDesks = opts.includeDesks ?? true;
    const includeSafety = opts.includeSafety ?? true;
    const iconCache = new Map<string, HTMLImageElement>();
    const imageCache = new Map<string, HTMLImageElement>();
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
    const getObjectImage = async (src: string) => {
      if (!src) return null;
      if (imageCache.has(src)) return imageCache.get(src) || null;
      try {
        const img = await loadImage(src);
        imageCache.set(src, img);
        return img;
      } catch {
        imageCache.set(src, null as any);
        return null;
      }
    };

    const objects = (plan.objects || []).filter((o: any) => {
      if (isWallObject(o) || o.type === 'quote') return false;
      if (!includeDesks && isDeskType(o.type)) return false;
      if (!includeSafety && isSecurityTypeId(o.type)) return false;
      return true;
    }) as any[];
    for (const obj of objects) {
      const cx = (Number(obj.x) - ax) * worldToPxX;
      const cy = (Number(obj.y) - ay) * worldToPxY;
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
      if (cx < -200 || cy < -200 || cx > outW + 200 || cy > outH + 200) continue;

      const baseScale = Number(obj.scale ?? 1) || 1;
      const objectOpacity = typeof obj.opacity === 'number' ? Math.max(0.2, Math.min(1, obj.opacity)) : 1;
      const isDesk = isDeskType(String(obj.type || ''));
      const isText = obj.type === 'text';
      const isImage = obj.type === 'image';
      const oScale = isText || isImage ? 1 : baseScale;
      const markerSize = 36 * worldToPx * oScale;
      const iconSize = 18 * worldToPx * oScale;
      const corner = 12 * worldToPx * oScale;

      if (isText) {
        const textValue = String(obj.name || '');
        const textLines = textValue ? textValue.split('\n') : [''];
        const textFont = (obj as any).textFont || 'Arial, sans-serif';
        const textSizeRaw = Number((obj as any).textSize ?? 18) || 18;
        const textBg = (obj as any).textBg !== false;
        const textBgColor = (obj as any).textBgColor || '#ffffff';
        const textScaleX = Number(obj.scaleX ?? 1) || 1;
        const textScaleY = Number(obj.scaleY ?? 1) || 1;
        const rotation = (Number(obj.rotation || 0) * Math.PI) / 180;
        const fontPx = Math.max(6, Math.round(textSizeRaw * worldToPx * oScale));
        const lineH = fontPx * 1.2;
        const totalH = textLines.length * lineH;
        const textPadding = Math.max(4, Math.round(fontPx * 0.35));
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation);
        ctx.scale(textScaleX, textScaleY);
        ctx.globalAlpha = objectOpacity;
        ctx.fillStyle = (obj as any).textColor || '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${fontPx}px ${textFont}`;
        if (textBg) {
          const widths = textLines.map((line) => ctx.measureText(line).width);
          const maxW = widths.length ? Math.max(...widths) : 0;
          const bgW = maxW + textPadding * 2;
          const bgH = totalH + textPadding * 2;
          ctx.fillStyle = textBgColor;
          drawRoundRect(ctx, -bgW / 2, -bgH / 2, bgW, bgH, Math.max(4, Math.round(fontPx * 0.25)));
          ctx.fill();
          ctx.fillStyle = (obj as any).textColor || '#000000';
        }
        const startY = -totalH / 2 + lineH / 2;
        for (let i = 0; i < textLines.length; i += 1) {
          ctx.fillText(textLines[i], 0, startY + i * lineH);
        }
        ctx.restore();
        continue;
      }

      if (isImage) {
        const src = String((obj as any).imageUrl || '');
        const img = src ? await getObjectImage(src) : null;
        const baseW = Number((obj as any).imageWidth ?? 160) || 160;
        const baseH = Number((obj as any).imageHeight ?? 120) || 120;
        const drawW = baseW * worldToPx * oScale;
        const drawH = baseH * worldToPx * oScale;
        const imgScaleX = Number(obj.scaleX ?? 1) || 1;
        const imgScaleY = Number(obj.scaleY ?? 1) || 1;
        const rotation = (Number(obj.rotation || 0) * Math.PI) / 180;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation);
        ctx.scale(imgScaleX, imgScaleY);
        ctx.globalAlpha = objectOpacity;
        if (img) {
          ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        } else {
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = Math.max(1, worldToPx);
          ctx.setLineDash([6 * worldToPx, 4 * worldToPx]);
          ctx.strokeRect(-drawW / 2, -drawH / 2, drawW, drawH);
          ctx.setLineDash([]);
        }
        ctx.restore();
        continue;
      }

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

      if (isDesk) {
        const deskScaleX = Number(obj.scaleX ?? 1) || 1;
        const deskScaleY = Number(obj.scaleY ?? 1) || 1;
        const baseDeskSize = 38 * worldToPx * oScale;
        const deskSizeX = baseDeskSize * deskScaleX;
        const deskSizeY = baseDeskSize * deskScaleY;
        const deskHalfX = deskSizeX / 2;
        const deskHalfY = deskSizeY / 2;
        const deskThicknessX = 12 * worldToPx * oScale * deskScaleX;
        const deskThicknessY = 12 * worldToPx * oScale * deskScaleY;
        const deskRectW = baseDeskSize * 1.45 * deskScaleX;
        const deskRectH = baseDeskSize * 0.75 * deskScaleY;
        const deskLongW = baseDeskSize * 1.85 * deskScaleX;
        const deskLongH = baseDeskSize * 0.6 * deskScaleY;
        const deskDoubleW = baseDeskSize * 0.7 * deskScaleX;
        const deskDoubleH = baseDeskSize * 0.95 * deskScaleY;
        const deskDoubleGap = 4 * worldToPx * oScale * deskScaleX;
        const deskTrapTop = baseDeskSize * 0.75 * deskScaleX;
        const deskTrapBottom = baseDeskSize * 1.15 * deskScaleX;
        const deskTrapHeight = baseDeskSize * 0.75 * deskScaleY;
        const deskStrokeWidth = clamp(Number(obj.strokeWidth ?? 2) || 2, 0.5, 6) * worldToPx;
        const deskStrokeColor =
          typeof obj.strokeColor === 'string' && String(obj.strokeColor).trim()
            ? String(obj.strokeColor).trim()
            : '#cbd5e1';
        const rotation = (Number(obj.rotation || 0) * Math.PI) / 180;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation);
        ctx.globalAlpha = objectOpacity;
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = deskStrokeColor;
        ctx.lineWidth = Math.max(0.5, deskStrokeWidth);

        if (obj.type === 'desk_round') {
          ctx.beginPath();
          ctx.ellipse(0, 0, deskHalfX, deskHalfY, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (obj.type === 'desk_square') {
          drawRoundRect(ctx, -deskHalfX, -deskHalfY, deskSizeX, deskSizeY, 6 * worldToPx * oScale * Math.min(deskScaleX, deskScaleY));
          ctx.fill();
          ctx.stroke();
        } else if (obj.type === 'desk_rect') {
          drawRoundRect(ctx, -deskRectW / 2, -deskRectH / 2, deskRectW, deskRectH, 6 * worldToPx * oScale * Math.min(deskScaleX, deskScaleY));
          ctx.fill();
          ctx.stroke();
        } else if (obj.type === 'desk_double') {
          drawRoundRect(
            ctx,
            -(deskDoubleW + deskDoubleGap / 2),
            -deskDoubleH / 2,
            deskDoubleW,
            deskDoubleH,
            6 * worldToPx * oScale * Math.min(deskScaleX, deskScaleY)
          );
          ctx.fill();
          ctx.stroke();
          drawRoundRect(
            ctx,
            deskDoubleGap / 2,
            -deskDoubleH / 2,
            deskDoubleW,
            deskDoubleH,
            6 * worldToPx * oScale * Math.min(deskScaleX, deskScaleY)
          );
          ctx.fill();
          ctx.stroke();
        } else if (obj.type === 'desk_long') {
          drawRoundRect(
            ctx,
            -deskLongW / 2,
            -deskLongH / 2,
            deskLongW,
            deskLongH,
            6 * worldToPx * oScale * Math.min(deskScaleX, deskScaleY)
          );
          ctx.fill();
          ctx.stroke();
        } else if (obj.type === 'desk_trap') {
          ctx.beginPath();
          ctx.moveTo(-deskTrapTop / 2, -deskTrapHeight / 2);
          ctx.lineTo(deskTrapTop / 2, -deskTrapHeight / 2);
          ctx.lineTo(deskTrapBottom / 2, deskTrapHeight / 2);
          ctx.lineTo(-deskTrapBottom / 2, deskTrapHeight / 2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (obj.type === 'desk_l') {
          ctx.beginPath();
          ctx.rect(-deskHalfX, deskHalfY - deskThicknessY, deskSizeX, deskThicknessY);
          ctx.rect(-deskHalfX, -deskHalfY, deskThicknessX, deskSizeY);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.rect(-deskHalfX, deskHalfY - deskThicknessY, deskSizeX, deskThicknessY);
          ctx.rect(deskHalfX - deskThicknessX, -deskHalfY, deskThicknessX, deskSizeY);
          ctx.fill();
          ctx.stroke();
        }

        ctx.restore();
      } else {
        // marker background
        const half = markerSize / 2;
        ctx.save();
        ctx.globalAlpha = objectOpacity;
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
          ctx.save();
          ctx.globalAlpha = objectOpacity;
          ctx.drawImage(icon, cx - iw / 2, cy - ih / 2, iw, ih);
          ctx.restore();
        } else {
          ctx.save();
          ctx.globalAlpha = objectOpacity;
          ctx.fillStyle = '#2563eb';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = `bold ${Math.max(10, Math.round(15 * worldToPx * oScale))}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`;
          ctx.fillText('?', cx, cy);
          ctx.restore();
        }
      }
    }
  }

  if (opts.includeScale && plan.scale?.start && plan.scale?.end) {
    const start = plan.scale.start;
    const end = plan.scale.end;
    const x1 = (Number(start.x) - ax) * worldToPxX;
    const y1 = (Number(start.y) - ay) * worldToPxY;
    const x2 = (Number(end.x) - ax) * worldToPxX;
    const y2 = (Number(end.y) - ay) * worldToPxY;
    if (Number.isFinite(x1) && Number.isFinite(y1) && Number.isFinite(x2) && Number.isFinite(y2)) {
      const scaleOpacity = clamp(Number(plan.scale.opacity ?? 1) || 1, 0.2, 1);
      const labelScale = clamp(Number(plan.scale.labelScale ?? 1) || 1, 0.2, 2);
      const strokeWidth = Math.max(1, (Number(plan.scale.strokeWidth ?? 1.2) || 1.2) * worldToPx);
      const meters = Number(plan.scale.meters);
      const label = Number.isFinite(meters) ? `${meters.toFixed(2)} m` : '';

      ctx.save();
      ctx.globalAlpha = scaleOpacity;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      const dotSize = Math.max(2, Math.round(3 * worldToPx));
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(x1, y1, dotSize, 0, Math.PI * 2);
      ctx.arc(x2, y2, dotSize, 0, Math.PI * 2);
      ctx.fill();
      if (label) {
        const fontSize = Math.max(8, Math.round(9 * labelScale * worldToPx));
        const padding = Math.max(6, Math.round(8 * labelScale * worldToPx));
        const textW = Math.max(24, label.length * fontSize * 0.6 + padding);
        const textH = Math.max(12, Math.round(12 * labelScale * worldToPx));
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2 - textH * 0.8;
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        drawRoundRect(ctx, midX - textW / 2, midY - textH / 2, textW, textH, Math.max(3, Math.round(4 * labelScale)));
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`;
        ctx.fillText(label, midX, midY);
      }
      ctx.restore();
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
    includeDesks?: boolean;
    includeSafety?: boolean;
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
      includeDesks: options.includeDesks ?? true,
      includeSafety: options.includeSafety ?? true,
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
        const includeObjects = options.includeObjects ?? true;
        const includeDesks = options.includeDesks ?? true;
        const includeSafety = options.includeSafety ?? true;
        const optsLine = [
          includeObjects ? 'Objects' : null,
          includeObjects && includeDesks ? 'Desks' : null,
          includeObjects && includeSafety ? 'Safety' : null,
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

export const exportClientNotesToPdf = async (params: {
  clientLabel: string;
  notesHtml: string;
  lang?: 'it' | 'en';
  filename?: string;
}) => {
  const lang = params.lang === 'en' ? 'en' : 'it';
  const filename = params.filename || `deskly_client_notes_${new Date().toISOString().slice(0, 10)}.pdf`;

  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-10000px';
  wrapper.style.top = '0';
  wrapper.style.width = '794px'; // ~A4 at 96dpi
  wrapper.style.background = '#ffffff';
  wrapper.style.color = '#0f172a';
  wrapper.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'";
  wrapper.style.padding = '28px';

  const safeHtml = sanitizeHtmlBasic(String(params.notesHtml || ''));
  const date = new Date().toISOString().slice(0, 10);

  // Load Deskly logo (best effort) for the header
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
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      desklyLogo = c.toDataURL('image/png');
    }
  } catch {
    desklyLogo = null;
  }

  const style = document.createElement('style');
  style.textContent = `
    .deskly-notes h1,.deskly-notes h2,.deskly-notes h3{font-weight:700;color:#0f172a;margin:14px 0 8px}
    .deskly-notes p{margin:8px 0;line-height:1.45}
    .deskly-notes ul,.deskly-notes ol{margin:8px 0 8px 18px}
    .deskly-notes table{border-collapse:collapse;width:100%;margin:10px 0}
    .deskly-notes th,.deskly-notes td{border:1px solid #cbd5e1;padding:6px;vertical-align:top}
    .deskly-notes th{background:#f8fafc}
    .deskly-notes img{max-width:100%;height:auto;border-radius:8px}
    .deskly-list{margin:8px 0}
    .deskly-list-item{display:flex;gap:8px;align-items:flex-start}
    .deskly-list-marker{min-width:18px;white-space:nowrap;font-weight:700;color:#334155;line-height:1.45}
    .deskly-list-body{flex:1;min-width:0}
    .deskly-card{background:#f1f5f9;border-radius:14px;padding:14px 16px;display:flex;gap:12px;align-items:center}
    .deskly-title{font-size:22px;font-weight:800;line-height:1}
    .deskly-sub{font-size:12px;color:#475569;margin-top:4px}
    .deskly-meta{margin-left:auto;text-align:right;font-size:11px;color:#475569;white-space:nowrap}
    .deskly-meta strong{color:#0f172a}
  `;
  wrapper.appendChild(style);

  const header = document.createElement('div');
  header.className = 'deskly-card';
  header.innerHTML = `
    ${desklyLogo ? `<img src="${desklyLogo}" style="width:30px;height:30px" />` : ''}
    <div>
      <div class="deskly-title">Deskly</div>
      <div class="deskly-sub">${lang === 'en' ? 'Client notes' : 'Note cliente'}</div>
    </div>
    <div class="deskly-meta">
      <div><strong>${params.clientLabel || ''}</strong></div>
      <div>${lang === 'en' ? 'Generated on' : 'Generato il'} ${date}</div>
    </div>
  `;
  wrapper.appendChild(header);

  const content = document.createElement('div');
  content.className = 'deskly-notes';
  content.style.marginTop = '18px';
  content.innerHTML = safeHtml || `<p style="color:#64748b">${lang === 'en' ? '(No notes)' : '(Nessuna nota)'}</p>`;
  wrapper.appendChild(content);

  // html2canvas often does not render list markers; normalize lists into explicit marker blocks.
  const normalizeListsForCanvas = () => {
    const normalize = (list: HTMLOListElement | HTMLUListElement, level: number) => {
      const isOrdered = list.tagName === 'OL';
      const wrapper = document.createElement('div');
      wrapper.className = 'deskly-list';
      if (level > 0) wrapper.style.paddingLeft = `${Math.min(64, level * 14)}px`;

      let idx = isOrdered ? Number((list as HTMLOListElement).start || 1) || 1 : 1;
      const children = Array.from(list.children) as HTMLElement[];
      for (const child of children) {
        if (child.tagName !== 'LI') continue;
        const li = child as HTMLLIElement;

        // Normalize nested lists first (direct children of this LI).
        const nested = Array.from(li.children).filter((n) => n.tagName === 'OL' || n.tagName === 'UL') as (
          | HTMLOListElement
          | HTMLUListElement
        )[];
        for (const n of nested) normalize(n, level + 1);

        const valueAttr = isOrdered ? Number(li.getAttribute('value') || '') : NaN;
        const markerValue = isOrdered ? (Number.isFinite(valueAttr) ? valueAttr : idx) : NaN;
        const markerText = isOrdered ? `${markerValue}.` : '•';
        if (isOrdered) idx = Number.isFinite(valueAttr) ? valueAttr + 1 : idx + 1;

        const item = document.createElement('div');
        item.className = 'deskly-list-item';

        const marker = document.createElement('div');
        marker.className = 'deskly-list-marker';
        marker.textContent = `${markerText} `;

        const body = document.createElement('div');
        body.className = 'deskly-list-body';

        while (li.firstChild) body.appendChild(li.firstChild);
        item.appendChild(marker);
        item.appendChild(body);
        wrapper.appendChild(item);
      }

      list.replaceWith(wrapper);
    };

    const roots = Array.from(content.querySelectorAll('ol,ul')) as (HTMLOListElement | HTMLUListElement)[];
    // Normalize only top-level lists (nested lists are handled recursively).
    const topLevel = roots.filter((l) => !l.parentElement || (l.parentElement.tagName !== 'LI' && l.parentElement.tagName !== 'OL' && l.parentElement.tagName !== 'UL'));
    for (const l of topLevel) normalize(l, 0);
  };
  normalizeListsForCanvas();

  document.body.appendChild(wrapper);

  try {
    const canvas = await html2canvas(wrapper, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
    const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4', compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 28;
    const usableW = pageWidth - margin * 2;
    const usableH = pageHeight - margin * 2;

    // Convert canvas px → pdf points preserving aspect ratio.
    const imgWPt = usableW;
    const pxToPt = imgWPt / canvas.width;
    const sliceHeightPx = Math.max(1, Math.floor(usableH / pxToPt));

    let page = 1;
    for (let sy = 0; sy < canvas.height; sy += sliceHeightPx) {
      const sh = Math.min(sliceHeightPx, canvas.height - sy);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sh;
      const sctx = slice.getContext('2d');
      if (!sctx) break;
      sctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);
      const dataUrl = slice.toDataURL('image/jpeg', 0.9);
      const imgHPt = sh * pxToPt;

      if (page > 1) pdf.addPage();
      pdf.addImage(dataUrl, 'JPEG', margin, margin, imgWPt, imgHPt, undefined, 'FAST');

      // Page number
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(120);
      const label = `${page}`;
      pdf.text(label, (pageWidth - pdf.getTextWidth(label)) / 2, pageHeight - margin + 10);
      pdf.setTextColor(0);
      page++;
    }

    pdf.save(filename);
  } finally {
    wrapper.remove();
  }
};

export const exportClientIpMapToPdf = (params: {
  clientName: string;
  entries: Array<{
    ip: string;
    name: string;
    type: string;
    url?: string;
    site: string;
    plan: string;
  }>;
  filename?: string;
}) => {
  const filename = params.filename || `deskly_ip_map_${new Date().toISOString().slice(0, 10)}.pdf`;
  const pdf = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4', compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 28;
  const tableWidth = pageWidth - margin * 2;
  const headerHeight = 22;
  const rowPadding = 5;
  const lineHeight = 12;

  const cols = [
    { key: 'ip', label: 'IP', ratio: 0.12 },
    { key: 'name', label: 'Device', ratio: 0.22 },
    { key: 'type', label: 'Type', ratio: 0.13 },
    { key: 'site', label: 'Site', ratio: 0.16 },
    { key: 'plan', label: 'Floor plan', ratio: 0.16 },
    { key: 'url', label: 'URL', ratio: 0.21 }
  ];
  const colWidths = cols.map((c) => Math.floor(c.ratio * tableWidth));
  const colX = colWidths.reduce<number[]>((acc, _w, idx) => {
    if (idx === 0) return [margin];
    acc.push(acc[idx - 1] + colWidths[idx - 1]);
    return acc;
  }, []);

  let y = margin;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text(`Deskly — IP Map`, margin, y + 12);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(90);
  pdf.text(params.clientName || '', margin, y + 28);
  pdf.setTextColor(0);
  y += 42;

  const drawHeader = () => {
    pdf.setFillColor(248, 250, 252);
    pdf.rect(margin, y, tableWidth, headerHeight, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    for (let i = 0; i < cols.length; i += 1) {
      const x = colX[i] + rowPadding;
      pdf.text(cols[i].label, x, y + 14);
    }
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setDrawColor(226, 232, 240);
    pdf.rect(margin, y, tableWidth, headerHeight);
    y += headerHeight;
  };

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - margin) return;
    pdf.addPage();
    y = margin;
    drawHeader();
  };

  drawHeader();

  const rows = params.entries || [];
  for (const row of rows) {
    const cells = [row.ip, row.name, row.type, row.site, row.plan, row.url || ''];
    const linesByCol = cells.map((cell, i) => {
      const safe = String(cell || '');
      const maxWidth = Math.max(10, colWidths[i] - rowPadding * 2);
      return pdf.splitTextToSize(safe, maxWidth);
    });
    const rowHeight = Math.max(...linesByCol.map((lines) => lines.length)) * lineHeight + rowPadding * 2;
    ensureSpace(rowHeight);

    for (let i = 0; i < cols.length; i += 1) {
      const lines = linesByCol[i];
      const x = colX[i] + rowPadding;
      let textY = y + rowPadding + lineHeight;
      for (const line of lines) {
        pdf.text(line, x, textY);
        textY += lineHeight;
      }
    }
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, y + rowHeight, margin + tableWidth, y + rowHeight);
    y += rowHeight;
  }

  pdf.save(filename);
};

export const exportClientDirectoryToPdf = (params: {
  clientName: string;
  groupBy: 'dept' | 'surname';
  rows: Array<{
    lastName: string;
    firstName: string;
    role: string;
    dept: string;
    email: string;
    mobile: string;
    ext: string;
  }>;
  filename?: string;
}) => {
  const filename = params.filename || `deskly_rubrica_${new Date().toISOString().slice(0, 10)}.pdf`;
  const pdf = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4', compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 28;
  const tableWidth = pageWidth - margin * 2;
  const headerHeight = 18;
  const groupHeight = 18;
  const rowPadding = 5;
  const lineHeight = 9;

  const cols = [
    { key: 'lastName', label: 'Cognome', ratio: 0.16 },
    { key: 'firstName', label: 'Nome', ratio: 0.14 },
    { key: 'role', label: 'Ruolo', ratio: 0.18 },
    { key: 'dept', label: 'Reparto', ratio: 0.18 },
    { key: 'email', label: 'Email', ratio: 0.2 },
    { key: 'mobile', label: 'Cellulare', ratio: 0.1 },
    { key: 'ext', label: 'Interno', ratio: 0.04 }
  ];
  const colWidths = cols.map((c) => Math.floor(c.ratio * tableWidth));
  const colX = colWidths.reduce<number[]>((acc, _w, idx) => {
    if (idx === 0) return [margin];
    acc.push(acc[idx - 1] + colWidths[idx - 1]);
    return acc;
  }, []);

  const normalize = (value: string) => String(value || '').trim();
  const rows = (params.rows || [])
    .map((r) => ({
      lastName: normalize(r.lastName),
      firstName: normalize(r.firstName),
      role: normalize(r.role),
      dept: normalize(r.dept),
      email: normalize(r.email),
      mobile: normalize(r.mobile),
      ext: normalize(r.ext)
    }))
    .filter((r) => r.lastName || r.firstName || r.email || r.mobile || r.role || r.dept || r.ext);

  const groupKey = (row: (typeof rows)[number]) => {
    if (params.groupBy === 'dept') return row.dept || 'Senza reparto';
    const base = row.lastName || row.firstName || '#';
    const letter = base.trim().charAt(0).toUpperCase();
    return letter || '#';
  };

  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = groupKey(row);
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }
  const groupKeys = Array.from(groups.keys()).sort((a, b) => {
    if (a === 'Senza reparto') return 1;
    if (b === 'Senza reparto') return -1;
    return a.localeCompare(b, 'it', { sensitivity: 'base' });
  });

  for (const key of groupKeys) {
    groups.get(key)?.sort((a, b) => {
      const ln = a.lastName.localeCompare(b.lastName, 'it', { sensitivity: 'base' });
      if (ln !== 0) return ln;
      return a.firstName.localeCompare(b.firstName, 'it', { sensitivity: 'base' });
    });
  }

  const printedAt = new Date();
  const printedLabel = `Stampato il ${printedAt.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })}`;
  let y = margin;
  const drawPageHeader = (isFirst: boolean) => {
    const clientLabel = params.clientName || '';
    const title = clientLabel ? `${clientLabel} - Rubrica aziendale` : 'Rubrica aziendale';
    if (isFirst) {
      pdf.setFillColor(224, 242, 254);
      pdf.roundedRect(margin, y - 4, tableWidth, 46, 12, 12, 'F');
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(13.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text(title, margin + 14, y + 18);
      pdf.setFontSize(7.5);
      pdf.setTextColor(71, 85, 105);
      pdf.text(printedLabel, margin + tableWidth - pdf.getTextWidth(printedLabel) - 14, y + 18);
      pdf.setTextColor(0);
      y += 54;
    } else {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.25);
      pdf.setTextColor(30);
      if (clientLabel) pdf.text(clientLabel, margin, y + 12);
      pdf.text(printedLabel, margin + tableWidth - pdf.getTextWidth(printedLabel), y + 12);
      pdf.setTextColor(0);
      y += 28;
    }
  };

  const drawTableHeader = () => {
    pdf.setFillColor(219, 234, 254);
    pdf.rect(margin, y, tableWidth, headerHeight, 'F');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.75);
    for (let i = 0; i < cols.length; i += 1) {
      const x = colX[i] + rowPadding;
      pdf.text(cols[i].label, x, y + 14);
    }
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.75);
    pdf.setDrawColor(226, 232, 240);
    pdf.rect(margin, y, tableWidth, headerHeight);
    y += headerHeight;
  };

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - margin) return;
    pdf.addPage();
    y = margin;
    drawPageHeader(false);
    drawTableHeader();
  };

  drawPageHeader(true);
  drawTableHeader();

  for (const key of groupKeys) {
    const list = groups.get(key) || [];
    ensureSpace(groupHeight);
    pdf.setFillColor(220, 252, 231);
    pdf.roundedRect(margin, y + 1, tableWidth, groupHeight - 2, 8, 8, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(22, 101, 52);
    pdf.text(`${key} (${list.length})`, margin + 10, y + 13);
    pdf.setTextColor(0);
    y += groupHeight;

    for (const row of list) {
      const cells = [row.lastName, row.firstName, row.role, row.dept, row.email, row.mobile, row.ext];
      const linesByCol = cells.map((cell, i) => {
        const safe = String(cell || '');
        const maxWidth = Math.max(10, colWidths[i] - rowPadding * 2);
        return pdf.splitTextToSize(safe, maxWidth);
      });
      const rowHeight = Math.max(...linesByCol.map((lines) => lines.length)) * lineHeight + rowPadding * 2;
      ensureSpace(rowHeight);
      for (let i = 0; i < cols.length; i += 1) {
        const lines = linesByCol[i];
        const x = colX[i] + rowPadding;
        let textY = y + rowPadding + lineHeight;
        const isNameCol = cols[i].key === 'lastName' || cols[i].key === 'firstName';
        pdf.setFont('helvetica', isNameCol ? 'bold' : 'normal');
        pdf.setFontSize(6.75);
        for (const line of lines) {
          pdf.text(line, x, textY);
          textY += lineHeight;
        }
      }
      pdf.setDrawColor(226, 232, 240);
      pdf.line(margin, y + rowHeight, margin + tableWidth, y + rowHeight);
      y += rowHeight;
    }
  }

  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    pdf.setPage(p);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(100);
    const label = `${p}/${totalPages}`;
    pdf.text(label, pageWidth - margin - pdf.getTextWidth(label), pageHeight - margin + 8);
    pdf.setTextColor(0);
  }

  pdf.save(filename);
};
