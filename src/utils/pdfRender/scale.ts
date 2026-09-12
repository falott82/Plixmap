import type { PlanRenderContext } from './context';
import { clamp, drawRoundRect } from './helpers';

export const drawScale = (rc: PlanRenderContext): void => {
  const scale = rc.plan.scale;
  if (!scale?.start || !scale?.end) return;
  const { ctx, ax, ay, worldToPxX, worldToPxY, worldToPx } = rc;
  const start = scale.start;
  const end = scale.end;
  const x1 = (Number(start.x) - ax) * worldToPxX;
  const y1 = (Number(start.y) - ay) * worldToPxY;
  const x2 = (Number(end.x) - ax) * worldToPxX;
  const y2 = (Number(end.y) - ay) * worldToPxY;
  if (Number.isFinite(x1) && Number.isFinite(y1) && Number.isFinite(x2) && Number.isFinite(y2)) {
    const scaleOpacity = clamp(Number(scale.opacity ?? 1) || 1, 0.2, 1);
    const labelScale = clamp(Number(scale.labelScale ?? 1) || 1, 0.2, 2);
    const strokeWidth = Math.max(1, (Number(scale.strokeWidth ?? 1.2) || 1.2) * worldToPx);
    const meters = Number(scale.meters);
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
};
