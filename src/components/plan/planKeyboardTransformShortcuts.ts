import type { FloorPlan, MapObject } from '../../store/types';

type QuoteOrientation = 'horizontal' | 'vertical';
type QuoteLabelPos = 'center' | 'above' | 'below' | 'left' | 'right';
type ResolveObjectsByIds = (ids: string[]) => MapObject[];

type CtrlArrowQuoteStaticDeps = {
  markTouched: () => void,
  getQuoteOrientation: (points: Array<{ x: number; y: number }> | undefined) => QuoteOrientation,
  updateQuoteLabelPos: (id: string, pos: QuoteLabelPos, orientation?: QuoteOrientation) => void
};

type RotateStaticDeps = {
  markTouched: () => void,
  updateObject: (id: string, changes: any) => void,
  isDeskType: (typeId: string) => boolean,
  isCameraType: (typeId: string) => boolean
};

const getNextQuoteLabelPos = (
  orientation: QuoteOrientation,
  currentRaw: string,
  isArrowLeft: boolean,
  isArrowRight: boolean,
  isArrowUp: boolean,
  isArrowDown: boolean
): QuoteLabelPos | null => {
  const currentPos =
    orientation === 'vertical'
      ? (currentRaw === 'left' || currentRaw === 'right' || currentRaw === 'center' ? currentRaw : 'center')
      : (currentRaw === 'above' || currentRaw === 'below' || currentRaw === 'center' ? currentRaw : 'center');

  if (orientation === 'vertical') {
    if (isArrowLeft) {
      if (currentPos === 'right') return 'center';
      if (currentPos === 'center') return 'left';
      return 'left';
    }
    if (isArrowRight) {
      if (currentPos === 'left') return 'center';
      if (currentPos === 'center') return 'right';
      return 'right';
    }
    if (isArrowUp || isArrowDown) return 'center';
    return null;
  }

  if (isArrowUp) {
    if (currentPos === 'below') return 'center';
    if (currentPos === 'center') return 'above';
    return 'above';
  }
  if (isArrowDown) {
    if (currentPos === 'above') return 'center';
    if (currentPos === 'center') return 'below';
    return 'below';
  }
  if (isArrowLeft || isArrowRight) return 'center';
  return null;
};

export const createPlanCtrlArrowQuoteShortcutHandler = ({
  markTouched,
  getQuoteOrientation,
  updateQuoteLabelPos
}: CtrlArrowQuoteStaticDeps) =>
  (
    e: KeyboardEvent,
    currentPlan: FloorPlan | null,
    currentSelectedIds: string[],
    selectedObjectId: string | undefined,
    isReadOnly: boolean,
    resolveObjectsByIds: ResolveObjectsByIds,
    isArrowLeft: boolean,
    isArrowRight: boolean,
    isArrowUp: boolean,
    isArrowDown: boolean
  ): boolean => {
    const ids = currentSelectedIds.length ? currentSelectedIds : (selectedObjectId ? [selectedObjectId] : []);
    if (!ids.length || !currentPlan || isReadOnly) return true;
    const quoteObjs = resolveObjectsByIds(ids).filter((obj): obj is MapObject => obj.type === 'quote');
    if (!quoteObjs.length) return false;

    e.preventDefault();
    markTouched();
    for (const obj of quoteObjs) {
      const orientation = getQuoteOrientation(obj.points as Array<{ x: number; y: number }> | undefined);
      const currentRaw = String((obj as any)?.quoteLabelPos || 'center');
      const nextPos = getNextQuoteLabelPos(orientation, currentRaw, isArrowLeft, isArrowRight, isArrowUp, isArrowDown);
      if (nextPos) updateQuoteLabelPos(obj.id, nextPos, orientation);
    }
    return true;
  };

export const createPlanRotateShortcutHandler = ({
  markTouched,
  updateObject,
  isDeskType,
  isCameraType
}: RotateStaticDeps) =>
  (
    e: KeyboardEvent,
    currentPlan: FloorPlan | null,
    currentSelectedIds: string[],
    isReadOnly: boolean,
    resolveObjectsByIds: ResolveObjectsByIds,
    isArrowLeft: boolean
  ): boolean => {
    if (!currentSelectedIds.length || !currentPlan || isReadOnly) return true;

    const rotatable = resolveObjectsByIds(currentSelectedIds)
      .filter(
        (obj): obj is MapObject =>
          isDeskType(obj.type) || isCameraType(obj.type) || obj.type === 'text' || obj.type === 'image' || obj.type === 'photo'
      );
    if (!rotatable.length) return false;

    e.preventDefault();
    markTouched();
    const delta = isArrowLeft ? -90 : 90;
    for (const obj of rotatable) {
      const current = Number(obj.rotation || 0);
      updateObject(obj.id, { rotation: (current + delta + 360) % 360 });
    }
    return true;
  };
