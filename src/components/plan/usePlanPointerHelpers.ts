/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { runDismissSelectionHintToasts } from './planViewSelectionToasts';
import { computeGetPastePoint } from './planViewViewport';

// Pointer-position tracking + paste-point + selection-hint-toast dismissal helpers extracted from
// usePlanView. All operate on host-owned refs (passed in); bodies moved verbatim.
export const usePlanPointerHelpers = (deps: any) => {
  const {
    lastPointerClientRef, lastPointerClickRef, mapRef, zoomRef, panRef, selectionHintToastIds,
    selectionToastKeyRef, selectionToastIdRef, deskToastKeyRef, deskToastIdRef, multiToastKeyRef,
    multiToastIdRef, quoteToastKeyRef, quoteToastIdRef, mediaToastKeyRef, mediaToastIdRef
  } = deps;

  const dismissSelectionHintToasts = useCallback(() => {
    runDismissSelectionHintToasts({
      selectionHintToastIds,
      selectionToastKeyRef,
      selectionToastIdRef,
      deskToastKeyRef,
      deskToastIdRef,
      multiToastKeyRef,
      multiToastIdRef,
      quoteToastKeyRef,
      quoteToastIdRef,
      mediaToastKeyRef,
      mediaToastIdRef
    });
  }, [
    selectionHintToastIds, selectionToastKeyRef, selectionToastIdRef, deskToastKeyRef, deskToastIdRef,
    multiToastKeyRef, multiToastIdRef, quoteToastKeyRef, quoteToastIdRef, mediaToastKeyRef, mediaToastIdRef
  ]);

  const handleMapMouseMove = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    lastPointerClientRef.current = { x: event.clientX, y: event.clientY };
  }, [lastPointerClientRef]);

  const handleMapMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    lastPointerClientRef.current = { x: event.clientX, y: event.clientY };
    lastPointerClickRef.current = { x: event.clientX, y: event.clientY };
  }, [lastPointerClientRef, lastPointerClickRef]);

  const getPastePoint = useCallback(
    () => computeGetPastePoint({ lastPointerClickRef, mapRef, zoomRef, panRef }),
    [lastPointerClickRef, mapRef, zoomRef, panRef]
  );

  return { dismissSelectionHintToasts, handleMapMouseMove, handleMapMouseDown, getPastePoint };
};
