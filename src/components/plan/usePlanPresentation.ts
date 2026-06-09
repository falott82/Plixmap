/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect } from 'react';

// Presentation-mode handlers (enter fullscreen on gesture, request/toggle presentation) + the
// presentation-enter-request effect, extracted from usePlanView. Bodies moved verbatim.
export const usePlanPresentation = (deps: any) => {
  const { presentationMode, togglePresentationMode, presentationEnterRequested, clearPresentationEnterRequest } = deps;

  const enterFullscreenFromGesture = useCallback(() => {
    try {
      const doc: any = document as any;
      const root: any = document.documentElement as any;
      if (!!doc.fullscreenElement) return;
      const p = root?.requestFullscreen?.();
      if (p && typeof p.then === 'function') {
        p.catch(() => {
          // ignore: fullscreen may be blocked or already active
        });
      }
    } catch {
      // ignore
    }
  }, []);

  const requestEnterPresentation = useCallback(() => {
    if (presentationMode) return;
    enterFullscreenFromGesture();
    togglePresentationMode?.();
  }, [enterFullscreenFromGesture, presentationMode, togglePresentationMode]);

  const handleTogglePresentation = useCallback(() => {
    if (presentationMode) {
      togglePresentationMode?.();
      return;
    }
    requestEnterPresentation();
  }, [presentationMode, requestEnterPresentation, togglePresentationMode]);

  useEffect(() => {
    if (!presentationEnterRequested) return;
    clearPresentationEnterRequest?.();
    if (presentationMode) return;
    requestEnterPresentation();
  }, [clearPresentationEnterRequest, presentationEnterRequested, presentationMode, requestEnterPresentation]);

  return { enterFullscreenFromGesture, requestEnterPresentation, handleTogglePresentation };
};
