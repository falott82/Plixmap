/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import { SAFETY_CARD_FONT_VALUES, SAFETY_CARD_COLOR_VARIANTS, SAFETY_CARD_TEXT_BG_VARIANTS } from '../CanvasStage.helpers';

// Safety-card node test + font/color/text-bg cycling actions extracted from CanvasStage.
// (The safety-card draft state + sync effects stay in the host.)
export const useCanvasSafetyCardActions = (deps: {
  safetyCardDraft: any;
  setSafetyCardDraft: (v: any) => void;
  onSafetyCardChange?: (layout: any, opts?: { commit?: boolean }) => void;
}) => {
  const { safetyCardDraft, setSafetyCardDraft, onSafetyCardChange } = deps;

  const isSafetyCardNode = useCallback((node: any) => {
    let cursor = node;
    while (cursor) {
      const name = String(cursor?.attrs?.name || '');
      if (name === 'safety-card-group' || name.startsWith('safety-card-')) return true;
      const parent = cursor.getParent?.();
      if (!parent || parent === cursor) break;
      cursor = parent;
    }
    return false;
  }, []);

  const adjustSafetyCardFont = useCallback(
    (delta: number) => {
      if (!safetyCardDraft || !onSafetyCardChange) return;
      const nextFontSize = Math.max(8, Math.min(22, Number(safetyCardDraft.fontSize || 10) + delta));
      if (Math.abs(nextFontSize - safetyCardDraft.fontSize) < 0.01) return;
      const nextLayout = { ...safetyCardDraft, fontSize: nextFontSize };
      setSafetyCardDraft(nextLayout);
      onSafetyCardChange(nextLayout, { commit: true });
    },
    [onSafetyCardChange, safetyCardDraft, setSafetyCardDraft]
  );

  const cycleSafetyCardFont = useCallback(
    (delta: number) => {
      if (!safetyCardDraft || !onSafetyCardChange || !SAFETY_CARD_FONT_VALUES.length) return;
      const current = Number(safetyCardDraft.fontIndex) || 0;
      const nextLayout = {
        ...safetyCardDraft,
        fontIndex: (current + delta + SAFETY_CARD_FONT_VALUES.length) % SAFETY_CARD_FONT_VALUES.length
      };
      setSafetyCardDraft(nextLayout);
      onSafetyCardChange(nextLayout, { commit: true });
    },
    [onSafetyCardChange, safetyCardDraft, setSafetyCardDraft]
  );

  const cycleSafetyCardColor = useCallback(() => {
    if (!safetyCardDraft || !onSafetyCardChange) return;
    const nextLayout = { ...safetyCardDraft, colorIndex: (Number(safetyCardDraft.colorIndex) + 1) % SAFETY_CARD_COLOR_VARIANTS.length };
    setSafetyCardDraft(nextLayout);
    onSafetyCardChange(nextLayout, { commit: true });
  }, [onSafetyCardChange, safetyCardDraft, setSafetyCardDraft]);

  const cycleSafetyCardTextBg = useCallback(() => {
    if (!safetyCardDraft || !onSafetyCardChange) return;
    const nextLayout = { ...safetyCardDraft, textBgIndex: (Number(safetyCardDraft.textBgIndex) + 1) % SAFETY_CARD_TEXT_BG_VARIANTS.length };
    setSafetyCardDraft(nextLayout);
    onSafetyCardChange(nextLayout, { commit: true });
  }, [onSafetyCardChange, safetyCardDraft, setSafetyCardDraft]);

  return { isSafetyCardNode, adjustSafetyCardFont, cycleSafetyCardFont, cycleSafetyCardColor, cycleSafetyCardTextBg };
};
