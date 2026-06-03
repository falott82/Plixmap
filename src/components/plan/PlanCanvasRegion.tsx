import { ChevronDown, ChevronRight, Eye, EyeOff, Pencil, Cog, Camera, StickyNote, Image as ImageIcon, Type as TypeIcon } from 'lucide-react';
import Toolbar from './Toolbar';
import CanvasStage from './CanvasStage';
import CanvasErrorBoundary from './CanvasErrorBoundary';
import { Corridor, FloorPlan } from '../../store/types';
import { ALL_ITEMS_LAYER_ID } from '../../store/data';
import { isRackLinkId, normalizeDoorVerificationHistory } from './planViewUtils';
import { usePlanView } from './usePlanView';

type PlanCanvasRegionProps = Pick<ReturnType<typeof usePlanView>, 'allItemsLabel' | 'allItemsSelected' | 'allTypesOpen' | 'annotationsOpen' | 'autoFitEnabled' | 'basePlan' | 'canvasPlan' | 'canvasStageRef' | 'clearSelection' | 'client' | 'computeRoomReassignments' | 'computeRoomSurfaceSqm' | 'corridorDoorDraft' | 'corridorDrawMode' | 'createRoomDoorFromDraft' | 'deskPaletteDefs' | 'deskPaletteOrder' | 'desksOpen' | 'effectiveVisibleLayerIds' | 'getCorridorPolygon' | 'goToDefaultView' | 'gridSize' | 'gridSnapEnabled' | 'handleCorridorConnectionContextMenu' | 'handleCorridorContextMenu' | 'handleCorridorDoorContextMenu' | 'handleCorridorDoorDraftPoint' | 'handleCorridorQuickMenu' | 'handleCreateCorridorFromPoly' | 'handleCreateRoomFromPoly' | 'handleCreateRoomFromRect' | 'handleEdit' | 'handleLinkContextMenu' | 'handleMapContextMenu' | 'handleMapMouseDown' | 'handleMapMouseMove' | 'handleObjectContextMenu' | 'handlePanChange' | 'handlePlaceNew' | 'handleRoomContextMenu' | 'handleRoomDoorContextMenu' | 'handleSafetyCardChange' | 'handleSafetyCardContextMenu' | 'handleScaleContextMenu' | 'handleScaleDoubleClick' | 'handleScaleMove' | 'handleStageMove' | 'handleStageMoveStart' | 'handleStageSelect' | 'handleTogglePresentation' | 'handleToolDoubleClick' | 'handleToolMove' | 'handleToolPoint' | 'handleWallDraftContextMenu' | 'handleWallMove' | 'handleWallQuickMenu' | 'handleWallSegmentDblClick' | 'handleZoomChange' | 'hasDefaultView' | 'hasNavigationEdits' | 'hasRoomOverlap' | 'hideAllLayers' | 'highlight' | 'highlightRoom' | 'insertCorridorJunctionPoint' | 'isReadOnly' | 'isWallType' | 'lang' | 'layerIds' | 'layersOpen' | 'linkCreateHint' | 'mapRef' | 'markTouched' | 'measureAreaLabel' | 'measureClosed' | 'measureLabel' | 'measurePointer' | 'measurePoints' | 'meetingStatusByRoomId' | 'metersPerPixel' | 'navigate' | 'normalizeLayerSelection' | 'notifyRoomOverlap' | 'objectTypeIcons' | 'objectsOpen' | 'openCorridorDoorModal' | 'openEditRoom' | 'openPhotoViewer' | 'openRackLinkPorts' | 'openRoomDoorModal' | 'openRoomMeetingsTimeline' | 'orderedPlanLayers' | 'otherPaletteDefs' | 'paletteHasCustom' | 'paletteHasMore' | 'paletteIsEmpty' | 'paletteOrder' | 'paletteSettingsSection' | 'pan' | 'panToolActive' | 'pendingType' | 'perfEnabled' | 'plan' | 'planId' | 'planLayers' | 'planScale' | 'presentationMode' | 'printAreaMode' | 'push' | 'quoteDraftLabel' | 'quoteLabels' | 'quotePointer' | 'quotePoints' | 'removeTypeFromPalette' | 'renderPlan' | 'requestSaveAndNavigate' | 'roomDoorDraft' | 'roomDrawMode' | 'roomStatsById' | 'safetyCardColorIndex' | 'safetyCardFontIndex' | 'safetyCardFontSize' | 'safetyCardPos' | 'safetyCardSize' | 'safetyCardTextBgIndex' | 'safetyNumbersInline' | 'safetyPointsInline' | 'scaleDraft' | 'scaleDraftPointer' | 'scaleLine' | 'scalePromptDismissed' | 'securityLayerVisible' | 'securityOpen' | 'securityPaletteDefs' | 'selectedCorridorDoor' | 'selectedCorridorId' | 'selectedLinkId' | 'selectedObjectId' | 'selectedObjectIds' | 'selectedRoomDoorId' | 'selectedRoomId' | 'selectedRoomIds' | 'setAllTypesDefaultTab' | 'setAllTypesOpen' | 'setAnnotationsOpen' | 'setContextMenu' | 'setCorridorQuickMenu' | 'setDesksOpen' | 'setEmergencyContactsOpen' | 'setHideAllLayers' | 'setLayersOpen' | 'setLinkEditId' | 'setMeasureMode' | 'setObjectRoomIds' | 'setObjectsOpen' | 'setPaletteSection' | 'setPanToolActive' | 'setPendingType' | 'setPrintAreaMode' | 'setRoomDrawMode' | 'setScaleMode' | 'setScalePromptDismissed' | 'setSecurityOpen' | 'setSelectedCorridorDoor' | 'setSelectedCorridorId' | 'setSelectedLinkId' | 'setSelectedRoomDoorId' | 'setSelectedRoomId' | 'setSelectedRoomIds' | 'setSelection' | 'setViewsMenuOpen' | 'setVisibleLayerIds' | 'setWallDrawMode' | 'showGrid' | 'showPrintArea' | 'site' | 'startScaleMode' | 'startWallDraw' | 't' | 'toolMode' | 'updateCorridorLabelScale' | 'updateFloorPlan' | 'updateObject' | 'updateRoom' | 'wallAttenuationByType' | 'wallDraftPointer' | 'wallDraftPoints' | 'wallDrawMode' | 'wallDrawType' | 'wallTypeIdSet' | 'zoom'>;

const PlanCanvasRegion = (props: PlanCanvasRegionProps) => {
  const {
    allItemsLabel,
    allItemsSelected,
    allTypesOpen,
    annotationsOpen,
    autoFitEnabled,
    basePlan,
    canvasPlan,
    canvasStageRef,
    clearSelection,
    client,
    computeRoomReassignments,
    computeRoomSurfaceSqm,
    corridorDoorDraft,
    corridorDrawMode,
    createRoomDoorFromDraft,
    deskPaletteDefs,
    deskPaletteOrder,
    desksOpen,
    effectiveVisibleLayerIds,
    getCorridorPolygon,
    goToDefaultView,
    gridSize,
    gridSnapEnabled,
    handleCorridorConnectionContextMenu,
    handleCorridorContextMenu,
    handleCorridorDoorContextMenu,
    handleCorridorDoorDraftPoint,
    handleCorridorQuickMenu,
    handleCreateCorridorFromPoly,
    handleCreateRoomFromPoly,
    handleCreateRoomFromRect,
    handleEdit,
    handleLinkContextMenu,
    handleMapContextMenu,
    handleMapMouseDown,
    handleMapMouseMove,
    handleObjectContextMenu,
    handlePanChange,
    handlePlaceNew,
    handleRoomContextMenu,
    handleRoomDoorContextMenu,
    handleSafetyCardChange,
    handleSafetyCardContextMenu,
    handleScaleContextMenu,
    handleScaleDoubleClick,
    handleScaleMove,
    handleStageMove,
    handleStageMoveStart,
    handleStageSelect,
    handleTogglePresentation,
    handleToolDoubleClick,
    handleToolMove,
    handleToolPoint,
    handleWallDraftContextMenu,
    handleWallMove,
    handleWallQuickMenu,
    handleWallSegmentDblClick,
    handleZoomChange,
    hasDefaultView,
    hasNavigationEdits,
    hasRoomOverlap,
    hideAllLayers,
    highlight,
    highlightRoom,
    insertCorridorJunctionPoint,
    isReadOnly,
    isWallType,
    lang,
    layerIds,
    layersOpen,
    linkCreateHint,
    mapRef,
    markTouched,
    measureAreaLabel,
    measureClosed,
    measureLabel,
    measurePointer,
    measurePoints,
    meetingStatusByRoomId,
    metersPerPixel,
    navigate,
    normalizeLayerSelection,
    notifyRoomOverlap,
    objectTypeIcons,
    objectsOpen,
    openCorridorDoorModal,
    openEditRoom,
    openPhotoViewer,
    openRackLinkPorts,
    openRoomDoorModal,
    openRoomMeetingsTimeline,
    orderedPlanLayers,
    otherPaletteDefs,
    paletteHasCustom,
    paletteHasMore,
    paletteIsEmpty,
    paletteOrder,
    paletteSettingsSection,
    pan,
    panToolActive,
    pendingType,
    perfEnabled,
    plan,
    planId,
    planLayers,
    planScale,
    presentationMode,
    printAreaMode,
    push,
    quoteDraftLabel,
    quoteLabels,
    quotePointer,
    quotePoints,
    removeTypeFromPalette,
    renderPlan,
    requestSaveAndNavigate,
    roomDoorDraft,
    roomDrawMode,
    roomStatsById,
    safetyCardColorIndex,
    safetyCardFontIndex,
    safetyCardFontSize,
    safetyCardPos,
    safetyCardSize,
    safetyCardTextBgIndex,
    safetyNumbersInline,
    safetyPointsInline,
    scaleDraft,
    scaleDraftPointer,
    scaleLine,
    scalePromptDismissed,
    securityLayerVisible,
    securityOpen,
    securityPaletteDefs,
    selectedCorridorDoor,
    selectedCorridorId,
    selectedLinkId,
    selectedObjectId,
    selectedObjectIds,
    selectedRoomDoorId,
    selectedRoomId,
    selectedRoomIds,
    setAllTypesDefaultTab,
    setAllTypesOpen,
    setAnnotationsOpen,
    setContextMenu,
    setCorridorQuickMenu,
    setDesksOpen,
    setEmergencyContactsOpen,
    setHideAllLayers,
    setLayersOpen,
    setLinkEditId,
    setMeasureMode,
    setObjectRoomIds,
    setObjectsOpen,
    setPaletteSection,
    setPanToolActive,
    setPendingType,
    setPrintAreaMode,
    setRoomDrawMode,
    setScaleMode,
    setScalePromptDismissed,
    setSecurityOpen,
    setSelectedCorridorDoor,
    setSelectedCorridorId,
    setSelectedLinkId,
    setSelectedRoomDoorId,
    setSelectedRoomId,
    setSelectedRoomIds,
    setSelection,
    setViewsMenuOpen,
    setVisibleLayerIds,
    setWallDrawMode,
    showGrid,
    showPrintArea,
    site,
    startScaleMode,
    startWallDraw,
    t,
    toolMode,
    updateCorridorLabelScale,
    updateFloorPlan,
    updateObject,
    updateRoom,
    wallAttenuationByType,
    wallDraftPointer,
    wallDraftPoints,
    wallDrawMode,
    wallDrawType,
    wallTypeIdSet,
    zoom,
  } = props;

  if (!renderPlan) return null;

  return (
	      <div className="flex-1 min-h-0">
	        <div className={`relative flex h-full min-h-0 overflow-hidden ${presentationMode ? 'gap-0' : 'gap-4'}`}>
	        <div className="flex-1 min-w-0 min-h-0">
	            <div
                className={`relative h-full min-h-0 w-full ${panToolActive ? 'cursor-grab active:cursor-grabbing' : ''}`}
                ref={mapRef}
                onMouseMove={handleMapMouseMove}
                onMouseDown={handleMapMouseDown}
              >
                {!presentationMode && !planScale?.metersPerPixel && !scalePromptDismissed ? (
                  <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2">
                    <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-slate-900/90 px-4 py-2 text-sm font-semibold text-slate-100 shadow-lg">
                      <span>
                        {t({
                          it: 'Imposta la scala della planimetria per misurazioni accurate.',
                          en: 'Set your floor plan scale for accurate measurements.'
                        })}
                      </span>
                      <button
                        onClick={() => setScalePromptDismissed(true)}
                        className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-rose-500"
                      >
                        {t({ it: 'Annulla', en: 'Cancel' })}
                      </button>
                      <button
                        onClick={() => startScaleMode()}
                        disabled={isReadOnly}
                        className="rounded-full bg-sky-500 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {t({ it: 'Imposta scala', en: 'Set scale' })}
                      </button>
                    </div>
                  </div>
                ) : null}
		                        <CanvasErrorBoundary>
		                        <CanvasStage
		                        ref={canvasStageRef}
		                        containerRef={mapRef}
		                        presentationMode={presentationMode}
		                        onTogglePresentation={() => handleTogglePresentation()}
		                        plan={(canvasPlan || renderPlan) as any}
	                        selectedId={selectedObjectId}
	                        selectedIds={selectedObjectIds}
	                    selectedRoomId={selectedRoomId}
                      selectedRoomIds={selectedRoomIds}
                      selectedCorridorId={selectedCorridorId}
	                    selectedLinkId={selectedLinkId}
				                highlightId={highlight?.objectId}
				                highlightUntil={highlight?.until}
	                    highlightRoomId={highlightRoom?.roomId}
	                    highlightRoomUntil={highlightRoom?.until}
                    meetingRoomStatusById={meetingStatusByRoomId}
				                pendingType={pendingType}
				                readOnly={isReadOnly || presentationMode}
                        panToolActive={panToolActive}
                        onTogglePanTool={() => setPanToolActive((v) => !v)}
	                    roomDrawMode={roomDrawMode}
                      corridorDrawMode={corridorDrawMode}
                      printArea={(basePlan as any)?.printArea || null}
                      printAreaMode={printAreaMode}
                      showPrintArea={showPrintArea}
                      toolMode={toolMode}
                      onToolPoint={handleToolPoint}
                      onToolMove={handleToolMove}
                      onToolDoubleClick={handleToolDoubleClick}
                      onWallDraftContextMenu={handleWallDraftContextMenu}
                      onWallSegmentDblClick={handleWallSegmentDblClick}
                      onWallClick={handleWallQuickMenu}
                      wallTypeIds={wallTypeIdSet}
                      wallDraft={{ points: wallDraftPoints, pointer: wallDraftPointer }}
                      scaleDraft={{ start: scaleDraft?.start, end: scaleDraft?.end, pointer: scaleDraftPointer }}
                      scaleLine={scaleLine || undefined}
                      onScaleContextMenu={handleScaleContextMenu}
                      onScaleDoubleClick={handleScaleDoubleClick}
                      onScaleMove={handleScaleMove}
                      measureDraft={{
                        points: measurePoints,
                        pointer: measurePointer,
                        closed: measureClosed,
                        label: measureLabel || undefined,
                        areaLabel: measureAreaLabel || undefined
                      }}
                      quoteDraft={{
                        points: quotePoints,
                        pointer: quotePointer,
                        label: quoteDraftLabel || undefined
                      }}
                      quoteLabels={quoteLabels}
                      metersPerPixel={metersPerPixel}
                      wallAttenuationByType={wallAttenuationByType}
                      onSetPrintArea={(rect) => {
                        if (isReadOnly) return;
                        updateFloorPlan(basePlan.id, { printArea: rect });
                        setPrintAreaMode(false);
                        push(t({ it: 'Area di stampa impostata correttamente', en: 'Print area set successfully' }), 'success');
                      }}
                      safetyCard={{
                        visible: securityLayerVisible,
                        x: safetyCardPos.x,
                        y: safetyCardPos.y,
                        w: safetyCardSize.w,
                        h: safetyCardSize.h,
                        fontSize: safetyCardFontSize,
                        fontIndex: safetyCardFontIndex,
                        colorIndex: safetyCardColorIndex,
                        textBgIndex: safetyCardTextBgIndex,
                        title: t({ it: 'Scheda sicurezza', en: 'Safety card' }),
                        numbersLabel: t({ it: 'Numeri utili', en: 'Emergency numbers' }),
                        pointsLabel: t({ it: 'Punti di ritrovo', en: 'Meeting points' }),
                        numbersText: safetyNumbersInline,
                        pointsText: safetyPointsInline,
                        noNumbersText: t({ it: 'Nessun numero', en: 'No numbers' }),
                        noPointsText: t({ it: 'Nessun punto', en: 'No points' })
                      }}
                      onSafetyCardChange={handleSafetyCardChange}
                      onSafetyCardContextMenu={handleSafetyCardContextMenu}
                      onSafetyCardDoubleClick={() => {
                        if (!client?.id) return;
                        setEmergencyContactsOpen(true);
                      }}
	                    objectTypeIcons={objectTypeIcons}
                      snapEnabled={gridSnapEnabled}
                      gridSize={gridSize}
                      showGrid={showGrid}
					                zoom={zoom}
					                pan={pan}
					                autoFit={autoFitEnabled && !hasDefaultView}
                      hasDefaultView={hasDefaultView}
                      onToggleViewsMenu={() => setViewsMenuOpen((v) => !v)}
                      perfEnabled={perfEnabled}
				                onZoomChange={handleZoomChange}
			                onPanChange={handlePanChange}
					                onSelect={handleStageSelect}
                      roomStatsById={roomStatsById}
                      onSelectRooms={(ids) => {
                        setSelectedRoomIds(ids);
                        setSelectedRoomId(ids.length === 1 ? ids[0] : undefined);
                        setSelectedCorridorId(undefined);
                        setSelectedCorridorDoor(null);
                        setSelectedRoomDoorId(null);
                      }}
	                    onSelectLink={(id) => {
	                      if (!id) {
	                        setSelectedLinkId(null);
	                        return;
	                      }
	                      if (isRackLinkId(id)) {
	                        openRackLinkPorts(id);
	                        setSelectedLinkId(id);
	                        setContextMenu(null);
	                        clearSelection();
	                        setSelectedRoomId(undefined);
                        setSelectedRoomIds([]);
                        setSelectedCorridorId(undefined);
                        setSelectedCorridorDoor(null);
                        setSelectedRoomDoorId(null);
	                        return;
	                      }
	                      setSelectedLinkId(id || null);
	                      setContextMenu(null);
	                      clearSelection();
	                      setSelectedRoomId(undefined);
                      setSelectedRoomIds([]);
                      setSelectedCorridorId(undefined);
                      setSelectedCorridorDoor(null);
                      setSelectedRoomDoorId(null);
	                    }}
	                    onSelectMany={(ids) => {
                      setSelectedLinkId(null);
                      setSelectedCorridorId(undefined);
                      setSelectedCorridorDoor(null);
                      setSelectedRoomDoorId(null);
	                    setSelection(ids);
	                    setContextMenu(null);
	                  }}
                      onMoveStart={handleStageMoveStart}
					                onMove={handleStageMove}
                      onUpdateQuotePoints={(id, points) => {
                        if (isReadOnly) return;
                        if (!points.length) return;
                        markTouched();
                        updateObject(id, { points, x: points[0].x, y: points[0].y });
                      }}
					                onPlaceNew={handlePlaceNew}
		                onEdit={handleEdit}
		        onContextMenu={handleObjectContextMenu}
                    onLinkContextMenu={handleLinkContextMenu}
                    onRoomContextMenu={handleRoomContextMenu}
                    onMeetingBadgeDblClick={({ id }) => {
                      openRoomMeetingsTimeline(id);
                    }}
                    onCorridorContextMenu={handleCorridorContextMenu}
                    onCorridorConnectionContextMenu={handleCorridorConnectionContextMenu}
                    onCorridorDoorContextMenu={handleCorridorDoorContextMenu}
                    onCorridorDoorDblClick={({ corridorId, doorId }) => openCorridorDoorModal(corridorId, doorId)}
                    onCorridorClick={handleCorridorQuickMenu}
                    onCorridorMiddleClick={({ corridorId, worldX, worldY }) => {
                      insertCorridorJunctionPoint(corridorId, { x: worldX, y: worldY });
                      setCorridorQuickMenu(null);
                    }}
                    onCorridorDoorDraftPoint={handleCorridorDoorDraftPoint}
                    onLinkDblClick={(id) => {
                      if (isRackLinkId(id)) {
                        openRackLinkPorts(id);
                        return;
                      }
                      if (isReadOnly) return;
                      setLinkEditId(id);
                    }}
                    onMapContextMenu={handleMapContextMenu}
                    onGoDefaultView={goToDefaultView}
                    onSelectRoom={(roomId, options) => {
                      if (roomDoorDraft && roomId && Number.isFinite(Number(options?.worldX)) && Number.isFinite(Number(options?.worldY))) {
                        if (createRoomDoorFromDraft(roomId, { x: Number(options?.worldX), y: Number(options?.worldY) })) return;
                      }
                      const shouldPreserveSelection =
                        !!roomId && selectedRoomIds.length > 1 && selectedRoomIds.includes(roomId) && (!!options?.preserveSelection || !!options?.keepContext);
                      if (shouldPreserveSelection && roomId) {
                        clearSelection();
                        setSelectedLinkId(null);
                        setSelectedCorridorId(undefined);
                        setSelectedCorridorDoor(null);
                        setSelectedRoomDoorId(null);
                        setSelectedRoomId(roomId);
                        if (!options?.keepContext) setContextMenu(null);
                        return;
                      }
                      clearSelection();
                      setSelectedLinkId(null);
                      setSelectedCorridorId(undefined);
                      setSelectedCorridorDoor(null);
                      setSelectedRoomDoorId(null);
                      if (options?.multi && roomId) {
                        setSelectedRoomIds((prev) => {
                          const has = prev.includes(roomId);
                          const next = has ? prev.filter((id) => id !== roomId) : Array.from(new Set([...prev, roomId]));
                          setSelectedRoomId(next.length === 1 ? next[0] : undefined);
                          return next;
                        });
                        if (!options?.keepContext) setContextMenu(null);
                        return;
                      }
                      setSelectedRoomId(roomId);
                      setSelectedRoomIds(roomId ? [roomId] : []);
                      setSelectedCorridorId(undefined);
                      setSelectedRoomDoorId(null);
                      if (!options?.keepContext) setContextMenu(null);
                    }}
                    onSelectCorridor={(corridorId, options) => {
                      if (corridorDoorDraft?.corridorId && corridorId && corridorId !== corridorDoorDraft.corridorId) return;
                      clearSelection();
                      setSelectedRoomId(undefined);
                      setSelectedRoomIds([]);
                      setSelectedLinkId(null);
                      if (!corridorId || selectedCorridorDoor?.corridorId !== corridorId) setSelectedCorridorDoor(null);
                      setSelectedRoomDoorId(null);
                      setSelectedCorridorId(corridorId || undefined);
                      if (!options?.keepContext) setContextMenu(null);
                    }}
                    onSelectCorridorDoor={(payload) => {
                      if (!payload) {
                        setSelectedCorridorDoor(null);
                        return;
                      }
                      clearSelection();
                      setSelectedRoomId(undefined);
                      setSelectedRoomIds([]);
                      setSelectedLinkId(null);
                      setSelectedCorridorId(undefined);
                      setCorridorQuickMenu(null);
                      setSelectedRoomDoorId(null);
                      setSelectedCorridorDoor(payload);
                    }}
                    onSelectRoomDoor={(doorId) => {
                      if (!doorId) {
                        setSelectedRoomDoorId(null);
                        return;
                      }
                      clearSelection();
                      setSelectedRoomId(undefined);
                      setSelectedRoomIds([]);
                      setSelectedLinkId(null);
                      setSelectedCorridorId(undefined);
                      setSelectedCorridorDoor(null);
                      setCorridorQuickMenu(null);
                      setSelectedRoomDoorId(doorId);
                    }}
                    onRoomDoorContextMenu={handleRoomDoorContextMenu}
                    onRoomDoorDblClick={(doorId) => openRoomDoorModal(doorId)}
                    selectedRoomDoorId={selectedRoomDoorId}
                    selectedCorridorDoor={selectedCorridorDoor}
                    corridorDoorDraft={corridorDoorDraft}
                    roomDoorDraft={roomDoorDraft ? { roomAId: roomDoorDraft.roomAId, roomBId: roomDoorDraft.roomBId } : null}
                    onOpenRoomDetails={(roomId) => {
                      setSelectedRoomId(roomId);
                      setSelectedRoomIds([roomId]);
                      setSelectedCorridorId(undefined);
                      setSelectedCorridorDoor(null);
                      setSelectedRoomDoorId(null);
                      openEditRoom(roomId);
                    }}
                    onCreateRoom={(shape) => {
                      if (shape.kind === 'rect') handleCreateRoomFromRect(shape.rect);
                      else handleCreateRoomFromPoly(shape.points);
                    }}
                    onCreateCorridor={(shape) => {
                      if (shape.kind === 'poly') handleCreateCorridorFromPoly(shape.points);
                    }}
                    onUpdateRoom={(roomId, payload) => {
                      if (isReadOnly) return;
                      const currentRoom = ((plan as FloorPlan).rooms || []).find((r) => r.id === roomId);
                      if (currentRoom) {
                        const nextRoom = { ...currentRoom, ...payload };
                        if (hasRoomOverlap(nextRoom, roomId)) {
                          notifyRoomOverlap();
                          return;
                        }
                      }
                      markTouched();
                      const resolvedPayload =
                        metersPerPixel && currentRoom
                          ? { ...payload, surfaceSqm: computeRoomSurfaceSqm({ ...currentRoom, ...payload }, metersPerPixel) }
                          : payload;
                      const nextRooms = ((plan as FloorPlan).rooms || []).map((r) => (r.id === roomId ? { ...r, ...resolvedPayload } : r));
                      updateRoom((plan as FloorPlan).id, roomId, resolvedPayload as any);
                      const updates = computeRoomReassignments(nextRooms, (plan as FloorPlan).objects);
                      if (Object.keys(updates).length) setObjectRoomIds((plan as FloorPlan).id, updates);
                    }}
                    onUpdateCorridor={(corridorId, payload) => {
                      if (isReadOnly) return;
                      const sanitizePoints = (points: { x: number; y: number }[] | undefined) =>
                        (points || [])
                          .filter((p) => Number.isFinite(Number((p as any)?.x)) && Number.isFinite(Number((p as any)?.y)))
                          .map((p) => ({ x: Number((p as any).x), y: Number((p as any).y) }));
                      const current = (((plan as FloorPlan).corridors || []) as Corridor[]).filter(Boolean);
                      const next = current.map((corridor) => {
                        if (corridor.id !== corridorId) return corridor;
                        const currentPoints = sanitizePoints(getCorridorPolygon(corridor));
                        const nextPointsRaw = Array.isArray(payload.points) ? sanitizePoints(payload.points as any) : currentPoints;
                        const resolvedKind = (payload.kind || corridor.kind || (nextPointsRaw.length >= 3 ? 'poly' : 'rect')) as 'rect' | 'poly';
                        const nextPoints = resolvedKind === 'poly' ? (nextPointsRaw.length >= 3 ? nextPointsRaw : currentPoints) : currentPoints;
                        const nextDoors = Array.isArray(payload.doors)
                          ? payload.doors
                              .filter((door) => door && door.id)
                              .map((door) => ({
                                ...door,
                                edgeIndex: Number(door.edgeIndex),
                                t: Number(door.t),
                                edgeIndexTo: Number.isFinite(Number((door as any).edgeIndexTo)) ? Number((door as any).edgeIndexTo) : undefined,
                                tTo: Number.isFinite(Number((door as any).tTo)) ? Number((door as any).tTo) : undefined,
                                mode:
                                  (door as any).mode === 'auto_sensor' ||
                                  (door as any).mode === 'automated' ||
                                  (door as any).mode === 'static'
                                    ? (door as any).mode
                                    : 'static',
                                automationUrl: typeof (door as any).automationUrl === 'string' ? String((door as any).automationUrl) : undefined,
                                catalogTypeId:
                                  typeof (door as any).catalogTypeId === 'string' ? String((door as any).catalogTypeId).trim() || undefined : undefined,
                                description:
                                  typeof (door as any).description === 'string' ? String((door as any).description).trim() || undefined : undefined,
                                isEmergency: !!(door as any).isEmergency,
                                isMainEntrance: !!(door as any).isMainEntrance,
                                isExternal: !!(door as any).isExternal,
                                isFireDoor: !!(door as any).isFireDoor,
                                lastVerificationAt:
                                  typeof (door as any).lastVerificationAt === 'string'
                                    ? String((door as any).lastVerificationAt).trim() || undefined
                                    : undefined,
                                verifierCompany:
                                  typeof (door as any).verifierCompany === 'string'
                                    ? String((door as any).verifierCompany).trim() || undefined
                                    : undefined,
                                verificationHistory: normalizeDoorVerificationHistory((door as any).verificationHistory),
                                linkedRoomIds: Array.isArray((door as any).linkedRoomIds)
                                  ? Array.from(new Set((door as any).linkedRoomIds.map((id: any) => String(id)).filter(Boolean)))
                                  : []
                              }))
                              .filter((door) => Number.isFinite(door.edgeIndex) && Number.isFinite(door.t))
                          : corridor.doors;
                        return {
                          ...corridor,
                          ...payload,
                          kind: resolvedKind,
                          points: nextPoints,
                          doors: nextDoors,
                          connections: Array.isArray(payload.connections)
                            ? payload.connections.map((cp) => ({
                                ...cp,
                                x: Number.isFinite(Number((cp as any)?.x)) ? Number((cp as any).x) : undefined,
                                y: Number.isFinite(Number((cp as any)?.y)) ? Number((cp as any).y) : undefined,
                                planIds: [...(cp.planIds || [])],
                                transitionType: (cp as any)?.transitionType === 'elevator' ? 'elevator' : 'stairs'
                              }))
                            : corridor.connections
                        };
                      });
                      markTouched();
                      updateFloorPlan((plan as FloorPlan).id, { corridors: next } as any);
                    }}
                    onAdjustCorridorLabelScale={updateCorridorLabelScale}
                    onUpdateObject={(id, changes) => {
                      if (isReadOnly) return;
                      markTouched();
                      updateObject(id, changes);
                    }}
                    onOpenPhoto={openPhotoViewer}
                    onMoveWall={handleWallMove}
                    suspendKeyboardShortcuts={allTypesOpen}
                    connectionPlanNamesById={Object.fromEntries(
                      ((site as any)?.floorPlans || []).map((fp: any) => [String(fp?.id || ''), String(fp?.name || fp?.id || '')])
                    )}
	              />
		                        </CanvasErrorBoundary>
	            </div>
	          </div>
            {!presentationMode && linkCreateHint ? (
              <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
                <div className="max-w-[720px] rounded-2xl bg-slate-900/90 px-4 py-3 text-white shadow-card backdrop-blur">
                  <div className="text-sm font-semibold">{linkCreateHint.title}</div>
                  <div className="mt-0.5 text-xs text-white/80">{linkCreateHint.subtitle}</div>
                </div>
              </div>
            ) : null}
		          {!isReadOnly && !presentationMode ? (
		            <aside className="sticky top-0 max-h-[calc(100vh-24px)] w-[9rem] shrink-0 self-start overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 pb-8 shadow-card">
                <div className="rounded-xl bg-slate-50/80 p-2">
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase text-slate-500">
                    <button
                      onClick={() => setAnnotationsOpen((prev) => !prev)}
                      className="flex items-center gap-1 rounded-md px-1 py-0.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                      title={
                        annotationsOpen
                          ? t({ it: 'Nascondi annotazioni', en: 'Collapse annotations' })
                          : t({ it: 'Mostra annotazioni', en: 'Expand annotations' })
                      }
                    >
                      {annotationsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span>{t({ it: 'Annotazioni', en: 'Annotations' })}</span>
                    </button>
                  </div>
                  {annotationsOpen ? (
                    <div className="mt-2 grid grid-cols-4 justify-items-center gap-3">
                      <button
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/plixmap-type', 'text');
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onClick={() => {
                          setWallDrawMode(false);
                          setMeasureMode(false);
                          setScaleMode(false);
                          setRoomDrawMode(null);
                          setPanToolActive(false);
                          setPendingType('text');
                          setPaletteSection('objects');
                        }}
                        title={t({ it: 'Aggiungi testo', en: 'Add text' })}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                          pendingType === 'text'
                            ? 'border-sky-300 bg-sky-100 text-sky-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <TypeIcon size={16} />
                      </button>
                      <button
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/plixmap-type', 'image');
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onClick={() => {
                          setWallDrawMode(false);
                          setMeasureMode(false);
                          setScaleMode(false);
                          setRoomDrawMode(null);
                          setPanToolActive(false);
                          setPendingType('image');
                          setPaletteSection('objects');
                        }}
                        title={t({ it: 'Aggiungi immagine', en: 'Add image' })}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                          pendingType === 'image'
                            ? 'border-sky-300 bg-sky-100 text-sky-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <ImageIcon size={16} />
                      </button>
                      <button
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/plixmap-type', 'photo');
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onClick={() => {
                          setWallDrawMode(false);
                          setMeasureMode(false);
                          setScaleMode(false);
                          setRoomDrawMode(null);
                          setPanToolActive(false);
                          setPendingType('photo');
                          setPaletteSection('objects');
                        }}
                        title={t({ it: 'Aggiungi foto', en: 'Add photo' })}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                          pendingType === 'photo'
                            ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Camera size={16} />
                      </button>
                      <button
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/plixmap-type', 'postit');
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onClick={() => {
                          setWallDrawMode(false);
                          setMeasureMode(false);
                          setScaleMode(false);
                          setRoomDrawMode(null);
                          setPanToolActive(false);
                          setPendingType('postit');
                          setPaletteSection('objects');
                        }}
                        title={t({ it: 'Aggiungi post-it', en: 'Add post-it' })}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                          pendingType === 'postit'
                            ? 'border-amber-300 bg-amber-100 text-amber-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <StickyNote size={16} />
                      </button>
                    </div>
                  ) : null}
                </div>
                {planLayers.length ? (
                  <div className="mt-3 rounded-xl bg-sky-50/80 p-2">
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase text-slate-500">
                      <button
                        onClick={() => setLayersOpen((prev) => !prev)}
                        className="flex items-center gap-1 rounded-md px-1 py-0.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                        title={
                          layersOpen ? t({ it: 'Nascondi livelli', en: 'Collapse layers' }) : t({ it: 'Mostra livelli', en: 'Expand layers' })
                        }
                      >
                        {layersOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span>{t({ it: 'Livelli', en: 'Layers' })}</span>
                      </button>
                      <div className="flex items-center gap-1">
	                        <button
	                          onClick={() => {
	                            const nextHidden = !hideAllLayers;
	                            setHideAllLayers(planId, nextHidden);
	                            if (nextHidden) {
	                              // Ensure the next layer click starts from an empty selection.
	                              setVisibleLayerIds(planId, []);
	                            }
	                          }}
	                          className="flex h-6 w-6 items-center justify-center rounded-md text-slate-600 hover:bg-slate-50"
	                          title={
	                            hideAllLayers
                              ? t({ it: 'Mostra livelli', en: 'Show layers' })
                              : t({ it: 'Nascondi livelli', en: 'Hide layers' })
                          }
                        >
                          {hideAllLayers ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>
	                        <button
	                          onClick={() => {
	                            const url = '/settings?tab=layers';
	                            if (hasNavigationEdits && !isReadOnly) {
	                              requestSaveAndNavigate(url);
	                              return;
	                            }
	                            navigate(url);
	                          }}
	                          className="flex h-6 w-6 items-center justify-center rounded-md text-slate-600 hover:bg-slate-50"
	                          title={t({ it: 'Gestisci layers', en: 'Manage layers' })}
	                        >
	                          <Cog size={14} />
	                        </button>
	                      </div>
	                    </div>
                    {layersOpen ? (
                      <div className="mt-2 flex flex-col gap-2">
                        {orderedPlanLayers.map((l: any) => {
                          const layerId = String(l.id);
                          const isOn = hideAllLayers
                            ? false
                            : layerId === ALL_ITEMS_LAYER_ID
                              ? allItemsSelected
                              : effectiveVisibleLayerIds.includes(layerId);
                          const label =
                            layerId === ALL_ITEMS_LAYER_ID
                              ? allItemsLabel
                              : (l?.name?.[lang] as string) || (l?.name?.it as string) || l.id;
                          return (
                            <button
                              key={layerId}
                              onClick={() => {
                                const base = hideAllLayers ? [] : effectiveVisibleLayerIds;
                                if (hideAllLayers) setHideAllLayers(planId, false);
                                if (layerId === ALL_ITEMS_LAYER_ID) {
                                  const showAll = hideAllLayers || !allItemsSelected;
                                  setVisibleLayerIds(planId, showAll ? layerIds : []);
                                  return;
                                }
                                const next = isOn ? base.filter((id) => id !== layerId) : [...base, layerId];
                                setVisibleLayerIds(planId, normalizeLayerSelection(next));
                              }}
                              className={`flex items-center justify-between rounded-xl border px-2 py-1 text-[11px] font-semibold ${
                                isOn ? 'border-sky-300 bg-sky-100 text-sky-700' : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                              title={label}
                            >
                              <span className="truncate">{label}</span>
                              <span
                                className="ml-2 h-2 w-2 shrink-0 rounded-full"
                                style={{ background: layerId === ALL_ITEMS_LAYER_ID ? '#000' : l.color || (isOn ? '#2563eb' : '#cbd5e1') }}
                              />
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="my-3 h-px w-full bg-slate-200" />
                <div className="space-y-3">
                  <div className="rounded-xl bg-amber-50/70 p-2">
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase text-slate-500">
                      <button
                        onClick={() => {
                          if (!deskPaletteDefs.length) return;
                          setPaletteSection('desks');
                          setDesksOpen((prev) => !prev);
                        }}
                        disabled={!deskPaletteDefs.length}
                        className="flex items-center gap-1 rounded-md px-1 py-0.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                        title={
                          desksOpen ? t({ it: 'Nascondi scrivanie', en: 'Collapse desks' }) : t({ it: 'Mostra scrivanie', en: 'Expand desks' })
                        }
                      >
                        {desksOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span>{t({ it: 'Scrivanie', en: 'Desks' })}</span>
                      </button>
                      <button
                        onClick={() => {
                          const url = '/settings?tab=objects&section=desks';
                          if (hasNavigationEdits && !isReadOnly) {
                            requestSaveAndNavigate(url);
                            return;
                          }
                          navigate(url);
                        }}
                        title={t({ it: 'Impostazioni scrivanie', en: 'Desk settings' })}
                        className="rounded-md p-1 text-slate-500 hover:bg-slate-50 hover:text-ink"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                    {desksOpen && deskPaletteDefs.length ? (
                      <div className="mt-3 flex flex-col items-center gap-3">
                        <Toolbar
                          defs={deskPaletteDefs}
                          order={deskPaletteOrder}
                          onSelectType={(type) => {
                            setPaletteSection('desks');
                            setWallDrawMode(false);
                            setMeasureMode(false);
                            setScaleMode(false);
                            setRoomDrawMode(null);
                            setPendingType(type);
                          }}
                          onRemoveFromPalette={(type) => removeTypeFromPalette(type)}
                          activeType={pendingType || (wallDrawMode ? wallDrawType : null)}
                          allowRemove
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="h-px w-full bg-slate-200" />
                  <div className="rounded-xl bg-emerald-50/70 p-2">
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase text-slate-500">
                      <button
                        onClick={() => {
                          if (!otherPaletteDefs.length) return;
                          setPaletteSection('objects');
                          setObjectsOpen((prev) => !prev);
                        }}
                        disabled={!otherPaletteDefs.length}
                        className="flex items-center gap-1 rounded-md px-1 py-0.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                        title={
                          objectsOpen ? t({ it: 'Nascondi oggetti', en: 'Collapse objects' }) : t({ it: 'Mostra oggetti', en: 'Expand objects' })
                        }
                      >
                        {objectsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span>{t({ it: 'Oggetti', en: 'Objects' })}</span>
                      </button>
                      <button
                        onClick={() => {
                          const url = '/settings?tab=objects&section=objects';
                          if (hasNavigationEdits && !isReadOnly) {
                            requestSaveAndNavigate(url);
                            return;
                          }
                          navigate(url);
                        }}
                        title={t({ it: 'Impostazioni oggetti', en: 'Object settings' })}
                        className="rounded-md p-1 text-slate-500 hover:bg-slate-50 hover:text-ink"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                    {objectsOpen && otherPaletteDefs.length ? (
                      <div className="mt-3 flex flex-col items-center gap-3">
                        <Toolbar
                          defs={otherPaletteDefs}
                          order={paletteOrder}
                          onSelectType={(type) => {
                            setPaletteSection('objects');
                            if (isWallType(type)) {
                              startWallDraw(type);
                              return;
                            }
                            setWallDrawMode(false);
                            setMeasureMode(false);
                            setScaleMode(false);
                            setRoomDrawMode(null);
                            setPendingType(type);
                          }}
                          onRemoveFromPalette={(type) => removeTypeFromPalette(type)}
                          activeType={pendingType || (wallDrawMode ? wallDrawType : null)}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="h-px w-full bg-slate-200" />
                  <div className="rounded-xl bg-rose-50/70 p-2">
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase text-slate-500">
                      <button
                        onClick={() => {
                          if (!securityPaletteDefs.length) return;
                          setPaletteSection('security');
                          setSecurityOpen((prev) => !prev);
                        }}
                        disabled={!securityPaletteDefs.length}
                        className="flex items-center gap-1 rounded-md px-1 py-0.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                        title={
                          securityOpen
                            ? t({ it: 'Nascondi sicurezza', en: 'Collapse safety' })
                            : t({ it: 'Mostra sicurezza', en: 'Expand safety' })
                        }
                      >
                        {securityOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span>{t({ it: 'Sicurezza', en: 'Safety' })}</span>
                      </button>
                      <button
                        onClick={() => {
                          const url = '/settings?tab=objects&section=security';
                          if (hasNavigationEdits && !isReadOnly) {
                            requestSaveAndNavigate(url);
                            return;
                          }
                          navigate(url);
                        }}
                        title={t({ it: 'Impostazioni sicurezza', en: 'Safety settings' })}
                        className="rounded-md p-1 text-slate-500 hover:bg-slate-50 hover:text-ink"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                    {securityOpen && securityPaletteDefs.length ? (
                      <div className="mt-3 flex flex-col items-center gap-3">
                        <Toolbar
                          defs={securityPaletteDefs}
                          onSelectType={(type) => {
                            setPaletteSection('security');
                            setWallDrawMode(false);
                            setMeasureMode(false);
                            setScaleMode(false);
                            setRoomDrawMode(null);
                            setPendingType(type);
                          }}
                          activeType={pendingType || (wallDrawMode ? wallDrawType : null)}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
                {paletteIsEmpty ? (
                  <button
                    onClick={() => {
                      if (hasNavigationEdits && !isReadOnly) {
                        requestSaveAndNavigate('/settings?tab=objects');
                        return;
                      }
                      navigate('/settings?tab=objects');
                    }}
                    className="mt-3 w-full rounded-xl border border-slate-200 bg-amber-50 px-2 py-2 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                    title={t({ it: 'Configura la palette', en: 'Configure the palette' })}
                  >
                    {t({ it: 'Aggiungi oggetti alla palette', en: 'Add objects to palette' })}
                  </button>
                ) : null}
                {/* Bottom action: show all types when favorites are enabled */}
                {paletteHasCustom && paletteHasMore ? (
                  <button
                    onClick={() => {
                      setAllTypesDefaultTab(paletteSettingsSection);
                      setAllTypesOpen(true);
                    }}
                    className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    title={t({ it: 'Mostra tutti gli oggetti', en: 'Show all objects' })}
                  >
                    {t({ it: 'Mostra tutti', en: 'Show all' })}
                  </button>
                ) : null}
		          </aside>
		          ) : null}
	        </div>
	      </div>
  );
};

export default PlanCanvasRegion;
