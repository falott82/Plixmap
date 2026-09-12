import type { PlanRenderContext } from './context';
import { clamp, drawRoundRect, svgIconToImage } from './helpers';
import { isDeskType } from '../../components/plan/deskTypes';
import { isSecurityTypeId } from '../../store/security';
import { loadImage } from '../pdfShared';

export const drawObjects = async (rc: PlanRenderContext): Promise<void> => {
  const { plan, opts, ctx, ax, ay, outW, outH, worldToPxX, worldToPxY, worldToPx, isWallObject } = rc;
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
};
