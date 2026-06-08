// Edit-open handlers extracted from usePlanView (open the edit modal for an
// object, incl. rack/desk/wall special-casing, plus the selection-list variants
// that remember to return to the list). Bodies are verbatim; deps injected once.
export const usePlanEditOpenHandlers = (deps: any) => {
  const {
    renderPlan,
    renderPlanObjectById,
    isDeskType,
    isWallType,
    openWallGroupModal,
    returnToSelectionListRef,
    setRackModal,
    setWallTypeModal,
    setModalState,
    setSelectedObjectsModalOpen,
    setLinkEditId
  } = deps;

  const handleEdit = (objectId: string) => {
    const obj = renderPlan?.objects.find((o: any) => o.id === objectId);
    if (obj?.type === 'rack') {
      setRackModal({ objectId });
      return;
    }
    if (obj && isDeskType(obj.type)) return;
    if (obj && isWallType(obj.type)) {
      if (openWallGroupModal(obj.id)) return;
      setWallTypeModal({ ids: [obj.id], typeId: obj.type });
      return;
    }
    setModalState({ mode: 'edit', objectId });
  };

  const openEditFromSelectionList = (objectId: string) => {
    returnToSelectionListRef.current = true;
    setSelectedObjectsModalOpen(false);
    const obj = renderPlanObjectById.get(objectId);
    if (obj && isDeskType(obj.type)) return;
    if (obj && isWallType(obj.type)) {
      if (openWallGroupModal(obj.id)) return;
      setWallTypeModal({ ids: [obj.id], typeId: obj.type });
      return;
    }
    setModalState({ mode: 'edit', objectId });
  };

  const openLinkEditFromSelectionList = (linkId: string) => {
    returnToSelectionListRef.current = true;
    setSelectedObjectsModalOpen(false);
    setLinkEditId(linkId);
  };

  return { handleEdit, openEditFromSelectionList, openLinkEditFromSelectionList };
};
