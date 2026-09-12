/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { perfMetrics } from '../../../utils/perfMetrics';
import { dragRectFromCorners } from '../CanvasStage.helpers';

type Rect = { x: number; y: number; width: number; height: number };

// Print-area rectangle drawing (drag to define a print region) extracted from CanvasStage.
// Owns its draft state + RAF/origin refs; the host wires pointer events to begin/update/finalize.
export const useCanvasPrintAreaDraft = (deps: {
  printAreaMode: boolean;
  readOnly: boolean;
  perfEnabled: boolean;
  pointerToWorld: (x: number, y: number) => { x: number; y: number };
  onSetPrintArea?: (rect: Rect) => void;
}) => {
  const { printAreaMode, readOnly, perfEnabled, pointerToWorld, onSetPrintArea } = deps;
  const [draftPrintRect, setDraftPrintRect] = useState<Rect | null>(null);
  const printOrigin = useRef<{ x: number; y: number } | null>(null);
  const draftPrintRectRaf = useRef<number | null>(null);
  const pendingDraftPrintRectRef = useRef<Rect | null>(null);

  const beginPrintDraft = (world: { x: number; y: number }) => {
    printOrigin.current = { x: world.x, y: world.y };
    pendingDraftPrintRectRef.current = { x: world.x, y: world.y, width: 0, height: 0 };
    if (perfEnabled) perfMetrics.draftPrintRectUpdates += 1;
    setDraftPrintRect(pendingDraftPrintRectRef.current);
  };

  const updateDraftPrintRect = (event: any) => {
    if (!printAreaMode || readOnly) return false;
    const origin = printOrigin.current;
    if (!origin) return false;
    const stage = event.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return true;
    const world = pointerToWorld(pos.x, pos.y);
    const { x, y, width, height } = dragRectFromCorners(origin.x, origin.y, world.x, world.y);
    pendingDraftPrintRectRef.current = { x, y, width, height };
    if (draftPrintRectRaf.current) return true;
    draftPrintRectRaf.current = requestAnimationFrame(() => {
      draftPrintRectRaf.current = null;
      const next = pendingDraftPrintRectRef.current;
      pendingDraftPrintRectRef.current = null;
      if (!next) return;
      if (perfEnabled) perfMetrics.draftPrintRectUpdates += 1;
      setDraftPrintRect(next);
    });
    return true;
  };

  const finalizeDraftPrintRect = () => {
    if (!printAreaMode || readOnly) return false;
    if (!printOrigin.current || !draftPrintRect) return false;
    const rect = {
      x: draftPrintRect.x,
      y: draftPrintRect.y,
      width: Math.max(0, draftPrintRect.width),
      height: Math.max(0, draftPrintRect.height)
    };
    printOrigin.current = null;
    if (draftPrintRectRaf.current) cancelAnimationFrame(draftPrintRectRaf.current);
    draftPrintRectRaf.current = null;
    pendingDraftPrintRectRef.current = null;
    if (perfEnabled) perfMetrics.draftPrintRectUpdates += 1;
    setDraftPrintRect(null);
    if (rect.width < 20 || rect.height < 20) return true;
    onSetPrintArea?.(rect);
    return true;
  };

  // Reset the draft when leaving print mode (and clean up the RAF on unmount).
  useEffect(() => {
    if (printAreaMode) return;
    printOrigin.current = null;
    if (perfEnabled) perfMetrics.draftPrintRectUpdates += 1;
    setDraftPrintRect(null);
    if (draftPrintRectRaf.current) cancelAnimationFrame(draftPrintRectRaf.current);
    draftPrintRectRaf.current = null;
    pendingDraftPrintRectRef.current = null;
  }, [perfEnabled, printAreaMode]);

  useEffect(
    () => () => {
      if (draftPrintRectRaf.current) cancelAnimationFrame(draftPrintRectRaf.current);
    },
    []
  );

  return { draftPrintRect, beginPrintDraft, updateDraftPrintRect, finalizeDraftPrintRect };
};
