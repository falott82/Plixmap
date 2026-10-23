import type { PlanRenderContext } from './context';

export const drawRooms = (rc: PlanRenderContext): void => {
  const { plan, ctx, ax, ay, worldToPxX, worldToPxY, worldToPx } = rc;
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
};
