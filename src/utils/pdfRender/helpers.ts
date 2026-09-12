import { createElement } from 'react';
import Icon from '../../components/ui/Icon';
import type { IconName } from '../../store/types';
import { loadImage } from '../pdfShared';
import { renderToSvgMarkup, svgMarkupToDataUrl } from '../svgMarkup';

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const drawRoundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
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

export const svgIconToImage = async (iconName: IconName, opts?: { size?: number; color?: string; strokeWidth?: number }) => {
  const size = opts?.size || 18;
  const color = opts?.color || '#2563eb';
  const strokeWidth = opts?.strokeWidth || 1.8;
  const svg = renderToSvgMarkup(createElement(Icon, { name: iconName, size, color, strokeWidth }), `${iconName}|${size}|${color}|${strokeWidth}`);
  return loadImage(svgMarkupToDataUrl(svg));
};
