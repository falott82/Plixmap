import { useCallback } from 'react';
import {
  computeOpenEditCorridor,
  computeCreateCorridorFromPoly,
  computeSaveCorridorModal,
  computeUpdateCorridorLabelScale
} from './planViewCorridorGeometry';

// Corridor name/label editing handlers extracted from usePlanView (open edit,
// create-from-poly, save name modal, label-scale nudge). Thin wrappers over the
// existing compute* helpers; shared deps injected once. Bodies are verbatim.
export const usePlanCorridorNameHandlers = (deps: any) => {
  const {
    corridorById,
    isReadOnly,
    plan,
    t,
    setCorridorDrawMode,
    corridorModal,
    corridorNameInput,
    corridorNameEnInput,
    corridorShowNameInput,
    markTouched,
    push,
    updateFloorPlan,
    setSelectedCorridorId,
    setCorridorModal,
    setCorridorNameInput,
    setCorridorNameEnInput,
    setCorridorShowNameInput
  } = deps;

  const openEditCorridor = useCallback(
    (corridorId: string) =>
      computeOpenEditCorridor(corridorId, {
        corridorById,
        isReadOnly,
        setCorridorModal,
        setCorridorNameInput,
        setCorridorNameEnInput,
        setCorridorShowNameInput
      }),
    [corridorById, isReadOnly, setCorridorModal, setCorridorNameInput, setCorridorNameEnInput, setCorridorShowNameInput]
  );

  const handleCreateCorridorFromPoly = useCallback(
    (points: { x: number; y: number }[]) =>
      computeCreateCorridorFromPoly(points, {
        isReadOnly,
        plan,
        t,
        setCorridorDrawMode,
        setCorridorModal,
        setCorridorNameInput,
        setCorridorNameEnInput,
        setCorridorShowNameInput
      }),
    [isReadOnly, plan, t, setCorridorDrawMode, setCorridorModal, setCorridorNameInput, setCorridorNameEnInput, setCorridorShowNameInput]
  );

  const saveCorridorModal = useCallback(() => {
    computeSaveCorridorModal({
      corridorModal,
      corridorNameEnInput,
      corridorNameInput,
      corridorShowNameInput,
      isReadOnly,
      markTouched,
      plan,
      push,
      t,
      updateFloorPlan,
      setSelectedCorridorId,
      setCorridorModal,
      setCorridorNameInput,
      setCorridorNameEnInput
    });
  }, [corridorModal, corridorNameEnInput, corridorNameInput, corridorShowNameInput, isReadOnly, markTouched, plan, push, t, updateFloorPlan, setSelectedCorridorId, setCorridorModal, setCorridorNameInput, setCorridorNameEnInput]);

  const updateCorridorLabelScale = useCallback(
    (corridorId: string, delta: number) =>
      computeUpdateCorridorLabelScale(corridorId, delta, { isReadOnly, markTouched, plan, updateFloorPlan }),
    [isReadOnly, markTouched, plan, updateFloorPlan]
  );

  return { openEditCorridor, handleCreateCorridorFromPoly, saveCorridorModal, updateCorridorLabelScale };
};
