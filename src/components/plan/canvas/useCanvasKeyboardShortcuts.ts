/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from 'react';
import { useUIStore } from '../../../store/useUIStore';
import { pointInPolygon } from '../CanvasStage.helpers';

// Canvas keyboard shortcuts (Escape cancels an active room/corridor/label drag; +/-/F/C/B drive the
// selected safety card) extracted from CanvasStage.
export const useCanvasKeyboardShortcuts = (deps: any) => {
  const {
    suspendKeyboardShortcuts, corridorLabelDragRef, roomDragRef, corridorDragRef, onUpdateCorridor,
    safetyCardSelected, safetyCardDraft, safetyCard, readOnly,
    adjustSafetyCardFont, cycleSafetyCardColor, cycleSafetyCardFont, cycleSafetyCardTextBg
  } = deps;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (suspendKeyboardShortcuts) return;
      if ((useUIStore.getState() as any)?.clientChatOpen) return;
      if (e.key !== 'Escape') return;
      const labelDrag = corridorLabelDragRef.current;
      if (labelDrag) {
        e.preventDefault();
        corridorLabelDragRef.current = null;
        try {
          const nx = Number(labelDrag.node?.x?.() ?? labelDrag.lastX ?? 0);
          const ny = Number(labelDrag.node?.y?.() ?? labelDrag.lastY ?? 0);
          if (pointInPolygon(nx, ny, labelDrag.points)) {
            onUpdateCorridor?.(labelDrag.corridorId, { labelX: Number(nx.toFixed(3)), labelY: Number(ny.toFixed(3)) });
          }
          labelDrag.node?.stopDrag?.();
          labelDrag.node?.getLayer()?.batchDraw?.();
        } catch {
          // ignore
        }
        return;
      }
      const active = roomDragRef.current;
      const corridorActive = corridorDragRef.current;
      if (!active && !corridorActive) return;
      e.preventDefault();
      if (active) {
        active.cancelled = true;
        try {
          active.node.stopDrag?.();
          active.node.position({ x: active.startX, y: active.startY });
          active.node.getLayer()?.batchDraw?.();
        } catch {
          // ignore
        }
      }
      if (corridorActive) {
        corridorActive.cancelled = true;
        try {
          corridorActive.node.stopDrag?.();
          corridorActive.node.position({ x: corridorActive.startX, y: corridorActive.startY });
          corridorActive.node.getLayer()?.batchDraw?.();
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [suspendKeyboardShortcuts, corridorLabelDragRef, roomDragRef, corridorDragRef, onUpdateCorridor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (suspendKeyboardShortcuts) return;
      if (!safetyCardSelected || !safetyCardDraft || !safetyCard?.visible || readOnly) return;
      if ((useUIStore.getState() as any)?.clientChatOpen) return;
      const key = String(e.key || '');
      if (key === '+' || key === '=' || key === '-' || key === '_') {
        e.preventDefault();
        e.stopPropagation();
        adjustSafetyCardFont(key === '-' || key === '_' ? -1 : 1);
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && key.toLowerCase() === 'c') {
        e.preventDefault();
        e.stopPropagation();
        cycleSafetyCardColor();
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && key.toLowerCase() === 'f') {
        e.preventDefault();
        e.stopPropagation();
        cycleSafetyCardFont(e.shiftKey ? -1 : 1);
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && key.toLowerCase() === 'b') {
        e.preventDefault();
        e.stopPropagation();
        cycleSafetyCardTextBg();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [adjustSafetyCardFont, cycleSafetyCardColor, cycleSafetyCardFont, cycleSafetyCardTextBg, readOnly, safetyCard?.visible, safetyCardDraft, safetyCardSelected, suspendKeyboardShortcuts]);
};
