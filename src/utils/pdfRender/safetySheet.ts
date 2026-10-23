import type { PlanRenderContext } from './context';
import { TEXT_FONT_OPTIONS } from '../../store/data';

export const drawSafetySheet = (rc: PlanRenderContext): void => {
  const { plan, ctx, ax, ay, outW, outH, worldToPxX, worldToPxY, worldToPx } = rc;
  const card = (plan as any).safetyCardLayout || {};
  const safetyCardFontValues = (TEXT_FONT_OPTIONS || []).map((entry) => String(entry.value || '').trim()).filter(Boolean);
  const cardX = Number.isFinite(Number(card?.x)) ? Number(card.x) : 24;
  const cardY = Number.isFinite(Number(card?.y)) ? Number(card.y) : 24;
  const cardW = Number.isFinite(Number(card?.w)) ? Math.max(220, Number(card.w)) : 420;
  const cardH = Number.isFinite(Number(card?.h)) ? Math.max(56, Number(card.h)) : 84;
  const cardFont = Number.isFinite(Number(card?.fontSize)) ? Math.max(8, Math.min(22, Number(card.fontSize))) : 10;
  const colorVariants = [
    { body: '#e0f2fe', header: '#bae6fd', border: '#0ea5e9', title: '#075985', text: '#0f172a' },
    { body: '#ecfeff', header: '#cffafe', border: '#06b6d4', title: '#0e7490', text: '#0f172a' },
    { body: '#dbeafe', header: '#bfdbfe', border: '#3b82f6', title: '#1d4ed8', text: '#0f172a' },
    { body: '#f0f9ff', header: '#e0f2fe', border: '#0284c7', title: '#0c4a6e', text: '#111827' }
  ] as const;
  const textBgVariants = ['transparent', '#ecfeff', '#dbeafe', '#e0f2fe'] as const;
  const colorIndex = Number.isFinite(Number(card?.colorIndex)) ? Math.max(0, Math.floor(Number(card.colorIndex))) : 0;
  const textBgIndex = Number.isFinite(Number(card?.textBgIndex)) ? Math.max(0, Math.floor(Number(card.textBgIndex))) : 0;
  const fontIndex = Number.isFinite(Number(card?.fontIndex)) ? Math.max(0, Math.floor(Number(card.fontIndex))) : 0;
  const colors = colorVariants[colorIndex % colorVariants.length];
  const textBgFill = textBgVariants[textBgIndex % textBgVariants.length];
  const fontFamily = safetyCardFontValues.length ? safetyCardFontValues[fontIndex % safetyCardFontValues.length] : 'Arial, sans-serif';
  const sx = (cardX - ax) * worldToPxX;
  const sy = (cardY - ay) * worldToPxY;
  const sw = cardW * worldToPxX;
  const sh = cardH * worldToPxY;
  if (sx < outW + 8 && sy < outH + 8 && sx + sw > -8 && sy + sh > -8) {
    const emergencyContacts = (Array.isArray((plan as any)?._emergencyContacts) ? ((plan as any)._emergencyContacts as any[]) : [])
      .filter((entry) => {
        const scope = String(entry?.scope || '');
        const showOnPlanCard = entry?.showOnPlanCard !== false;
        if (!showOnPlanCard) return false;
        if (scope === 'global' || scope === 'client') return true;
        if (scope === 'site') return String(entry?.siteId || '') === String((plan as any)?.siteId || '');
        if (scope === 'plan') return String(entry?.floorPlanId || '') === String((plan as any)?.id || '');
        return false;
      })
      .sort((a, b) => `${a?.name || ''}`.localeCompare(`${b?.name || ''}`));
    const emergencyPoints = (plan.objects || []).filter((o: any) => String(o?.type || '') === 'safety_assembly_point');
    const numbersText = emergencyContacts.length
      ? emergencyContacts.map((entry) => `| ${String(entry?.name || '—')} ${String(entry?.phone || '—')}`).join(' ')
      : 'Nessun numero';
    const pointsText = emergencyPoints.length
      ? emergencyPoints.map((point: any) => `| ${String(point?.name || point?.type || '—')} ${String((point as any)?.gpsCoords || '').trim() || `${Math.round(Number(point?.x || 0))}, ${Math.round(Number(point?.y || 0))}`}`).join(' ')
      : 'Nessun punto';
    const pad = Math.max(4, Math.round(6 * worldToPx));
    const titleSize = Math.max(8, cardFont * worldToPx * 0.74);
    const bodySize = Math.max(8, cardFont * worldToPx * 0.92);
    const lineH = Math.max(10, Math.round(bodySize * 1.24));
    const headerH = Math.max(16, Math.round(Math.max(18, cardFont * 1.48) * worldToPx));
    ctx.save();
    ctx.globalAlpha = 0.96;
    ctx.fillStyle = colors.body;
    ctx.beginPath();
    ctx.rect(sx, sy, sw, sh);
    ctx.fill();
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = Math.max(1, Math.round(1.4 * worldToPx));
    ctx.stroke();
    ctx.fillStyle = colors.header;
    ctx.fillRect(sx + 1, sy + 1, Math.max(1, sw - 2), Math.max(1, headerH - 2));
    ctx.beginPath();
    ctx.rect(sx + pad, sy + pad, Math.max(1, sw - pad * 2), Math.max(1, sh - pad * 2));
    ctx.clip();
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.title;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `bold ${Math.round(titleSize)}px ${fontFamily}`;
    const titleY = sy + Math.max(3, Math.round((headerH - titleSize) / 2));
    ctx.fillText('Scheda sicurezza', sx + pad, titleY);
    const firstLineY = sy + headerH + Math.max(2, Math.round(bodySize * 0.5));
    if (textBgFill !== 'transparent') {
      ctx.fillStyle = textBgFill;
      ctx.fillRect(sx + pad, firstLineY - Math.max(2, Math.round(bodySize * 0.2)), Math.max(1, sw - pad * 2), Math.max(8, Math.round(bodySize * 1.2)));
      ctx.fillRect(sx + pad, firstLineY + lineH - Math.max(2, Math.round(bodySize * 0.2)), Math.max(1, sw - pad * 2), Math.max(8, Math.round(bodySize * 1.2)));
    }
    ctx.fillStyle = colors.text;
    ctx.font = `600 ${Math.round(bodySize)}px ${fontFamily}`;
    ctx.fillText(`Numeri utili: ${numbersText}`, sx + pad, firstLineY);
    ctx.fillText(`Punti di ritrovo: ${pointsText}`, sx + pad, firstLineY + lineH);
    ctx.restore();
  }
};
