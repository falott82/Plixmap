import type { PlanRenderContext } from './context';
import { clamp, drawRoundRect } from './helpers';

export const drawQuotes = (rc: PlanRenderContext): void => {
  const { plan, ctx, ax, ay, worldToPxX, worldToPxY, worldToPx, drawArrowHead } = rc;
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
};
