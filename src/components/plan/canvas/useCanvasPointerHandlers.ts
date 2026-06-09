/* eslint-disable @typescript-eslint/no-explicit-any */
import { Corridor } from '../../../store/types';

// Stage pointer-event dispatchers (down/dblclick/move/up/leave) extracted from CanvasStage.
// Pure orchestration over the canvas hooks + tool/door/corridor/selection logic; the host passes
// every referenced value in via deps (bodies moved verbatim, behaviour preserved).
export const useCanvasPointerHandlers = (deps: any) => {
  const {
    corridorDrawMode,
    readOnly,
    isContextClick,
    undoCorridorDraftSegment,
    safetyCardTransformerRef,
    safetyCardSelected,
    isSafetyCardNode,
    setSafetyCardSelected,
    toolMode,
    onWallDraftContextMenu,
    isPanGesture,
    startPan,
    corridorDoorDraft,
    pointerToWorld,
    plan,
    getCorridorPolygonPoints,
    getClosestCorridorEdgePoint,
    onCorridorDoorDraftPoint,
    viewportRef,
    allowTool,
    onToolPoint,
    pendingType,
    beginTextDraft,
    onPlaceNew,
    isBoxSelectGesture,
    roomDrawMode,
    printAreaMode,
    beginSelectionBox,
    beginPrintDraft,
    beginRectDraft,
    addDraftPolyPoint,
    addCorridorDraftPolyPoint,
    onSelect,
    onOpenPhoto,
    findPhotoAtPoint,
    selectedIds,
    selectedId,
    lastPhotoOpenAtRef,
    onToolDoubleClick,
    quoteResizeRef,
    updateQuoteResizePreview,
    isTextDrafting,
    updateTextDraftRect,
    cameraRotateRef,
    scheduleCameraRotation,
    isPanning,
    movePan,
    onToolMove,
    pendingPreviewRef,
    pendingPreviewRaf,
    setPendingPreview,
    corridorDoorHover,
    setCorridorDoorHover,
    updateRectSnapPreview,
    updateSelectionBox,
    updateDraftPrintRect,
    isRectDrafting,
    updateDraftRect,
    updateCorridorDraftPointer,
    updateDraftPolyPointer,
    finalizeTextDraftRect,
    stopCameraRotation,
    finalizeSelectionBox,
    finalizeDraftPrintRect,
    finalizeDraftRect,
    endPan,
    clearRoomRectSnapHint,
    setDoorHoverCard,
    commitQuoteResize
  } = deps;

  const onMouseDown = (e: any) => {
    if (corridorDrawMode === 'poly' && !readOnly && isContextClick(e.evt)) {
      e.evt.preventDefault();
      e.cancelBubble = true;
      undoCorridorDraftSegment();
      return;
    }
    const isSafetyTransformerTarget = (() => {
      const transformer = safetyCardTransformerRef.current;
      if (!transformer || !safetyCardSelected) return false;
      let cursor: any = e.target;
      while (cursor) {
        if (cursor === transformer) return true;
        const parent = cursor.getParent?.();
        if (!parent || parent === cursor) break;
        cursor = parent;
      }
      return false;
    })();
    const isSafetyTarget = isSafetyCardNode(e.target) || isSafetyTransformerTarget;
    const isEmptyTarget = e.target === e.target.getStage() || e.target?.attrs?.name === 'bg-rect';
    if (!isSafetyTarget && safetyCardSelected) {
      setSafetyCardSelected(false);
    }
    if (toolMode === 'wall' && isContextClick(e.evt)) {
      e.evt.preventDefault();
      onWallDraftContextMenu?.();
      return;
    }
    if (isPanGesture(e.evt)) {
      e.evt.preventDefault();
      startPan(e);
      return;
    }
    if (corridorDoorDraft?.corridorId && !readOnly && !isContextClick(e.evt) && e.evt.button === 0) {
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (!pos) return;
      const world = pointerToWorld(pos.x, pos.y);
      const corridor = ((plan.corridors || []) as Corridor[]).find((c) => c.id === corridorDoorDraft.corridorId);
      const corridorPoints = corridor ? getCorridorPolygonPoints(corridor) : [];
      const snap = corridorPoints.length ? getClosestCorridorEdgePoint(corridorPoints, world) : null;
      if (snap && onCorridorDoorDraftPoint) {
        const maxDistance = 42 / Math.max(0.2, viewportRef.current.zoom || 1);
        const distance = Math.hypot(world.x - snap.x, world.y - snap.y);
        if (distance <= maxDistance) {
          onCorridorDoorDraftPoint({
            corridorId: corridorDoorDraft.corridorId,
            clientX: e.evt.clientX,
            clientY: e.evt.clientY,
            point: { edgeIndex: snap.edgeIndex, t: snap.t, x: snap.x, y: snap.y }
          });
        }
      }
      return;
    }
    if (allowTool && !isContextClick(e.evt) && e.evt.button === 0) {
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (!pos) return;
      const world = pointerToWorld(pos.x, pos.y);
      onToolPoint?.(world, { shiftKey: !!e.evt.shiftKey });
      return;
    }
    if (pendingType && !readOnly && !isContextClick(e.evt) && e.evt.button === 0) {
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (!pos) return;
      const world = pointerToWorld(pos.x, pos.y);
      if (pendingType === 'text') {
        beginTextDraft(world);
        return;
      }
      onPlaceNew(pendingType, world.x, world.y);
      return;
    }
    if (
      isEmptyTarget &&
      isBoxSelectGesture(e.evt) &&
      !pendingType &&
      (!roomDrawMode || readOnly) &&
      (!corridorDrawMode || readOnly) &&
      (!printAreaMode || readOnly) &&
      !toolMode
    ) {
      e.evt.preventDefault();
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (!pos) return;
      beginSelectionBox(pointerToWorld(pos.x, pos.y));
      return;
    }
    if (isContextClick(e.evt)) return;
    if (printAreaMode && !readOnly && e.evt.button === 0) {
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (!pos) return;
      const world = pointerToWorld(pos.x, pos.y);
      beginPrintDraft(world);
      return;
    }
    if (roomDrawMode === 'rect' && !readOnly && e.evt.button === 0) {
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (!pos) return;
      beginRectDraft(pointerToWorld(pos.x, pos.y));
      return;
    }
    if (roomDrawMode === 'poly' && !readOnly && e.evt.button === 0) {
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (!pos) return;
      const world = pointerToWorld(pos.x, pos.y);
      addDraftPolyPoint(world, viewportRef.current.zoom, !!e.evt.shiftKey);
      return;
    }
    if (corridorDrawMode === 'poly' && !readOnly && e.evt.button === 0) {
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (!pos) return;
      const world = pointerToWorld(pos.x, pos.y);
      addCorridorDraftPolyPoint(world, viewportRef.current.zoom);
      return;
    }
    // Clear selection on left-click empty area (no pending placement)
    if (!pendingType && !toolMode && !roomDrawMode && !corridorDrawMode && isEmptyTarget && e.evt.button === 0) onSelect(undefined);
  };
  const onDblClick = (e: any) => {
    if (typeof e.evt?.button === 'number' && e.evt.button !== 0) return;
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;
    const world = pointerToWorld(pos.x, pos.y);
    if (onOpenPhoto) {
      const hit = findPhotoAtPoint(world.x, world.y);
      if (hit) {
        const selectionSnapshot = selectedIds ? [...selectedIds] : selectedId ? [selectedId] : [];
        if (!selectionSnapshot.includes(hit.id)) selectionSnapshot.push(hit.id);
        const now = Date.now();
        if (now - lastPhotoOpenAtRef.current > 200) {
          lastPhotoOpenAtRef.current = now;
          onOpenPhoto({ id: hit.id, selectionIds: selectionSnapshot });
        }
        e.cancelBubble = true;
        return;
      }
    }
    if (!allowTool) return;
    e.cancelBubble = true;
    onToolDoubleClick?.(world);
  };
  const onMouseMove = (e: any) => {
    if (quoteResizeRef.current) {
      e.evt.preventDefault();
      updateQuoteResizePreview(!!e.evt.shiftKey);
      return;
    }
    if (isTextDrafting()) {
      updateTextDraftRect(e);
      return;
    }
    if (cameraRotateRef.current) {
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (pos) {
        const world = pointerToWorld(pos.x, pos.y);
        scheduleCameraRotation(world, !!e.evt.shiftKey);
      }
      return;
    }
    if (allowTool) {
      if (isPanning) {
        movePan(e);
        return;
      }
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (pos) {
        const world = pointerToWorld(pos.x, pos.y);
        onToolMove?.(world, { shiftKey: !!e.evt.shiftKey });
      }
      return;
    }
    if (pendingType && !readOnly) {
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (pos) {
        const world = pointerToWorld(pos.x, pos.y);
        pendingPreviewRef.current = world;
        if (!pendingPreviewRaf.current) {
          pendingPreviewRaf.current = requestAnimationFrame(() => {
            pendingPreviewRaf.current = null;
            const next = pendingPreviewRef.current;
            pendingPreviewRef.current = null;
            if (next) setPendingPreview(next);
          });
        }
      }
    }
    if (corridorDoorDraft?.corridorId && !readOnly) {
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (pos) {
        const world = pointerToWorld(pos.x, pos.y);
        const corridor = ((plan.corridors || []) as Corridor[]).find((c) => c.id === corridorDoorDraft.corridorId);
        const corridorPoints = corridor ? getCorridorPolygonPoints(corridor) : [];
        const snap = corridorPoints.length ? getClosestCorridorEdgePoint(corridorPoints, world) : null;
        if (snap) setCorridorDoorHover({ edgeIndex: snap.edgeIndex, t: snap.t, x: snap.x, y: snap.y });
        else setCorridorDoorHover(null);
      } else {
        setCorridorDoorHover(null);
      }
    } else if (corridorDoorHover) {
      setCorridorDoorHover(null);
    }
    {
      const pos = e.target.getStage()?.getPointerPosition();
      updateRectSnapPreview(pos ? pointerToWorld(pos.x, pos.y) : null);
    }
    if (updateSelectionBox(e)) return;
    if (updateDraftPrintRect(e)) return;
    if (roomDrawMode === 'rect' && !readOnly && isRectDrafting()) {
      const pos = e.target.getStage()?.getPointerPosition();
      if (pos) updateDraftRect(pointerToWorld(pos.x, pos.y));
      return;
    }
    if (corridorDrawMode === 'poly' && !readOnly) {
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (pos) updateCorridorDraftPointer(pointerToWorld(pos.x, pos.y));
      return;
    }
    if (roomDrawMode === 'poly' && !readOnly) {
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (pos) updateDraftPolyPointer(pointerToWorld(pos.x, pos.y), !!e.evt.shiftKey);
      return;
    }
    movePan(e);
  };
  const onMouseUp = (e: any) => {
    if (quoteResizeRef.current) {
      e.evt.preventDefault();
      commitQuoteResize();
      return;
    }
    if (isTextDrafting()) {
      const rect = finalizeTextDraftRect();
      if (rect && pendingType === 'text' && !readOnly) {
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        onPlaceNew('text', centerX, centerY, { textBoxWidth: rect.width, textBoxHeight: rect.height });
      }
      return;
    }
    if (stopCameraRotation()) return;
    if (finalizeSelectionBox()) return;
    if (isContextClick(e.evt)) return;
    if (finalizeDraftPrintRect()) return;
    if (finalizeDraftRect()) return;
    endPan();
  };
  const onMouseLeave = () => {
    if (quoteResizeRef.current) {
      commitQuoteResize();
      return;
    }
    if (isTextDrafting()) {
      const rect = finalizeTextDraftRect();
      if (rect && pendingType === 'text' && !readOnly) {
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        onPlaceNew('text', centerX, centerY, { textBoxWidth: rect.width, textBoxHeight: rect.height });
      }
      return;
    }
    if (stopCameraRotation()) return;
    if (finalizeSelectionBox()) return;
    if (finalizeDraftPrintRect()) return;
    if (finalizeDraftRect()) return;
    endPan();
    if (pendingType) {
      if (pendingPreviewRaf.current) cancelAnimationFrame(pendingPreviewRaf.current);
      pendingPreviewRaf.current = null;
      pendingPreviewRef.current = null;
      setPendingPreview(null);
    }
    setCorridorDoorHover(null);
    clearRoomRectSnapHint();
    setDoorHoverCard(null);
  };

  return { onMouseDown, onDblClick, onMouseMove, onMouseUp, onMouseLeave };
};
