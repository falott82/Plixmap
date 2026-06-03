import { useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { FloorPlan } from '../../store/types';

const DEFAULT_SAFETY_CARD_LAYOUT = { x: 24, y: 24, w: 420, h: 84, fontSize: 10, fontIndex: 0, colorIndex: 0, textBgIndex: 0 } as const;

export type UsePlanSafetyCardDeps = {
  planRef: RefObject<FloorPlan | undefined>;
  isReadOnlyRef: RefObject<boolean>;
  renderPlan: FloorPlan | undefined;
  updateFloorPlan: (
    id: string,
    payload: Partial<
      Pick<FloorPlan, 'name' | 'imageUrl' | 'width' | 'height' | 'printArea' | 'scale' | 'corridors' | 'roomDoors' | 'safetyCardLayout'>
    >
  ) => void;
};

export function usePlanSafetyCard(deps: UsePlanSafetyCardDeps) {
  const { planRef, isReadOnlyRef, renderPlan, updateFloorPlan } = deps;

  const normalizeSafetyCardLayout = useCallback((layout: any) => {
    const x = Number(layout?.x);
    const y = Number(layout?.y);
    const w = Number(layout?.w);
    const h = Number(layout?.h);
    const fontSize = Number(layout?.fontSize);
    const fontIndex = Number(layout?.fontIndex);
    const colorIndex = Number(layout?.colorIndex);
    const textBgIndex = Number(layout?.textBgIndex);
    return {
      x: Number.isFinite(x) ? x : DEFAULT_SAFETY_CARD_LAYOUT.x,
      y: Number.isFinite(y) ? y : DEFAULT_SAFETY_CARD_LAYOUT.y,
      w: Number.isFinite(w) ? Math.max(220, w) : DEFAULT_SAFETY_CARD_LAYOUT.w,
      h: Number.isFinite(h) ? Math.max(56, h) : DEFAULT_SAFETY_CARD_LAYOUT.h,
      fontSize: Number.isFinite(fontSize) ? Math.max(8, Math.min(22, fontSize)) : DEFAULT_SAFETY_CARD_LAYOUT.fontSize,
      fontIndex: Number.isFinite(fontIndex) ? Math.max(0, Math.floor(fontIndex)) : DEFAULT_SAFETY_CARD_LAYOUT.fontIndex,
      colorIndex: Number.isFinite(colorIndex) ? Math.max(0, Math.floor(colorIndex)) : DEFAULT_SAFETY_CARD_LAYOUT.colorIndex,
      textBgIndex: Number.isFinite(textBgIndex) ? Math.max(0, Math.floor(textBgIndex)) : DEFAULT_SAFETY_CARD_LAYOUT.textBgIndex
    };
  }, []);
  const [safetyCardPos, setSafetyCardPos] = useState<{ x: number; y: number }>({ x: 24, y: 24 }); // world coords
  const [safetyCardSize, setSafetyCardSize] = useState<{ w: number; h: number }>({ w: 420, h: 84 }); // world size
  const [safetyCardFontSize, setSafetyCardFontSize] = useState<number>(10);
  const [safetyCardFontIndex, setSafetyCardFontIndex] = useState<number>(0);
  const [safetyCardColorIndex, setSafetyCardColorIndex] = useState<number>(0);
  const [safetyCardTextBgIndex, setSafetyCardTextBgIndex] = useState<number>(0);

  const handleSafetyCardChange = useCallback(
    (
      layout: { x: number; y: number; w: number; h: number; fontSize: number; fontIndex?: number; colorIndex?: number; textBgIndex?: number },
      options?: { commit?: boolean }
    ) => {
      const normalized = normalizeSafetyCardLayout(layout);
      setSafetyCardPos({ x: normalized.x, y: normalized.y });
      setSafetyCardSize({ w: normalized.w, h: normalized.h });
      setSafetyCardFontSize(normalized.fontSize);
      setSafetyCardFontIndex(normalized.fontIndex);
      setSafetyCardColorIndex(normalized.colorIndex);
      setSafetyCardTextBgIndex(normalized.textBgIndex);
      if (!options?.commit || !planRef.current || isReadOnlyRef.current) return;
      const baseLayout = normalizeSafetyCardLayout((planRef.current as any)?.safetyCardLayout);
      const hasDiff =
        Math.abs(normalized.x - baseLayout.x) > 0.15 ||
        Math.abs(normalized.y - baseLayout.y) > 0.15 ||
        Math.abs(normalized.w - baseLayout.w) > 0.15 ||
        Math.abs(normalized.h - baseLayout.h) > 0.15 ||
        Math.abs(normalized.fontSize - baseLayout.fontSize) > 0.01 ||
        normalized.fontIndex !== baseLayout.fontIndex ||
        normalized.colorIndex !== baseLayout.colorIndex ||
        normalized.textBgIndex !== baseLayout.textBgIndex;
      if (hasDiff) updateFloorPlan((planRef.current as any).id, { safetyCardLayout: normalized } as any);
    },
    [normalizeSafetyCardLayout, updateFloorPlan]
  );

  useEffect(() => {
    if (!renderPlan) return;
    const layout = normalizeSafetyCardLayout((renderPlan as any)?.safetyCardLayout);
    setSafetyCardPos((prev) => (Math.abs(prev.x - layout.x) > 0.01 || Math.abs(prev.y - layout.y) > 0.01 ? { x: layout.x, y: layout.y } : prev));
    setSafetyCardSize((prev) => (Math.abs(prev.w - layout.w) > 0.01 || Math.abs(prev.h - layout.h) > 0.01 ? { w: layout.w, h: layout.h } : prev));
    setSafetyCardFontSize((prev) => (Math.abs(prev - layout.fontSize) > 0.01 ? layout.fontSize : prev));
    setSafetyCardFontIndex((prev) => (prev !== layout.fontIndex ? layout.fontIndex : prev));
    setSafetyCardColorIndex((prev) => (prev !== layout.colorIndex ? layout.colorIndex : prev));
    setSafetyCardTextBgIndex((prev) => (prev !== layout.textBgIndex ? layout.textBgIndex : prev));
  }, [normalizeSafetyCardLayout, renderPlan]);

  return {
    safetyCardPos,
    safetyCardSize,
    safetyCardFontSize,
    safetyCardFontIndex,
    safetyCardColorIndex,
    safetyCardTextBgIndex,
    handleSafetyCardChange
  };
}
