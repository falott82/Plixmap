import { useCallback } from 'react';
import { computeInsertCorridorJunctionPoint, computeSaveCorridorConnectionModal } from './planViewCorridorGeometry';
import { runOpenEditCorridorConnectionModal } from './planViewDoorModals';

// Corridor connection/junction + door-draw start handlers extracted from
// usePlanView. Inline bodies are verbatim; delegating ones keep calling the
// existing compute*/run* helpers. Shared deps injected once.
export const usePlanCorridorConnectionHandlers = (deps: any) => {
  const {
    isReadOnly,
    push,
    t,
    markTouched,
    plan,
    updateFloorPlan,
    corridorById,
    corridorConnectionModal,
    getClosestCorridorEdge,
    getCorridorPolygon,
    getCorridorEdgePoint,
    setCorridorDoorDraft,
    setCorridorQuickMenu,
    setSelectedCorridorDoor,
    setSelectedCorridorId,
    setCorridorConnectionModal
  } = deps;

  const startCorridorDoorDraw = useCallback(
    (corridorId: string) => {
      if (isReadOnly) return;
      setCorridorDoorDraft({ corridorId });
      setCorridorQuickMenu(null);
      setSelectedCorridorDoor(null);
      setSelectedCorridorId(corridorId);
      push(
        t({
          it: 'Seleziona un punto sul bordo del corridoio per inserire una porta.',
          en: 'Select a point on the corridor perimeter to place a door.'
        }),
        'info'
      );
    },
    [isReadOnly, push, t, setCorridorDoorDraft, setCorridorQuickMenu, setSelectedCorridorDoor, setSelectedCorridorId]
  );

  const insertCorridorJunctionPoint = useCallback(
    (corridorId: string, worldPoint: { x: number; y: number }) =>
      computeInsertCorridorJunctionPoint(corridorId, worldPoint, {
        getClosestCorridorEdge,
        getCorridorPolygon,
        isReadOnly,
        markTouched,
        plan,
        push,
        t,
        updateFloorPlan
      }),
    [getClosestCorridorEdge, getCorridorPolygon, isReadOnly, markTouched, plan, push, t, updateFloorPlan]
  );

  const openCorridorConnectionModalAt = useCallback(
    (corridorId: string, point: { x: number; y: number }) => {
      const corridor = corridorById.get(corridorId);
      if (!corridor) return;
      const anchor = getClosestCorridorEdge(corridor, point);
      if (!anchor) return;
      setCorridorConnectionModal({
        connectionId: null,
        corridorId,
        edgeIndex: anchor.edgeIndex,
        t: Number(anchor.t.toFixed(4)),
        x: Number(point.x.toFixed(3)),
        y: Number(point.y.toFixed(3)),
        selectedPlanIds: [],
        transitionType: 'stairs'
      });
    },
    [corridorById, getClosestCorridorEdge, setCorridorConnectionModal]
  );

  const openEditCorridorConnectionModal = useCallback(
    (corridorId: string, connectionId: string, point?: { x: number; y: number }) => {
      runOpenEditCorridorConnectionModal(corridorId, connectionId, point, {
        corridorById,
        getClosestCorridorEdge,
        getCorridorEdgePoint,
        setCorridorConnectionModal
      });
    },
    [corridorById, getClosestCorridorEdge, getCorridorEdgePoint, setCorridorConnectionModal]
  );

  const saveCorridorConnectionModal = useCallback(() => {
    computeSaveCorridorConnectionModal({
      corridorConnectionModal,
      isReadOnly,
      markTouched,
      plan,
      push,
      t,
      updateFloorPlan,
      setCorridorConnectionModal
    });
  }, [corridorConnectionModal, isReadOnly, markTouched, plan, push, t, updateFloorPlan, setCorridorConnectionModal]);

  return {
    startCorridorDoorDraw,
    insertCorridorJunctionPoint,
    openCorridorConnectionModalAt,
    openEditCorridorConnectionModal,
    saveCorridorConnectionModal
  };
};
