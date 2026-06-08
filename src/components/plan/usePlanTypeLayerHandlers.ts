import { useCallback } from 'react';
import { computeHandleCreateTypeLayer } from './planViewStageHandlers';

// Object-type / type-layer handlers extracted from usePlanView (select all of a
// type, delete all of a type, open the type-layer modal, create a type layer).
// Bodies are verbatim; shared deps (incl. the derived canManageLayers) injected.
export const usePlanTypeLayerHandlers = (deps: any) => {
  const {
    objectsByType,
    isReadOnly,
    canManageLayers,
    client,
    getTypeLayerIds,
    inferDefaultLayerIds,
    layerIdSet,
    markTouched,
    planLayers,
    push,
    setPlanDirty,
    t,
    typeLayerColor,
    typeLayerModal,
    typeLayerName,
    updateClientLayers,
    setSelection,
    setCountsOpen,
    setTypeMenu,
    setConfirmDelete,
    setTypeLayerModal
  } = deps;

  const handleSelectType = useCallback(
    (typeId: string) => {
      const ids = (objectsByType.get(typeId) || []).map((o: any) => o.id);
      if (!ids.length) return;
      setSelection(ids);
      setCountsOpen(false);
      setTypeMenu(null);
    },
    [objectsByType, setSelection, setCountsOpen, setTypeMenu]
  );

  const handleDeleteType = useCallback(
    (typeId: string) => {
      if (isReadOnly) return;
      const ids = (objectsByType.get(typeId) || []).map((o: any) => o.id);
      if (!ids.length) return;
      setConfirmDelete(ids);
      setCountsOpen(false);
      setTypeMenu(null);
    },
    [isReadOnly, objectsByType, setConfirmDelete, setCountsOpen, setTypeMenu]
  );

  const handleOpenTypeLayer = useCallback(
    (typeId: string, label: string) => {
      if (isReadOnly || !canManageLayers) return;
      setTypeLayerModal({ typeId, label });
      setTypeMenu(null);
    },
    [canManageLayers, isReadOnly, setTypeLayerModal, setTypeMenu]
  );

  const handleCreateTypeLayer = useCallback(() => {
    computeHandleCreateTypeLayer({
      canManageLayers,
      client,
      getTypeLayerIds,
      inferDefaultLayerIds,
      isReadOnly,
      layerIdSet,
      markTouched,
      planLayers,
      push,
      setPlanDirty,
      t,
      typeLayerColor,
      typeLayerModal,
      typeLayerName,
      updateClientLayers,
      setTypeLayerModal
    });
  }, [
    canManageLayers,
    client,
    getTypeLayerIds,
    inferDefaultLayerIds,
    isReadOnly,
    layerIdSet,
    markTouched,
    planLayers,
    push,
    setPlanDirty,
    t,
    typeLayerColor,
    typeLayerModal,
    typeLayerName,
    updateClientLayers,
    setTypeLayerModal
  ]);

  return { handleSelectType, handleDeleteType, handleOpenTypeLayer, handleCreateTypeLayer };
};
