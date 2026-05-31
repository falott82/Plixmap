// Small typed helpers around the Fullscreen API that smooth over vendor
// prefixes (Safari/older WebKit) without scattering `document as any` casts.

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  msFullscreenElement?: Element | null;
  msExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

const fsDoc = (): FullscreenDocument => document as FullscreenDocument;

/** True when the browser is currently in fullscreen mode (any vendor). */
export const isFullscreen = (): boolean => {
  const doc = fsDoc();
  return !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement);
};

/** Request fullscreen on an element, tolerating vendor prefixes. Never throws. */
export const requestFullscreen = (el: HTMLElement | null): void => {
  if (!el) return;
  const node = el as FullscreenElement;
  try {
    (node.requestFullscreen || node.webkitRequestFullscreen || node.msRequestFullscreen)?.call(node);
  } catch {
    // ignore — fullscreen is best-effort
  }
};

/** Exit fullscreen if active, tolerating vendor prefixes. Never throws. */
export const exitFullscreen = (): void => {
  const doc = fsDoc();
  try {
    (doc.exitFullscreen || doc.webkitExitFullscreen || doc.msExitFullscreen)?.call(doc);
  } catch {
    // ignore — fullscreen is best-effort
  }
};
