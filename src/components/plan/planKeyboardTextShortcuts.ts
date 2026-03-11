import type { FloorPlan, MapObject } from '../../store/types';

type ResolveObjectsByIds = (ids: string[]) => MapObject[];

type TextShortcutStaticDeps = {
  markTouched: () => void,
  updateObject: (id: string, changes: any) => void,
  textFontValues: string[],
  textColorValues: string[]
};

export const createPlanTextShortcutHandler = ({
  markTouched,
  updateObject,
  textFontValues,
  textColorValues
}: TextShortcutStaticDeps) =>
  (
    e: KeyboardEvent,
    currentPlan: FloorPlan | null,
    currentSelectedIds: string[],
    isReadOnly: boolean,
    resolveObjectsByIds: ResolveObjectsByIds
  ): boolean => {
    if (!currentSelectedIds.length || !currentPlan || isReadOnly) return false;
    if (e.ctrlKey || e.metaKey || e.altKey) return false;

    const key = e.key.toLowerCase();
    if (key === 'b' && !e.shiftKey) {
      const textObjs = resolveObjectsByIds(currentSelectedIds).filter((obj): obj is MapObject => obj.type === 'text');
      if (!textObjs.length) return false;
      e.preventDefault();
      markTouched();
      for (const obj of textObjs) {
        const current = !!(obj as any).textBg;
        updateObject(obj.id, { textBg: !current });
      }
      return true;
    }

    if (key === 'f' || (key === 'b' && e.shiftKey)) {
      const textObjs = resolveObjectsByIds(currentSelectedIds).filter((obj): obj is MapObject => obj.type === 'text');
      if (!textObjs.length) return false;
      if (!textFontValues.length) return false;
      e.preventDefault();
      markTouched();
      const delta = key === 'f' ? 1 : -1;
      for (const obj of textObjs) {
        const currentFont = String((obj as any).textFont || textFontValues[0]);
        const currentIndex = textFontValues.indexOf(currentFont);
        const safeIndex = currentIndex >= 0 ? currentIndex : 0;
        const nextFont = textFontValues[(safeIndex + delta + textFontValues.length) % textFontValues.length];
        updateObject(obj.id, { textFont: nextFont });
      }
      return true;
    }

    if (key === 'c') {
      const textObjs = resolveObjectsByIds(currentSelectedIds).filter((obj): obj is MapObject => obj.type === 'text');
      if (!textObjs.length) return false;
      if (!textColorValues.length) return false;
      e.preventDefault();
      markTouched();
      const delta = e.shiftKey ? -1 : 1;
      for (const obj of textObjs) {
        const currentColor = String((obj as any).textColor || textColorValues[0]).toLowerCase();
        const currentIndex = textColorValues.findIndex((color) => color.toLowerCase() === currentColor);
        const safeIndex = currentIndex >= 0 ? currentIndex : 0;
        const nextColor = textColorValues[(safeIndex + delta + textColorValues.length) % textColorValues.length];
        updateObject(obj.id, { textColor: nextColor });
      }
      return true;
    }

    return false;
  };
