import type { PlanRenderContext } from './context';
import type { MapObject } from '../../store/types';

export const drawLinks = (rc: PlanRenderContext): void => {
  const { plan, ctx, ax, ay, worldToPxX, worldToPxY, worldToPx, drawArrowHead } = rc;
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
};
