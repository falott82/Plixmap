/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import {
  dragRectFromCorners,
  TEXT_BOX_DEFAULT_WIDTH,
  TEXT_BOX_DEFAULT_HEIGHT,
  TEXT_BOX_MIN_WIDTH,
  TEXT_BOX_MIN_HEIGHT
} from '../CanvasStage.helpers';

type Rect = { x: number; y: number; width: number; height: number };

// Text-box rectangle drawing (click = default box, drag = sized box) extracted from CanvasStage.
// Owns its draft state + origin/RAF refs; the host guards on isTextDrafting() and consumes the
// rect returned by finalizeTextDraft().
export const useCanvasTextDraft = (deps: { pointerToWorld: (x: number, y: number) => { x: number; y: number } }) => {
  const { pointerToWorld } = deps;
  const [textDraftRect, setTextDraftRect] = useState<Rect | null>(null);
  const textDraftOrigin = useRef<{ x: number; y: number } | null>(null);
  const textDraftRaf = useRef<number | null>(null);
  const pendingTextDraftRef = useRef<Rect | null>(null);

  const isTextDrafting = () => !!textDraftOrigin.current;

  const beginTextDraft = (world: { x: number; y: number }) => {
    textDraftOrigin.current = { x: world.x, y: world.y };
    pendingTextDraftRef.current = { x: world.x, y: world.y, width: 0, height: 0 };
    setTextDraftRect(pendingTextDraftRef.current);
  };

  const updateTextDraftRect = (event: any) => {
    const origin = textDraftOrigin.current;
    if (!origin) return false;
    const stage = event.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return true;
    const world = pointerToWorld(pos.x, pos.y);
    const { x, y, width, height } = dragRectFromCorners(origin.x, origin.y, world.x, world.y);
    pendingTextDraftRef.current = { x, y, width, height };
    if (textDraftRaf.current) return true;
    textDraftRaf.current = requestAnimationFrame(() => {
      textDraftRaf.current = null;
      const next = pendingTextDraftRef.current;
      pendingTextDraftRef.current = null;
      if (!next) return;
      setTextDraftRect(next);
    });
    return true;
  };

  const finalizeTextDraftRect = (): Rect | null => {
    if (!textDraftOrigin.current) return null;
    const origin = textDraftOrigin.current;
    const rect = textDraftRect || { x: origin.x, y: origin.y, width: 0, height: 0 };
    let { x, y, width, height } = rect;
    const isClick = width < 3 && height < 3;
    if (isClick) {
      width = TEXT_BOX_DEFAULT_WIDTH;
      height = TEXT_BOX_DEFAULT_HEIGHT;
      x = origin.x - width / 2;
      y = origin.y - height / 2;
    } else {
      const draggedLeft = rect.x < origin.x;
      const draggedUp = rect.y < origin.y;
      if (width < TEXT_BOX_MIN_WIDTH) {
        width = TEXT_BOX_MIN_WIDTH;
        x = draggedLeft ? origin.x - width : origin.x;
      }
      if (height < TEXT_BOX_MIN_HEIGHT) {
        height = TEXT_BOX_MIN_HEIGHT;
        y = draggedUp ? origin.y - height : origin.y;
      }
    }
    textDraftOrigin.current = null;
    if (textDraftRaf.current) cancelAnimationFrame(textDraftRaf.current);
    textDraftRaf.current = null;
    pendingTextDraftRef.current = null;
    setTextDraftRect(null);
    return { x, y, width, height };
  };

  useEffect(
    () => () => {
      if (textDraftRaf.current) cancelAnimationFrame(textDraftRaf.current);
    },
    []
  );

  return { textDraftRect, isTextDrafting, beginTextDraft, updateTextDraftRect, finalizeTextDraftRect };
};
