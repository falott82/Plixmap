/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from 'react';

type Pt = { x: number; y: number };

// Text-box transform (debounced size commit) + quote endpoint resize (preview + commit) extracted
// from CanvasStage.
export const useCanvasObjectTransforms = (deps: {
  stageRef: { current: any };
  pointerToWorld: (x: number, y: number) => Pt;
  onUpdateObject?: (id: string, patch: any) => void;
  onUpdateQuotePoints?: (id: string, points: Pt[]) => void;
}) => {
  const { stageRef, pointerToWorld, onUpdateObject, onUpdateQuotePoints } = deps;
  const textTransformRaf = useRef<number | null>(null);
  const pendingTextTransformRef = useRef<{ id: string; width: number; height: number } | null>(null);
  const quoteResizeRef = useRef<{ id: string; index: number; points: Pt[]; node?: any } | null>(null);
  const [quoteResizePreview, setQuoteResizePreview] = useState<{ id: string; points: Pt[] } | null>(null);

  const updateQuoteResizePreview = useCallback((shiftKey?: boolean) => {
    if (!quoteResizeRef.current) return;
    const stage = stageRef.current;
    const pos = stage?.getPointerPosition?.();
    if (!pos) return;
    const world = pointerToWorld(pos.x, pos.y);
    const { id, index, points } = quoteResizeRef.current;
    let nextX = world.x;
    let nextY = world.y;
    if (shiftKey) {
      const fixed = points[index === 0 ? points.length - 1 : 0];
      const dx = nextX - fixed.x;
      const dy = nextY - fixed.y;
      if (Math.abs(dx) >= Math.abs(dy)) {
        nextY = fixed.y;
      } else {
        nextX = fixed.x;
      }
    }
    const next = points.map((p, i) => (i === index ? { x: nextX, y: nextY } : p));
    setQuoteResizePreview({ id, points: next });
  }, [pointerToWorld, stageRef]);

  const commitQuoteResize = useCallback(() => {
    const ref = quoteResizeRef.current;
    if (!ref || !onUpdateQuotePoints) return;
    setQuoteResizePreview((preview) => {
      const pts = preview && preview.id === ref.id ? preview.points : ref.points;
      onUpdateQuotePoints(ref.id, pts);
      return null;
    });
    ref.node?.draggable?.(true);
    quoteResizeRef.current = null;
  }, [onUpdateQuotePoints]);

  const scheduleTextTransform = useCallback(
    (payload: { id: string; width: number; height: number }) => {
      if (!onUpdateObject) return;
      pendingTextTransformRef.current = payload;
      if (textTransformRaf.current) return;
      textTransformRaf.current = requestAnimationFrame(() => {
        textTransformRaf.current = null;
        const next = pendingTextTransformRef.current;
        pendingTextTransformRef.current = null;
        if (!next) return;
        onUpdateObject(next.id, { textBoxWidth: next.width, textBoxHeight: next.height, scaleX: 1, scaleY: 1 });
      });
    },
    [onUpdateObject]
  );

  useEffect(
    () => () => {
      if (textTransformRaf.current) cancelAnimationFrame(textTransformRaf.current);
    },
    []
  );

  return { quoteResizeRef, quoteResizePreview, setQuoteResizePreview, updateQuoteResizePreview, commitQuoteResize, scheduleTextTransform };
};
