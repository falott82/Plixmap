import type { PlanRenderContext } from './context';
import { WALL_LAYER_COLOR } from '../../store/data';
import { clamp } from './helpers';

export const drawWalls = (rc: PlanRenderContext): void => {
  const { plan, ctx, ax, ay, worldToPxX, worldToPxY, worldToPx, isWallObject } = rc;
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
};
