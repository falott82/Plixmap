import { useCallback } from 'react';
import { toast } from 'sonner';
import { DEFAULT_WALL_TYPES } from '../../store/data';

// Wall-draw start/finish handlers extracted from usePlanView. startWallDraw shows
// a sonner toast (hence .tsx). Bodies are verbatim; shared deps injected once.
export const usePlanWallDrawToggles = (deps: any) => {
  const {
    isReadOnly,
    wallDrawMode,
    wallDrawType,
    wallTypeDefs,
    lang,
    push,
    t,
    dismissScaleToast,
    resetToolClickHistory,
    isWallType,
    wallDraftPointsRef,
    wallDraftSegmentIdsRef,
    wallToastIdRef,
    setWallDrawType,
    setWallDrawMode,
    setWallDraftPoints,
    setWallDraftPointer,
    setRoomDrawMode,
    setScaleMode,
    setMeasureMode,
    setQuoteMode,
    setQuotePoints,
    setQuotePointer,
    setPendingType
  } = deps;

  const startWallDraw = useCallback(
    (typeId?: string) => {
      if (isReadOnly) return;
      dismissScaleToast();
      resetToolClickHistory();
      const resolved = (typeId && isWallType(typeId) ? typeId : wallDrawType) || wallTypeDefs[0]?.id || DEFAULT_WALL_TYPES[0];
      if (!resolved) return;
      setWallDrawType(resolved);
      setWallDrawMode(true);
      setWallDraftPoints([]);
      wallDraftPointsRef.current = [];
      wallDraftSegmentIdsRef.current = [];
      setWallDraftPointer(null);
      setRoomDrawMode(null);
      setScaleMode(false);
      setMeasureMode(false);
      setQuoteMode(false);
      setQuotePoints([]);
      setQuotePointer(null);
      setPendingType(null);
      if (wallToastIdRef.current != null) {
        toast.dismiss(wallToastIdRef.current);
      }
      wallToastIdRef.current = toast.info(
        lang === 'it' ? (
          <span>
            Disegno muro: clicca per aggiungere angoli. <strong>Tasto destro</strong> o <strong>Invio</strong> per terminare, ESC elimina l’ultimo segmento. Se non li vedi, abilita il layer Mura.
          </span>
        ) : (
          <span>
            Wall drawing: click to add corners. <strong>Right click</strong> or <strong>Enter</strong> to finish, ESC removes the last segment. If you cannot see them, enable the Walls layer.
          </span>
        ),
        { duration: Infinity }
      );
    },
    [dismissScaleToast, isReadOnly, isWallType, lang, resetToolClickHistory, wallDrawType, wallTypeDefs]
  );

  const finishWallDraw = useCallback(
    (options?: { cancel?: boolean }) => {
      if (!wallDrawMode) return;
      setWallDrawMode(false);
      setWallDraftPoints([]);
      wallDraftPointsRef.current = [];
      wallDraftSegmentIdsRef.current = [];
      setWallDraftPointer(null);
      resetToolClickHistory();
      if (wallToastIdRef.current != null) {
        toast.dismiss(wallToastIdRef.current);
        wallToastIdRef.current = null;
      }
      if (options?.cancel) {
        push(t({ it: 'Disegno muro annullato', en: 'Wall drawing cancelled' }), 'info');
      }
    },
    [push, resetToolClickHistory, t, wallDrawMode]
  );

  return { startWallDraw, finishWallDraw };
};
