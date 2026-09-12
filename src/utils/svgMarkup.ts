import type { ReactElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

const cache = new Map<string, string>();

/**
 * Render a React element (typically an <Icon/>) to static SVG markup on the
 * client, without pulling `react-dom/server` (~200 KB) into the bundle.
 * Results are memoised by `cacheKey` because icon markup is pure.
 */
export const renderToSvgMarkup = (element: ReactElement, cacheKey?: string): string => {
  if (cacheKey) {
    const hit = cache.get(cacheKey);
    if (hit) return hit;
  }
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => root.render(element));
  const markup = host.innerHTML;
  root.unmount();
  if (cacheKey) cache.set(cacheKey, markup);
  return markup;
};

export const svgMarkupToDataUrl = (svg: string): string => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
