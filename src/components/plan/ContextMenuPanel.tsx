import { BookmarkPlus, CalendarClock, Camera, ChevronRight, CornerDownRight, Copy, Crop, DoorOpen, ExternalLink, Eye, EyeOff, FileDown, Footprints, Home, Image as ImageIcon, Layers, LayoutGrid, Link2, MoveDiagonal, Pencil, PhoneCall, Plus, QrCode, Ruler, Square, StickyNote, Trash, Type as TypeIcon, User, Users, X } from 'lucide-react';

import { Corridor } from '../../store/types';

import { postAuditEvent } from '../../api/audit';
import { ALL_ITEMS_LAYER_ID, DEFAULT_WALL_TYPES, WIFI_RANGE_SCALE_MAX } from '../../store/data';

import { usePlanView } from './usePlanView';

type ContextMenuPanelProps = Pick<ReturnType<typeof usePlanView>, 'addLink' | 'alignMenuOpen' | 'alignSelection' | 'allItemsSelected' | 'basePlan' | 'beginCorridorPolyDraw' | 'canEditWallType' | 'client' | 'contextAssemblyMapsUrl' | 'contextIsAssemblyPoint' | 'contextIsCamera' | 'contextIsDesk' | 'contextIsMulti' | 'contextIsPhoto' | 'contextIsQuote' | 'contextIsRack' | 'contextIsText' | 'contextIsWall' | 'contextIsWifi' | 'contextLink' | 'contextMenu' | 'contextMenuRef' | 'contextObject' | 'contextObjectLinkCount' | 'contextObjectTypeLabel' | 'contextPhotoMulti' | 'contextQuoteLabelPos' | 'contextQuoteOrientation' | 'contextWallPolygon' | 'contextWifiBaseAreaSqm' | 'contextWifiBaseDiameterM' | 'contextWifiBaseRadiusM' | 'contextWifiEffectiveAreaSqm' | 'contextWifiEffectiveDiameterM' | 'contextWifiEffectiveRadiusM' | 'contextWifiRangeOn' | 'contextWifiRangeScale' | 'corridorById' | 'deleteLink' | 'deskCatalogDefs' | 'effectiveVisibleLayerIds' | 'getLayerLabel' | 'getSubmenuStyle' | 'goToDefaultView' | 'handleEdit' | 'hasDefaultView' | 'hideAllLayers' | 'isReadOnly' | 'lastQuoteColor' | 'layerIds' | 'layersContextMenu' | 'layersContextMenuRef' | 'mapSubmenu' | 'markTouched' | 'metersPerPixel' | 'normalizeLayerSelection' | 'openCorridorConnectionModalAt' | 'openCorridorDoorLinkModal' | 'openCorridorDoorModal' | 'openDuplicate' | 'openEditCorridorConnectionModal' | 'openEditRoom' | 'openEscapeRouteAt' | 'openMeetingManager' | 'openPhotoViewer' | 'openRoomDoorModal' | 'openRoomMeetingsTimeline' | 'openScaleEdit' | 'openWallGroupModal' | 'orderedPlanLayers' | 'plan' | 'planId' | 'planLayers' | 'planPhotoIds' | 'push' | 'renderPlan' | 'renderPlanObjectById' | 'requestClearScale' | 'roomDoors' | 'securityLayerVisible' | 'selectedObjectIds' | 'selectedRoomIds' | 'selectedWifiIds' | 'selectionHasDesk' | 'selectionHasPhoto' | 'selectionHasRack' | 'selectionPhotoIds' | 'setAlignMenuOpen' | 'setAllTypesDefaultTab' | 'setAllTypesOpen' | 'setBulkEditSelectionOpen' | 'setCableModal' | 'setConfirmClearObjects' | 'setConfirmDelete' | 'setConfirmDeleteRoomId' | 'setContextMenu' | 'setDeskCatalogOpen' | 'setEmergencyContactsOpen' | 'setExportModalOpen' | 'setHideAllLayers' | 'setLastObjectScale' | 'setLastQuoteColor' | 'setLastQuoteScale' | 'setLayersContextMenu' | 'setLinkCreateMode' | 'setLinkEditId' | 'setLinkFromId' | 'setLinksModalObjectId' | 'setMeasureMode' | 'setPaletteSection' | 'setPanToolActive' | 'setPendingType' | 'setPrintAreaMode' | 'setRealUserDetailsId' | 'setRoomCatalogOpen' | 'setRoomDrawMode' | 'setRoomKioskInfoModal' | 'setRoomLayoutExportModal' | 'setRoomMeasuresModal' | 'setScaleMode' | 'setSelectedCorridorDoor' | 'setSelectedLinkId' | 'setSelectedRoomDoorId' | 'setSelectedRoomId' | 'setSelectedRoomIds' | 'setSelection' | 'setViewModalOpen' | 'setVisibleLayerIds' | 'setWallCatalogOpen' | 'setWallDrawMode' | 'setWallTypeModal' | 'showPrintArea' | 'site' | 'startMeasure' | 'startQuote' | 'startRoomDoorDraft' | 'startScaleMode' | 't' | 'toggleMapSubmenu' | 'toggleSecurityCardVisibility' | 'toggleShowPrintArea' | 'totalLayerCount' | 'updateFloorPlan' | 'updateObject' | 'updateQuoteLabelPos' | 'visibleLayerCount' | 'wallTypeDefs'>;

const ContextMenuPanel = (props: ContextMenuPanelProps) => {
  const {
    addLink,
    alignMenuOpen,
    alignSelection,
    allItemsSelected,
    basePlan,
    beginCorridorPolyDraw,
    canEditWallType,
    client,
    contextAssemblyMapsUrl,
    contextIsAssemblyPoint,
    contextIsCamera,
    contextIsDesk,
    contextIsMulti,
    contextIsPhoto,
    contextIsQuote,
    contextIsRack,
    contextIsText,
    contextIsWall,
    contextIsWifi,
    contextLink,
    contextMenu,
    contextMenuRef,
    contextObject,
    contextObjectLinkCount,
    contextObjectTypeLabel,
    contextPhotoMulti,
    contextQuoteLabelPos,
    contextQuoteOrientation,
    contextWallPolygon,
    contextWifiBaseAreaSqm,
    contextWifiBaseDiameterM,
    contextWifiBaseRadiusM,
    contextWifiEffectiveAreaSqm,
    contextWifiEffectiveDiameterM,
    contextWifiEffectiveRadiusM,
    contextWifiRangeOn,
    contextWifiRangeScale,
    corridorById,
    deleteLink,
    deskCatalogDefs,
    effectiveVisibleLayerIds,
    getLayerLabel,
    getSubmenuStyle,
    goToDefaultView,
    handleEdit,
    hasDefaultView,
    hideAllLayers,
    isReadOnly,
    lastQuoteColor,
    layerIds,
    layersContextMenu,
    layersContextMenuRef,
    mapSubmenu,
    markTouched,
    metersPerPixel,
    normalizeLayerSelection,
    openCorridorConnectionModalAt,
    openCorridorDoorLinkModal,
    openCorridorDoorModal,
    openDuplicate,
    openEditCorridorConnectionModal,
    openEditRoom,
    openEscapeRouteAt,
    openMeetingManager,
    openPhotoViewer,
    openRoomDoorModal,
    openRoomMeetingsTimeline,
    openScaleEdit,
    openWallGroupModal,
    orderedPlanLayers,
    plan,
    planId,
    planLayers,
    planPhotoIds,
    push,
    renderPlan,
    renderPlanObjectById,
    requestClearScale,
    roomDoors,
    securityLayerVisible,
    selectedObjectIds,
    selectedRoomIds,
    selectedWifiIds,
    selectionHasDesk,
    selectionHasPhoto,
    selectionHasRack,
    selectionPhotoIds,
    setAlignMenuOpen,
    setAllTypesDefaultTab,
    setAllTypesOpen,
    setBulkEditSelectionOpen,
    setCableModal,
    setConfirmClearObjects,
    setConfirmDelete,
    setConfirmDeleteRoomId,
    setContextMenu,
    setDeskCatalogOpen,
    setEmergencyContactsOpen,
    setExportModalOpen,
    setHideAllLayers,
    setLastObjectScale,
    setLastQuoteColor,
    setLastQuoteScale,
    setLayersContextMenu,
    setLinkCreateMode,
    setLinkEditId,
    setLinkFromId,
    setLinksModalObjectId,
    setMeasureMode,
    setPaletteSection,
    setPanToolActive,
    setPendingType,
    setPrintAreaMode,
    setRealUserDetailsId,
    setRoomCatalogOpen,
    setRoomDrawMode,
    setRoomKioskInfoModal,
    setRoomLayoutExportModal,
    setRoomMeasuresModal,
    setScaleMode,
    setSelectedCorridorDoor,
    setSelectedLinkId,
    setSelectedRoomDoorId,
    setSelectedRoomId,
    setSelectedRoomIds,
    setSelection,
    setViewModalOpen,
    setVisibleLayerIds,
    setWallCatalogOpen,
    setWallDrawMode,
    setWallTypeModal,
    showPrintArea,
    site,
    startMeasure,
    startQuote,
    startRoomDoorDraft,
    startScaleMode,
    t,
    toggleMapSubmenu,
    toggleSecurityCardVisibility,
    toggleShowPrintArea,
    totalLayerCount,
    updateFloorPlan,
    updateObject,
    updateQuoteLabelPos,
    visibleLayerCount,
    wallTypeDefs,
  } = props;
  if (!contextMenu || !plan) return null;
  return (
        <>
        <div
          ref={contextMenuRef}
          className="context-menu-panel fixed z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="font-semibold text-ink">{t({ it: 'Menu', en: 'Menu' })}</span>
            <button
              onClick={() => setContextMenu(null)}
              className="text-slate-400 hover:text-ink"
              title={t({ it: 'Chiudi', en: 'Close' })}
            >
              <X size={14} />
            </button>
          </div>

          {planLayers.length &&
          contextMenu.kind !== 'corridor' &&
          contextMenu.kind !== 'corridor_connection' &&
          contextMenu.kind !== 'corridor_door' &&
          contextMenu.kind !== 'safety_card' &&
          !(contextMenu.kind === 'object' && contextIsText) ? (
            <button
              onClick={() => setLayersContextMenu((prev) => (prev ? null : { x: contextMenu.x, y: contextMenu.y }))}
              className="mt-2 flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
              title={t({ it: 'Livelli (mostra/nascondi)', en: 'Layers (show/hide)' })}
            >
              <span className="flex items-center gap-2">
                <Layers size={14} className="text-slate-500" /> {t({ it: 'Livelli', en: 'Layers' })}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                  {hideAllLayers ? '0' : String(visibleLayerCount)}/{String(totalLayerCount)}
                </span>
                <ChevronRight size={14} className={`text-slate-400 ${layersContextMenu ? 'rotate-90' : ''}`} />
              </span>
            </button>
          ) : null}

	          {contextMenu.kind === 'link' ? (
              <>
                <div className="mt-2 rounded-lg border border-slate-200 bg-white px-2 py-2">
                  <span className="badge badge-selected">{t({ it: 'Collegamento selezionato', en: 'Selected link' })}</span>
                  {contextLink ? (
                    <div className="mt-1 text-[11px] text-slate-600">
                      {(() => {
                        const from = renderPlanObjectById.get(contextLink.fromId);
                        const to = renderPlanObjectById.get(contextLink.toId);
                        return `${from?.name || contextLink.fromId} → ${to?.name || contextLink.toId}`;
                      })()}
                    </div>
                  ) : null}
                </div>
                {!isReadOnly ? (
	                  <button
	                    onClick={() => {
	                      if (contextMenu.kind !== 'link') return;
	                      setLinkEditId(contextMenu.id);
	                      setContextMenu(null);
	                    }}
	                    className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
	                    title={t({ it: 'Modifica descrizione', en: 'Edit description' })}
	                  >
                    <Pencil size={14} /> {t({ it: 'Modifica descrizione', en: 'Edit description' })}
                  </button>
                ) : null}
	                {!isReadOnly ? (
                    (contextLink as any)?.kind === 'cable' ? (
	                      <button
	                        onClick={() => {
	                          if (contextMenu.kind !== 'link') return;
	                          setCableModal({ mode: 'edit', linkId: contextMenu.id });
	                          setContextMenu(null);
	                        }}
	                        className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
	                        title={t({ it: 'Modifica stile', en: 'Edit style' })}
	                      >
                        <Pencil size={14} /> {t({ it: 'Modifica stile', en: 'Edit style' })}
                      </button>
                    ) : null
                  ) : null}
                  {!isReadOnly ? (
		                  <button
		                    onClick={() => {
		                      if (contextMenu.kind !== 'link') return;
		                      markTouched();
		                      deleteLink(basePlan.id, contextMenu.id);
	                      postAuditEvent({ event: 'link_delete', scopeType: 'plan', scopeId: basePlan.id, details: { id: contextMenu.id } });
	                      push(t({ it: 'Collegamento eliminato', en: 'Link deleted' }), 'info');
	                      setContextMenu(null);
	                      setSelectedLinkId(null);
	                    }}
	                    className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-600 hover:bg-rose-50"
	                    title={t({ it: 'Elimina collegamento', en: 'Delete link' })}
	                  >
                    <Trash size={14} /> {t({ it: 'Elimina collegamento', en: 'Delete link' })}
                  </button>
                ) : null}
              </>
            ) : contextMenu.kind === 'object' ? (
              <>
                {contextIsQuote ? (
                  <>
                    <div className="mt-2 rounded-lg border border-slate-200 bg-white px-2 py-2">
                      <span className="badge badge-selected">{t({ it: 'Quota selezionata', en: 'Selected quote' })}</span>
                    </div>
                    <button
                      onClick={() => {
                        handleEdit(contextMenu.id);
                        setContextMenu(null);
                      }}
                      className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                      title={t({ it: 'Dettagli quota', en: 'Quote details' })}
                    >
                      <Pencil size={14} /> {t({ it: 'Dettagli', en: 'Details' })}
                    </button>
                    <button
                      onClick={() => {
                        const ids =
                          selectedObjectIds.includes(contextMenu.id) && selectedObjectIds.length > 1
                            ? [...selectedObjectIds]
                            : [contextMenu.id];
                        setConfirmDelete(ids);
                      }}
                      className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-600 hover:bg-rose-50"
                      title={t({ it: 'Elimina quota', en: 'Delete quote' })}
                    >
                      <Trash size={14} /> {t({ it: 'Elimina quota', en: 'Delete quote' })}
                    </button>
                  </>
                ) : (
                  <>
                    {contextIsMulti ? (
                      <div className="mt-2 rounded-lg border border-slate-200 bg-white px-2 py-2">
                        <span className="badge badge-selected">
                          {t({
                            it: `${selectedObjectIds.length} oggetti selezionati`,
                            en: `${selectedObjectIds.length} objects selected`
                          })}
                        </span>
                      </div>
                    ) : (
                      <>
                        {!contextIsDesk && !contextIsWall ? (
                          <button
                            onClick={() => {
                              handleEdit(contextMenu.id);
                              setContextMenu(null);
                            }}
                            className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                            title={t({ it: 'Modifica', en: 'Edit' })}
                          >
                            <Pencil size={14} /> {t({ it: 'Modifica', en: 'Edit' })}
                          </button>
                        ) : null}
                        {contextIsPhoto ? (
                          <button
                            onClick={() => {
                              const ids =
                                contextIsMulti && selectedObjectIds.length ? [...selectedObjectIds] : [contextMenu.id];
                              openPhotoViewer({ id: contextMenu.id, selectionIds: ids });
                              setContextMenu(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                            title={t(
                              contextPhotoMulti
                                ? { it: 'Vedi galleria', en: 'View gallery' }
                                : { it: 'Vedi foto', en: 'View photo' }
                            )}
                          >
                            <ImageIcon size={14} className="text-slate-500" />{' '}
                            {t(
                              contextPhotoMulti
                                ? { it: 'Vedi galleria', en: 'View gallery' }
                                : { it: 'Vedi foto', en: 'View photo' }
                            )}
                          </button>
                        ) : null}
	                        {contextObject ? (
                          <button
                            onClick={() => {
                              if (!renderPlan) return;
                              const typeId = contextObject.type;
                              const ids = (renderPlan.objects || []).filter((o) => o.type === typeId).map((o) => o.id);
                              if (!ids.length) return;
                              setSelection(ids);
                              setSelectedRoomId(undefined);
                              setSelectedRoomIds([]);
                              setSelectedLinkId(null);
                              push(
                                t({
                                  it: `Selezionati ${ids.length} oggetti di tipo ${contextObjectTypeLabel}.`,
                                  en: `Selected ${ids.length} ${contextObjectTypeLabel} objects.`
                                }),
                                'info'
                              );
                              setContextMenu(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                            title={t({ it: 'Seleziona tutti gli oggetti di questo tipo', en: 'Select all objects of this type' })}
                          >
                            <LayoutGrid size={14} className="text-slate-500" />
                            {t({
                              it: `Seleziona tutti: ${contextObjectTypeLabel}`,
                              en: `Select all: ${contextObjectTypeLabel}`
                            })}
                          </button>
	                        ) : null}
                        {contextIsAssemblyPoint && contextAssemblyMapsUrl ? (
                          <button
                            onClick={() => {
                              window.open(contextAssemblyMapsUrl, '_blank', 'noopener,noreferrer');
                              setContextMenu(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                            title={t({ it: 'Apri in Google Maps', en: 'Open in Google Maps' })}
                          >
                            <ExternalLink size={14} className="text-slate-500" />
                            {t({ it: 'Apri in Google Maps', en: 'Open in Google Maps' })}
                          </button>
                        ) : null}
	                        {contextIsWifi ? (
                          <button
                            onClick={() => {
                              const ids =
                                contextIsMulti && selectedObjectIds.length
                                  ? selectedWifiIds
                                  : [contextMenu.id];
                              const nextValue = !contextWifiRangeOn;
                              ids.forEach((id) => updateObject(id, { wifiShowRange: nextValue }));
                              setContextMenu(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                            title={t({
                              it: contextWifiRangeOn ? 'Nascondi range access point' : 'Mostra range access point',
                              en: contextWifiRangeOn ? 'Hide access point range' : 'Show access point range'
                            })}
                          >
                            <Eye size={14} className="text-slate-500" />{' '}
                            {t({
                              it: contextWifiRangeOn ? 'Nascondi range' : 'Mostra range',
                              en: contextWifiRangeOn ? 'Hide range' : 'Show range'
                            })}
                          </button>
                        ) : null}
                        {contextIsWifi ? (
                          <div className="mt-2 rounded-lg bg-slate-50 px-2 py-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              <Ruler size={14} className="text-slate-500" />
                              {t({ it: 'Range Wi-Fi', en: 'Wi-Fi range' })}
                              <span className="ml-auto text-xs font-semibold text-slate-600 tabular-nums">
                                x{contextWifiRangeScale.toFixed(2)}
                              </span>
                            </div>
                              <input
                                key={`${contextMenu.id}-wifi-range-scale`}
                                type="range"
                                min={0}
                                max={WIFI_RANGE_SCALE_MAX}
                                step={0.05}
                                value={contextWifiRangeScale}
                                onChange={(e) => {
                                  if (!renderPlan) return;
                                  const next = Math.max(0, Math.min(WIFI_RANGE_SCALE_MAX, Number(e.target.value) || 0));
                                  const ids =
                                    contextIsMulti && selectedObjectIds.length
                                      ? selectedWifiIds
                                      : [contextMenu.id];
                                  ids.forEach((id) => updateObject(id, { wifiRangeScale: next }));
                                }}
                                className="mt-1 w-full"
                                title={t({ it: 'Estendi/riduci range (0..x20)', en: 'Extend/reduce range (0..x20)' })}
                              />
                              {contextWifiBaseRadiusM > 0 ? (
                                <div className="mt-1 space-y-0.5 text-[11px] text-slate-500">
                                  <div>
                                    {t({ it: 'Base', en: 'Base' })}: r ~{Math.round(contextWifiBaseRadiusM)}m · d ~
                                    {Math.round(contextWifiBaseDiameterM)}m · area ~{Math.round(contextWifiBaseAreaSqm)} m2
                                  </div>
                                  <div>
                                    {t({ it: 'Effettivo', en: 'Effective' })}: r ~{Math.round(contextWifiEffectiveRadiusM)}m · d ~
                                    {Math.round(contextWifiEffectiveDiameterM)}m · area ~{Math.round(contextWifiEffectiveAreaSqm)} m2
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-1 text-[11px] text-slate-500">
                                  {t({
                                    it: 'Imposta un coverage nel catalogo/proprietà per calcolare il range.',
                                    en: 'Set coverage in catalog/properties to compute range.'
                                  })}
                                </div>
                              )}
                          </div>
                        ) : null}
                        {contextIsWall && contextWallPolygon ? (
                          <button
                            onClick={() => {
                              openWallGroupModal(contextMenu.id);
                              setContextMenu(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                            title={t({ it: 'Modifica poligono', en: 'Edit polygon' })}
                          >
                            <Pencil size={14} /> {t({ it: 'Modifica poligono', en: 'Edit polygon' })}
                          </button>
                        ) : null}
                        {canEditWallType ? (
                          <button
                            onClick={() => {
                              const ids =
                                contextIsMulti && selectedObjectIds.length ? [...selectedObjectIds] : [contextMenu.id];
                              const fallbackType = contextObject?.type || wallTypeDefs[0]?.id || DEFAULT_WALL_TYPES[0];
                              if (!fallbackType) return;
                              setWallTypeModal({ ids, typeId: fallbackType });
                              setContextMenu(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                            title={t({ it: 'Cambia tipo muro', en: 'Change wall type' })}
                          >
                            <Pencil size={14} /> {t({ it: 'Cambia tipo muro', en: 'Change wall type' })}
                          </button>
                        ) : null}
                        {contextObject?.type === 'real_user' ? (
                          <button
                            onClick={() => {
                              setRealUserDetailsId(contextMenu.id);
                              setContextMenu(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                            title={t({
                              it: 'Mostra dettagli importati dell’utente reale',
                              en: 'Show imported details for this real user'
                            })}
                          >
                            <User size={14} className="text-slate-500" /> {t({ it: 'Dettagli utente', en: 'User details' })}
                          </button>
                        ) : null}
                        {contextObjectLinkCount && !contextIsPhoto ? (
                          <button
                            onClick={() => {
                              setLinksModalObjectId(contextMenu.id);
                              setContextMenu(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                            title={t({
                              it: 'Mostra tutti i collegamenti di questo oggetto',
                              en: 'Show all links for this object'
                            })}
                          >
                            <Link2 size={14} className="text-slate-500" />{' '}
                            {t({
                              it: `Mostra collegamenti (${contextObjectLinkCount})`,
                              en: `Show links (${contextObjectLinkCount})`
                            })}
                          </button>
                        ) : null}
                        {!contextIsRack && !contextIsDesk && !contextIsWall && !contextIsPhoto && !contextIsText ? (
                          <>
                            <div className="my-2 h-px bg-slate-100" />
                            <button
                              onClick={() => {
                                if (isReadOnly) return;
                                setLinkCreateMode('arrow');
                                setLinkFromId(contextMenu.id);
                                setContextMenu(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                              title={t({ it: 'Crea collegamento', en: 'Create link' })}
                            >
                              <MoveDiagonal size={14} className="text-slate-500" /> {t({ it: 'Crea collegamento', en: 'Create link' })}
                            </button>
                            <button
                              onClick={() => {
                                if (isReadOnly) return;
                                setLinkCreateMode('cable');
                                setLinkFromId(contextMenu.id);
                                setContextMenu(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                              title={t({ it: 'Crea collegamento 90°', en: 'Create 90° link' })}
                            >
                              <CornerDownRight size={14} className="text-slate-500" /> {t({ it: 'Crea collegamento 90°', en: 'Create 90° link' })}
                            </button>
                          </>
                        ) : null}
                        {!contextIsWall && !contextIsText ? (
                          <>
                            <div className="my-2 h-px bg-slate-100" />
                            <button
                              onClick={() => {
                                openDuplicate(contextMenu.id);
                                setContextMenu(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                              title={t({ it: 'Duplica', en: 'Duplicate' })}
                            >
                              <Copy size={14} /> {t({ it: 'Duplica', en: 'Duplicate' })}
                            </button>
                          </>
                        ) : null}
                        {!contextIsWall && !contextIsText ? (
                          <div className="mt-2 rounded-lg bg-slate-50 px-2 py-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              <MoveDiagonal size={14} />{' '}
                              {t({
                                it: contextIsQuote ? 'Scala quota' : 'Scala',
                                en: contextIsQuote ? 'Quote scale' : 'Scale'
                              })}
                              <span className="ml-auto text-xs font-semibold text-slate-600 tabular-nums">
                                {(contextObject?.scale ?? 1).toFixed(2)}
                              </span>
                            </div>
                            <input
                              key={contextMenu.id}
                              type="range"
                              min={contextIsQuote ? 0.5 : 0.2}
                              max={contextIsQuote ? 1.6 : 2.4}
                              step={0.05}
                              value={contextObject?.scale ?? 1}
                              onChange={(e) => {
                                const next = Number(e.target.value);
                                updateObject(contextMenu.id, { scale: next });
                                if (contextIsQuote) {
                                  setLastQuoteScale(next);
                                } else {
                                  setLastObjectScale(next);
                                }
                              }}
                              className="mt-1 w-full"
                            />
                          </div>
                        ) : null}
                        <div className="mt-2 rounded-lg bg-slate-50 px-2 py-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                            <Eye size={14} />{' '}
                            {t({
                              it: contextIsWall ? 'Opacità linea' : 'Opacità',
                              en: contextIsWall ? 'Line opacity' : 'Opacity'
                            })}
                            <span className="ml-auto text-xs font-semibold text-slate-600 tabular-nums">
                              {Math.round(((contextObject?.opacity ?? 1) || 1) * 100)}%
                            </span>
                          </div>
                          <input
                            key={`${contextMenu.id}-opacity`}
                            type="range"
                            min={0.2}
                            max={1}
                            step={0.05}
                            value={contextObject?.opacity ?? 1}
                            onChange={(e) => {
                              const next = Number(e.target.value);
                              updateObject(contextMenu.id, { opacity: next });
                            }}
                            className="mt-1 w-full"
                          />
                        </div>
                        {contextIsWall || contextIsQuote ? (
                          <div className="mt-2 rounded-lg bg-slate-50 px-2 py-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              <MoveDiagonal size={14} /> {t({ it: 'Spessore linea', en: 'Line thickness' })}
                              <span className="ml-auto text-xs font-semibold text-slate-600 tabular-nums">
                                {Number(contextObject?.strokeWidth ?? (contextIsQuote ? 2 : 1)).toFixed(1)} px
                              </span>
                            </div>
                            <input
                              key={`${contextMenu.id}-stroke-width`}
                              type="range"
                              min={contextIsQuote ? 0.5 : 1}
                              max={contextIsQuote ? 6 : 12}
                              step={contextIsQuote ? 0.1 : 1}
                              value={contextObject?.strokeWidth ?? (contextIsQuote ? 2 : 1)}
                              onChange={(e) => updateObject(contextMenu.id, { strokeWidth: Number(e.target.value) })}
                              className="mt-1 w-full"
                            />
                          </div>
                        ) : null}
                        {contextIsQuote ? (
                          <div className="mt-2 rounded-lg bg-slate-50 px-2 py-2">
                            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
                              <span>{t({ it: 'Colore quota', en: 'Quote color' })}</span>
                              <input
                                type="color"
                                value={contextObject?.strokeColor || lastQuoteColor || '#f97316'}
                                onChange={(e) => {
                                  const next = e.target.value;
                                  updateObject(contextMenu.id, { strokeColor: next });
                                  setLastQuoteColor(next);
                                }}
                                className="h-7 w-9 rounded border border-slate-200 bg-white"
                                title={t({ it: 'Colore quota', en: 'Quote color' })}
                              />
                            </div>
                            <div className="mt-2 text-xs font-semibold text-slate-600">
                              {t({ it: 'Posizione scritta', en: 'Label position' })}
                            </div>
                            <select
                              value={contextQuoteLabelPos}
                              onChange={(e) => {
                                const next = e.target.value as any;
                                updateQuoteLabelPos(contextMenu.id, next, contextQuoteOrientation);
                              }}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                              title={t({ it: 'Posizione etichetta quota', en: 'Quote label position' })}
                            >
                              {contextQuoteOrientation === 'vertical' ? (
                                <>
                                  <option value="left">{t({ it: 'Sinistra', en: 'Left' })}</option>
                                  <option value="center">{t({ it: 'Centro', en: 'Center' })}</option>
                                  <option value="right">{t({ it: 'Destra', en: 'Right' })}</option>
                                </>
                              ) : (
                                <>
                                  <option value="above">{t({ it: 'Sopra', en: 'Above' })}</option>
                                  <option value="center">{t({ it: 'Centro', en: 'Center' })}</option>
                                  <option value="below">{t({ it: 'Sotto', en: 'Below' })}</option>
                                </>
                              )}
                            </select>
                            <div className="mt-2 text-[11px] text-slate-500">
                              {t({
                                it: 'La prossima quota usa la stessa posizione in base all’orientamento.',
                                en: 'Next quotes reuse this position based on orientation.'
                              })}
                            </div>
                          </div>
                        ) : null}
                        {contextIsCamera ? (
                          <div className="mt-2 rounded-lg bg-slate-50 px-2 py-2">
                            <div className="text-xs font-semibold text-slate-600">{t({ it: 'CCTV', en: 'CCTV' })}</div>
                            <div className="mt-2">
                              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                                <span>{t({ it: 'Apertura', en: 'Angle' })}</span>
                                <span className="ml-auto text-xs font-semibold text-slate-600 tabular-nums">
                                  {Math.round(Number(contextObject?.cctvAngle ?? 70))}°
                                </span>
                              </div>
                              <input
                                key={`${contextMenu.id}-cctv-angle`}
                                type="range"
                                min={20}
                                max={160}
                                step={5}
                                value={contextObject?.cctvAngle ?? 70}
                                onChange={(e) => updateObject(contextMenu.id, { cctvAngle: Number(e.target.value) })}
                                className="mt-1 w-full"
                              />
                            </div>
                            <div className="mt-2">
                              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                                <span>{t({ it: 'Raggio', en: 'Range' })}</span>
                                <span className="ml-auto text-xs font-semibold text-slate-600 tabular-nums">
                                  {Math.round(Number(contextObject?.cctvRange ?? 160))}
                                </span>
                              </div>
                              <input
                                key={`${contextMenu.id}-cctv-range`}
                                type="range"
                                min={60}
                                max={600}
                                step={10}
                                value={contextObject?.cctvRange ?? 160}
                                onChange={(e) => updateObject(contextMenu.id, { cctvRange: Number(e.target.value) })}
                                className="mt-1 w-full"
                              />
                            </div>
                            <div className="mt-2">
                              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                                <span>{t({ it: 'Rotazione', en: 'Rotation' })}</span>
                                <span className="ml-auto text-xs font-semibold text-slate-600 tabular-nums">
                                  {Math.round(Number(contextObject?.rotation ?? 0))}°
                                </span>
                              </div>
                              <input
                                key={`${contextMenu.id}-cctv-rotation`}
                                type="range"
                                min={0}
                                max={360}
                                step={5}
                                value={contextObject?.rotation ?? 0}
                                onChange={(e) => updateObject(contextMenu.id, { rotation: Number(e.target.value) })}
                                className="mt-1 w-full"
                              />
                            </div>
                            <div className="mt-2">
                              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                                <span>{t({ it: 'Intensità', en: 'Intensity' })}</span>
                                <span className="ml-auto text-xs font-semibold text-slate-600 tabular-nums">
                                  {Math.round(((contextObject?.cctvOpacity ?? 0.6) || 0.6) * 100)}%
                                </span>
                              </div>
                              <input
                                key={`${contextMenu.id}-cctv-opacity`}
                                type="range"
                                min={0.1}
                                max={0.9}
                                step={0.05}
                                value={contextObject?.cctvOpacity ?? 0.6}
                                onChange={(e) => updateObject(contextMenu.id, { cctvOpacity: Number(e.target.value) })}
                                className="mt-1 w-full"
                              />
                            </div>
                          </div>
                        ) : null}
                        {contextIsDesk ? (
                          <div className="mt-2 rounded-lg bg-slate-50 px-2 py-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              <Pencil size={14} /> {t({ it: 'Linee scrivania', en: 'Desk lines' })}
                              <span className="ml-auto text-xs font-semibold text-slate-600 tabular-nums">
                                {(contextObject?.strokeWidth ?? 2).toFixed(1)}
                              </span>
                            </div>
                            <input
                              key={`${contextMenu.id}-stroke`}
                              type="range"
                              min={0.5}
                              max={6}
                              step={0.5}
                              value={contextObject?.strokeWidth ?? 2}
                              onChange={(e) => {
                                const next = Number(e.target.value);
                                updateObject(contextMenu.id, { strokeWidth: next });
                              }}
                              className="mt-1 w-full"
                            />
                            <div className="mt-2 flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
                              <span>{t({ it: 'Colore linee', en: 'Line color' })}</span>
                              <input
                                type="color"
                                value={contextObject?.strokeColor || '#cbd5e1'}
                                onChange={(e) => updateObject(contextMenu.id, { strokeColor: e.target.value })}
                                className="h-7 w-9 rounded border border-slate-200 bg-white"
                                title={t({ it: 'Colore linee', en: 'Line color' })}
                              />
                            </div>
                          </div>
                        ) : null}
                        {contextIsDesk ? (
                          <div className="mt-2 rounded-lg bg-slate-50 px-2 py-2">
                            <div className="text-xs font-semibold text-slate-600">{t({ it: 'Rotazione', en: 'Rotation' })}</div>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <button
                                onClick={() => {
                                  const current = Number(contextObject?.rotation || 0);
                                  updateObject(contextMenu.id, { rotation: (current - 90 + 360) % 360 });
                                }}
                                className="flex items-center justify-center gap-2 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                title={t({ it: 'Ruota 90° a sinistra', en: 'Rotate 90° left' })}
                              >
                                {t({ it: 'Sinistra', en: 'Left' })}
                              </button>
                              <button
                                onClick={() => {
                                  const current = Number(contextObject?.rotation || 0);
                                  updateObject(contextMenu.id, { rotation: (current + 90) % 360 });
                                }}
                                className="flex items-center justify-center gap-2 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                title={t({ it: 'Ruota 90° a destra', en: 'Rotate 90° right' })}
                              >
                                {t({ it: 'Destra', en: 'Right' })}
                              </button>
                            </div>
                          </div>
                        ) : null}
                        <div className="my-2 h-px bg-slate-100" />
                      </>
                    )}

                    {contextIsMulti ? (
                      <div className="relative mt-2">
                        <button
                          onClick={() => setAlignMenuOpen((v) => !v)}
                          className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          title={t({ it: 'Allinea', en: 'Align' })}
                        >
                          <span>{t({ it: 'Allinea', en: 'Align' })}</span>
                          <ChevronRight size={14} className="text-slate-400" />
                        </button>
                        {alignMenuOpen ? (
                          <div className="absolute left-full top-0 z-10 ml-2 w-40 rounded-xl border border-slate-200 bg-white p-2 text-xs shadow-card">
                            <div className="grid grid-cols-1 gap-1">
                              <button
                                onClick={() => {
                                  alignSelection('horizontal', contextMenu.id);
                                  setAlignMenuOpen(false);
                                  setContextMenu(null);
                                }}
                                className="rounded-md px-2 py-1 text-left font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                {t({ it: 'Allinea orizzontale', en: 'Align horizontally' })}
                              </button>
                              <button
                                onClick={() => {
                                  alignSelection('vertical', contextMenu.id);
                                  setAlignMenuOpen(false);
                                  setContextMenu(null);
                                }}
                                className="rounded-md px-2 py-1 text-left font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                {t({ it: 'Allinea verticale', en: 'Align vertically' })}
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {contextIsMulti && selectionPhotoIds.length > 1 ? (
                      <button
                        onClick={() => {
                          if (!selectionPhotoIds.length) return;
                          openPhotoViewer({ id: selectionPhotoIds[0], selectionIds: selectionPhotoIds });
                          setContextMenu(null);
                        }}
                        className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                        title={t({ it: 'Vedi galleria', en: 'View gallery' })}
                      >
                        <ImageIcon size={14} className="text-slate-500" /> {t({ it: 'Vedi galleria', en: 'View gallery' })}
                      </button>
                    ) : null}
                    {contextIsMulti ? (
                      !isReadOnly &&
                      selectedObjectIds.length === 2 &&
                      !selectionHasRack &&
                      !selectionHasDesk &&
                      !selectionHasPhoto ? (
                        <button
                          onClick={() => {
                            const [a, b] = selectedObjectIds;
                            if (!a || !b) return;
                            const links = ((basePlan.links || []) as any[]).filter(Boolean);
                            const existing = links.find(
                              (l) =>
                                (String((l as any).fromId || '') === a && String((l as any).toId || '') === b) ||
                                (String((l as any).fromId || '') === b && String((l as any).toId || '') === a)
                            );
                            if (existing) {
                              setSelectedLinkId(String(existing.id));
                              push(t({ it: 'Collegamento già presente', en: 'Link already exists' }), 'info');
                              setContextMenu(null);
                              return;
                            }
                            markTouched();
                            const id = addLink(basePlan.id, a, b, { kind: 'arrow', arrow: 'none' });
                            postAuditEvent({
                              event: 'link_create',
                              scopeType: 'plan',
                              scopeId: basePlan.id,
                              details: { id, fromId: a, toId: b, kind: 'arrow' }
                            });
                            setSelectedLinkId(id);
                            push(t({ it: 'Collegamento creato', en: 'Link created' }), 'success');
                            setContextMenu(null);
                          }}
                          className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                          title={t({
                            it: 'Crea un collegamento lineare tra i 2 oggetti selezionati (se non esiste già).',
                            en: 'Creates a straight link between the 2 selected objects (if it does not already exist).'
                          })}
                        >
                          <Link2 size={14} className="text-slate-500" /> {t({ it: 'Collega oggetti', en: 'Link objects' })}
                        </button>
                      ) : null
                    ) : null}

                    {contextIsMulti ? (
                      <button
                        onClick={() => {
                          setBulkEditSelectionOpen(true);
                          setContextMenu(null);
                        }}
                        className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                        title={t({ it: 'Modifica rapida oggetti', en: 'Quick edit objects' })}
                      >
                        <Pencil size={14} /> {t({ it: 'Modifica rapida oggetti', en: 'Quick edit objects' })}
                      </button>
                    ) : null}
                    {contextIsMulti ? <div className="my-2 h-px bg-slate-100" /> : null}
                    <button
                      onClick={() => {
                        const ids =
                          selectedObjectIds.includes(contextMenu.id) && selectedObjectIds.length > 1
                            ? [...selectedObjectIds]
                            : [contextMenu.id];
                        setConfirmDelete(ids);
                      }}
                      className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-600 hover:bg-rose-50"
                      title={t({ it: 'Elimina', en: 'Delete' })}
                    >
                      <Trash size={14} /> {t({ it: 'Elimina', en: 'Delete' })}
                    </button>
                  </>
                )}
              </>
            ) : contextMenu.kind === 'room' ? (
	            <>
                <button
                  onClick={() => {
                    if (contextMenu.kind !== 'room') return;
                    setRoomMeasuresModal({ roomId: contextMenu.id });
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  title={t({ it: 'Misure stanza', en: 'Room measurements' })}
                >
                  <Ruler size={14} className="text-slate-500" /> {t({ it: 'Misure', en: 'Measurements' })}
                </button>
	              <button
	                onClick={() => {
	                  if (contextMenu.kind !== 'room') return;
	                  openEscapeRouteAt({ x: contextMenu.worldX, y: contextMenu.worldY }, 'room');
	                }}
	                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
		                title={t({ it: 'Calcola via di fuga verso uscita esterna antipanico', en: 'Compute escape route to nearest external panic exit' })}
	              >
	                <Footprints size={14} className="text-slate-500" /> {t({ it: 'Via di fuga', en: 'Escape route' })}
	              </button>
                {!isReadOnly
                  ? (() => {
                      const pairIds = Array.from(new Set((selectedRoomIds || []).map((id) => String(id)).filter(Boolean)));
                      const canCreate = pairIds.length === 2 && pairIds.includes(contextMenu.id);
                      if (!canCreate) return null;
                      const [roomAId, roomBId] = pairIds;
                      return (
                        <button
                          onClick={() => {
                            startRoomDoorDraft(roomAId, roomBId);
                            setContextMenu(null);
                          }}
                          className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                          title={t({
                            it: 'Crea porta di collegamento tra le due stanze selezionate',
                            en: 'Create connecting door between the two selected rooms'
                          })}
                        >
                          <DoorOpen size={14} className="text-slate-500" /> {t({ it: 'Crea porta di collegamento', en: 'Create connecting door' })}
                        </button>
                      );
                    })()
                  : null}
              {!isReadOnly &&
              !((renderPlan?.rooms || []).find((room) => room.id === contextMenu.id) as any)?.meetingRoom ? (
                <button
                  onClick={() => {
                    openEditRoom(contextMenu.id, { openDepartments: true });
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  title={t({ it: 'Gestione reparti', en: 'Department management' })}
                >
                  <Users size={14} /> {t({ it: 'Gestione reparti', en: 'Department management' })}
                </button>
              ) : null}
              <button
                onClick={() => {
                  const room = (renderPlan?.rooms || []).find((r) => r.id === contextMenu.id) as any;
                  if (room?.meetingRoom) {
                    openRoomMeetingsTimeline(contextMenu.id);
                  } else {
                    openMeetingManager({ roomId: contextMenu.id, floorPlanId: planId, siteId: site?.id, clientId: client?.id });
                  }
                  setContextMenu(null);
                }}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={t({ it: 'Pianifica meeting room', en: 'Schedule meeting room' })}
              >
                <CalendarClock size={14} /> {t({ it: 'Pianifica meeting', en: 'Schedule meeting' })}
              </button>
              {(() => {
                const room = (renderPlan?.rooms || []).find((r) => r.id === contextMenu.id) as any;
                if (!room?.meetingRoom || !room?.meetingKioskEnabled) return null;
                return (
                  <button
                    onClick={() => {
                      setRoomKioskInfoModal({
                        roomId: String(room.id),
                        roomName: String(room.name || t({ it: 'Meeting room', en: 'Meeting room' })),
                        clientName: String(client?.shortName || client?.name || '-'),
                        siteName: String(site?.name || '-'),
                        planName: String(plan?.name || '-')
                      });
                      setContextMenu(null);
                    }}
                    className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                    title={t({ it: 'Informazioni kiosk (link e QR code)', en: 'Kiosk info (link and QR code)' })}
                  >
                    <QrCode size={14} /> {t({ it: 'Kiosk Info', en: 'Kiosk Info' })}
                  </button>
                );
              })()}
              <button
                onClick={() => {
                  if (!client?.id || contextMenu.kind !== 'room') return;
                  setRoomLayoutExportModal({
                    clientId: client.id,
                    sourcePlanId: planId,
                    sourceRoomId: contextMenu.id,
                    sortKey: 'site',
                    sortDir: 'asc',
                    selectedKeys: []
                  });
                  setContextMenu(null);
                }}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={t({ it: 'Copia colore/scala/opacità su altre stanze del cliente', en: 'Copy color/scale/opacity to other client rooms' })}
              >
                <Copy size={14} /> {t({ it: 'Esporta Layout', en: 'Export Layout' })}
              </button>
              {!isReadOnly ? (
		                <button
	                  onClick={() => {
	                    openEditRoom(contextMenu.id);
	                    setContextMenu(null);
	                  }}
	                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
	                  title={t({ it: 'Modifica stanza', en: 'Edit room' })}
	                >
                  <Pencil size={14} /> {t({ it: 'Modifica stanza', en: 'Edit room' })}
                </button>
              ) : null}
              {!isReadOnly ? (
	                <button
	                  onClick={() => {
	                    setConfirmDeleteRoomId(contextMenu.id);
	                    setContextMenu(null);
	                  }}
	                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-600 hover:bg-rose-50"
	                  title={t({ it: 'Elimina stanza', en: 'Delete room' })}
	                >
                  <Trash size={14} /> {t({ it: 'Elimina stanza', en: 'Delete room' })}
                </button>
              ) : null}
            </>
	            ) : contextMenu.kind === 'corridor' ? (
	            <>
              <button
                onClick={() => {
                  if (contextMenu.kind !== 'corridor') return;
                  openEscapeRouteAt({ x: contextMenu.worldX, y: contextMenu.worldY }, 'corridor');
                }}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
	                title={t({ it: 'Calcola via di fuga verso uscita esterna antipanico', en: 'Compute escape route to nearest external panic exit' })}
              >
                <Footprints size={14} className="text-slate-500" /> {t({ it: 'Via di fuga', en: 'Escape route' })}
              </button>
	              {!isReadOnly ? (
	                <button
                  onClick={() => {
                    if (contextMenu.kind !== 'corridor') return;
                    openCorridorConnectionModalAt(contextMenu.id, { x: contextMenu.worldX, y: contextMenu.worldY });
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  title={t({ it: 'Collegamento tra piani', en: 'Floor connection' })}
                >
                  <Link2 size={14} className="text-slate-500" /> {t({ it: 'Collegamento tra piani', en: 'Floor connection' })}
                </button>
              ) : null}
            </>
            ) : contextMenu.kind === 'corridor_door' ? (
            <>
              {!isReadOnly ? (
                <button
                  onClick={() => {
                    if (!plan || contextMenu.kind !== 'corridor_door') return;
                    const current = ((plan.corridors || []) as Corridor[]).filter(Boolean);
                    const next = current.map((corridor) => {
                      if (corridor.id !== contextMenu.corridorId) return corridor;
                      return {
                        ...corridor,
                        doors: (corridor.doors || []).filter((door) => door.id !== contextMenu.doorId)
                      };
                    });
                    markTouched();
                    updateFloorPlan(plan.id, { corridors: next } as any);
                    setSelectedCorridorDoor(null);
                    push(t({ it: 'Porta eliminata', en: 'Door deleted' }), 'info');
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  title={t({ it: 'Elimina', en: 'Delete' })}
                >
                  <Trash size={14} className="text-rose-600" /> {t({ it: 'Elimina', en: 'Delete' })}
                </button>
              ) : null}
              {!isReadOnly ? (
                <button
                  onClick={() => {
                    if (contextMenu.kind !== 'corridor_door') return;
                    openCorridorDoorModal(contextMenu.corridorId, contextMenu.doorId);
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  title={t({ it: 'Modifica', en: 'Edit' })}
                >
                  <Pencil size={14} /> {t({ it: 'Modifica', en: 'Edit' })}
                </button>
              ) : null}
              {!isReadOnly ? (
                <button
                  onClick={() => {
                    if (contextMenu.kind !== 'corridor_door') return;
                    openCorridorDoorLinkModal(contextMenu.corridorId, contextMenu.doorId);
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  title={t({ it: 'Collega stanza', en: 'Link room' })}
                >
                  <Home size={14} /> {t({ it: 'Collega stanza', en: 'Link room' })}
                </button>
              ) : null}
              {!isReadOnly ? (
                (() => {
                  const corridor = corridorById.get(contextMenu.corridorId);
                  const door = (corridor?.doors || []).find((d) => d.id === contextMenu.doorId);
                  const mode = door?.mode || 'static';
                  const url = String((door as any)?.automationUrl || '').trim();
                  const canOpen = mode === 'automated' && /^https?:\/\//i.test(url);
                  if (!canOpen) return null;
                  return (
                    <button
                      onClick={() => {
                        // Trigger automated door endpoint in background, without opening a new tab/window.
                        try {
                          const requestUrl = `${url}${url.includes('?') ? '&' : '?'}_plixmap_open_ts=${Date.now()}`;
                          fetch(requestUrl, {
                            method: 'GET',
                            mode: 'no-cors',
                            cache: 'no-store',
                            keepalive: true
                          }).catch(() => {
                            // ignore network/CORS errors by design
                          });
                        } catch {
                          // ignore sync errors by design
                        }
                        push(t({ it: 'Comando apertura porta avviato.', en: 'Door opening command started.' }), 'success');
                        setContextMenu(null);
                      }}
                      className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                      title={t({ it: 'Apri', en: 'Open' })}
                    >
                      <Link2 size={14} className="text-slate-500" /> {t({ it: 'Apri', en: 'Open' })}
                    </button>
                  );
                })()
              ) : null}
            </>
            ) : contextMenu.kind === 'room_door' ? (
            <>
              {!isReadOnly ? (
                <button
                  onClick={() => {
                    if (!plan || contextMenu.kind !== 'room_door') return;
                    const current = Array.isArray((plan as any).roomDoors) ? ((plan as any).roomDoors as any[]) : [];
                    const next = current.filter((door) => String((door as any)?.id || '') !== contextMenu.doorId);
                    markTouched();
                    updateFloorPlan(plan.id, { roomDoors: next as any } as any);
                    setSelectedRoomDoorId(null);
                    push(t({ it: 'Porta eliminata', en: 'Door deleted' }), 'info');
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  title={t({ it: 'Elimina', en: 'Delete' })}
                >
                  <Trash size={14} className="text-rose-600" /> {t({ it: 'Elimina', en: 'Delete' })}
                </button>
              ) : null}
              {!isReadOnly ? (
                <button
                  onClick={() => {
                    if (contextMenu.kind !== 'room_door') return;
                    openRoomDoorModal(contextMenu.doorId);
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  title={t({ it: 'Modifica', en: 'Edit' })}
                >
                  <Pencil size={14} /> {t({ it: 'Modifica', en: 'Edit' })}
                </button>
              ) : null}
              {!isReadOnly ? (
                (() => {
                  const door = roomDoors.find((entry) => entry.id === contextMenu.doorId);
                  const mode = door?.mode || 'static';
                  const url = String((door as any)?.automationUrl || '').trim();
                  const canOpen = mode === 'automated' && /^https?:\/\//i.test(url);
                  if (!canOpen) return null;
                  return (
                    <button
                      onClick={() => {
                        try {
                          const requestUrl = `${url}${url.includes('?') ? '&' : '?'}_plixmap_open_ts=${Date.now()}`;
                          fetch(requestUrl, {
                            method: 'GET',
                            mode: 'no-cors',
                            cache: 'no-store',
                            keepalive: true
                          }).catch(() => {});
                        } catch {
                          // ignore sync errors
                        }
                        push(t({ it: 'Comando apertura porta avviato.', en: 'Door opening command started.' }), 'success');
                        setContextMenu(null);
                      }}
                      className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                      title={t({ it: 'Apri', en: 'Open' })}
                    >
                      <Link2 size={14} className="text-slate-500" /> {t({ it: 'Apri', en: 'Open' })}
                    </button>
                  );
                })()
              ) : null}
            </>
            ) : contextMenu.kind === 'corridor_connection' ? (
            <>
              {!isReadOnly ? (
                <button
                  onClick={() => {
                    if (contextMenu.kind !== 'corridor_connection') return;
                    openEditCorridorConnectionModal(contextMenu.corridorId, contextMenu.connectionId, {
                      x: contextMenu.worldX,
                      y: contextMenu.worldY
                    });
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  title={t({ it: 'Modifica punto di collegamento', en: 'Edit connection point' })}
                >
                  <Pencil size={14} /> {t({ it: 'Modifica punto di collegamento', en: 'Edit connection point' })}
                </button>
              ) : null}
              {!isReadOnly ? (
                <button
                  onClick={() => {
                    if (!plan || contextMenu.kind !== 'corridor_connection') return;
                    const current = ((plan.corridors || []) as Corridor[]).filter(Boolean);
                    const next = current.map((corridor) => {
                      if (corridor.id !== contextMenu.corridorId) return corridor;
                      return {
                        ...corridor,
                        connections: (corridor.connections || []).filter((cp) => cp.id !== contextMenu.connectionId)
                      };
                    });
                    markTouched();
                    updateFloorPlan(plan.id, { corridors: next } as any);
                    push(t({ it: 'Punto di collegamento eliminato', en: 'Connection point deleted' }), 'info');
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-600 hover:bg-rose-50"
                  title={t({ it: 'Elimina punto di collegamento', en: 'Delete connection point' })}
                >
                  <Trash size={14} /> {t({ it: 'Elimina punto di collegamento', en: 'Delete connection point' })}
                </button>
              ) : null}
            </>
            ) : contextMenu.kind === 'safety_card' ? (
            <>
              <button
                onClick={() => {
                  toggleSecurityCardVisibility();
                  setContextMenu(null);
                }}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={t({
                  it: securityLayerVisible ? 'Nascondi scheda sicurezza' : 'Mostra scheda sicurezza',
                  en: securityLayerVisible ? 'Hide safety card' : 'Show safety card'
                })}
              >
                {securityLayerVisible ? <EyeOff size={14} className="text-slate-500" /> : <Eye size={14} className="text-slate-500" />}
                {t({
                  it: securityLayerVisible ? 'Nascondi' : 'Mostra',
                  en: securityLayerVisible ? 'Hide' : 'Show'
                })}
              </button>
              <button
                onClick={() => {
                  setEmergencyContactsOpen(true);
                  setContextMenu(null);
                }}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={t({ it: 'Apri rubrica emergenze', en: 'Open emergency directory' })}
              >
                <PhoneCall size={14} className="text-slate-500" /> {t({ it: 'Rubrica emergenze', en: 'Emergency directory' })}
              </button>
            </>
            ) : contextMenu.kind === 'scale' ? (
            <>
              <button
                onClick={() => {
                  openScaleEdit();
                  setContextMenu(null);
                }}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={t({ it: 'Ricalibra scala', en: 'Recalibrate scale' })}
              >
                <Ruler size={14} className="text-slate-500" /> {t({ it: 'Ricalibra scala', en: 'Recalibrate scale' })}
              </button>
              <button
                onClick={() => {
                  requestClearScale();
                  setContextMenu(null);
                }}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-700 hover:bg-rose-50"
                title={t({ it: 'Elimina scala', en: 'Delete scale' })}
              >
                <Trash size={14} className="text-rose-600" /> {t({ it: 'Elimina scala', en: 'Delete scale' })}
              </button>
            </>
	          ) : (
	            <>
              <button
                onClick={() => {
                  if (contextMenu.kind !== 'map') return;
                  openEscapeRouteAt({ x: contextMenu.worldX, y: contextMenu.worldY }, 'map');
                }}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
	                title={t({ it: 'Calcola via di fuga verso uscita esterna antipanico', en: 'Compute escape route to nearest external panic exit' })}
              >
                <Footprints size={14} className="text-slate-500" /> {t({ it: 'Via di fuga', en: 'Escape route' })}
              </button>
	              {planPhotoIds.length ? (
	                <button
                  onClick={() => {
                    openPhotoViewer({ id: planPhotoIds[0], selectionIds: planPhotoIds });
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  title={t({ it: 'Vedi galleria foto', en: 'View photo gallery' })}
                >
                  <ImageIcon size={14} className="text-slate-500" /> {t({ it: 'Vedi galleria foto', en: 'View photo gallery' })}
                </button>
              ) : null}
              <button
                onClick={() => toggleMapSubmenu('view')}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={t({ it: 'Visualizza', en: 'View' })}
              >
                <BookmarkPlus size={14} className="text-slate-500" /> {t({ it: 'Vista', en: 'View' })}
                <ChevronRight size={14} className="ml-auto text-slate-400" />
              </button>
              <button
                onClick={() => toggleMapSubmenu('measure')}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={t({ it: 'Misure', en: 'Measurements' })}
              >
                <Ruler size={14} className="text-slate-500" /> {t({ it: 'Misure', en: 'Measurements' })}
                <ChevronRight size={14} className="ml-auto text-slate-400" />
              </button>
              <button
                onClick={() => toggleMapSubmenu('create')}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={t({ it: 'Aggiungi', en: 'Add' })}
              >
                <Plus size={14} className="text-slate-500" /> {t({ it: 'Aggiungi', en: 'Add' })}
                <ChevronRight size={14} className="ml-auto text-slate-400" />
              </button>
              <button
                onClick={() => toggleMapSubmenu('print')}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={t({ it: 'Stampa', en: 'Print & export' })}
              >
                <Crop size={14} className="text-slate-500" /> {t({ it: 'Stampa', en: 'Print' })}
                <ChevronRight size={14} className="ml-auto text-slate-400" />
              </button>
              <button
                onClick={() => toggleMapSubmenu('manage')}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={t({ it: 'Gestione', en: 'Manage' })}
              >
                <Trash size={14} className="text-slate-500" /> {t({ it: 'Gestione', en: 'Manage' })}
                <ChevronRight size={14} className="ml-auto text-slate-400" />
              </button>
            </>
          )}
        </div>

        {layersContextMenu ? (
          <div
            ref={layersContextMenuRef}
            className="context-menu-panel fixed z-50 w-60 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
            style={getSubmenuStyle(240)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-semibold text-ink">{t({ it: 'Livelli', en: 'Layers' })}</span>
              <button
                onClick={() => setLayersContextMenu(null)}
                className="text-slate-400 hover:text-ink"
                title={t({ it: 'Chiudi', en: 'Close' })}
              >
                <X size={14} />
              </button>
            </div>
            <div className="mt-2 space-y-1">
              <button
                onClick={() => {
                  setHideAllLayers(planId, false);
                  setVisibleLayerIds(planId, layerIds);
                  setLayersContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
                title={t({ it: 'Mostra tutti i livelli', en: 'Show all layers' })}
              >
                <Eye size={14} className="text-slate-500" /> {t({ it: 'Mostra tutti', en: 'Show all' })}
              </button>
	              <button
	                onClick={() => {
	                  setHideAllLayers(planId, true);
	                  setVisibleLayerIds(planId, []);
	                  setLayersContextMenu(null);
	                }}
	                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
	                title={t({ it: 'Nascondi tutti i livelli', en: 'Hide all layers' })}
              >
                <EyeOff size={14} className="text-slate-500" /> {t({ it: 'Nascondi tutti', en: 'Hide all' })}
              </button>
              <div className="my-2 h-px bg-slate-100" />
              <div className="max-h-64 overflow-y-auto">
                {orderedPlanLayers
                  .filter((l: any) => String(l.id) !== ALL_ITEMS_LAYER_ID)
                  .map((l: any) => {
                    const layerId = String(l.id);
                    const isOn = !hideAllLayers && (allItemsSelected ? true : effectiveVisibleLayerIds.includes(layerId));
                    const label = getLayerLabel(layerId);
                    return (
	                      <button
	                        key={layerId}
	                        onClick={() => {
	                          const base = hideAllLayers ? [] : effectiveVisibleLayerIds;
	                          if (hideAllLayers) setHideAllLayers(planId, false);
	                          const nextRaw = base.includes(layerId) ? base.filter((x) => x !== layerId) : [...base, layerId];
	                          const next = normalizeLayerSelection(nextRaw);
	                          setVisibleLayerIds(planId, next);
	                        }}
	                        className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
	                        title={label}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="inline-flex h-3 w-3 shrink-0 rounded-full border border-slate-200"
                            style={{ background: String((l as any).color || '#94a3b8') }}
                          />
                          <span className="min-w-0 truncate text-sm text-slate-700">{label}</span>
                        </span>
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-md border ${
                            isOn ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-400'
                          }`}
                          title={isOn ? t({ it: 'Visibile', en: 'Visible' }) : t({ it: 'Nascosto', en: 'Hidden' })}
                        >
                          {isOn ? <Eye size={12} /> : <EyeOff size={12} />}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        ) : null}

        {contextMenu.kind === 'map' && mapSubmenu === 'view' ? (
          <div
            className="fixed z-50 w-60 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
            style={getSubmenuStyle(240)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">{t({ it: 'Vista', en: 'View' })}</div>
            {!isReadOnly ? (
              <button
                onClick={() => {
                  setViewModalOpen(true);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={t({ it: 'Salva vista', en: 'Save view' })}
              >
                <BookmarkPlus size={14} className="text-slate-500" /> {t({ it: 'Salva vista', en: 'Save view' })}
              </button>
            ) : null}
            <button
              onClick={() => {
                if (!hasDefaultView) return;
                goToDefaultView();
                setContextMenu(null);
              }}
              disabled={!hasDefaultView}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              title={
                hasDefaultView
                  ? t({ it: 'Vai a default', en: 'Go to default' })
                  : t({ it: 'Imposta prima una vista di default', en: 'Set a default view first' })
              }
            >
              <Home size={14} className="text-slate-500" /> {t({ it: 'Vai a default', en: 'Go to default' })}
            </button>
          </div>
        ) : null}

        {contextMenu.kind === 'map' && mapSubmenu === 'measure' ? (
          <div
            className="fixed z-50 w-60 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
            style={getSubmenuStyle(240)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">
              {t({ it: 'Misure', en: 'Measurements' })}
            </div>
            {!metersPerPixel && !isReadOnly ? (
              <button
                onClick={() => {
                  if ((contextMenu as any).kind !== 'map') return;
                  startScaleMode();
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-700 hover:bg-rose-50"
                title={t({ it: 'Imposta la scala della planimetria', en: 'Set the floor plan scale' })}
              >
                <Ruler size={14} className="text-rose-600" /> {t({ it: 'Imposta scala', en: 'Set scale' })}
              </button>
            ) : null}
            {metersPerPixel && !isReadOnly ? (
              <button
                onClick={() => {
                  if ((contextMenu as any).kind !== 'map') return;
                  requestClearScale();
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-700 hover:bg-rose-50"
                title={t({ it: 'Cancella la scala della planimetria', en: 'Clear the floor plan scale' })}
              >
                <Ruler size={14} className="text-rose-600" /> {t({ it: 'Cancella scala', en: 'Clear scale' })}
              </button>
            ) : null}
            <button
              onClick={() => {
                if ((contextMenu as any).kind !== 'map') return;
                startMeasure({ x: (contextMenu as any).worldX, y: (contextMenu as any).worldY });
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
              title={t({ it: 'Misura distanza (m)', en: 'Measure distance (m)' })}
            >
              <Ruler size={14} className="text-slate-500" /> {t({ it: 'Misura distanza (m)', en: 'Measure distance (m)' })}
            </button>
            <button
              onClick={() => {
                if ((contextMenu as any).kind !== 'map') return;
                startQuote({ x: (contextMenu as any).worldX, y: (contextMenu as any).worldY });
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
              title={t({ it: 'Quota (Q)', en: 'Quote (Q)' })}
            >
              <MoveDiagonal size={14} className="text-slate-500" /> {t({ it: 'Quota (Q)', en: 'Quote (Q)' })}
            </button>
          </div>
        ) : null}

        {contextMenu.kind === 'map' && mapSubmenu === 'create' ? (
          <div
            className="fixed z-50 w-80 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
            style={getSubmenuStyle(320)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">{t({ it: 'Aggiungi', en: 'Add' })}</div>
            {!isReadOnly ? (
              <>
                <div className="px-2 pt-1 text-[11px] font-semibold text-slate-500">{t({ it: 'Stanze', en: 'Rooms' })}</div>
                <button
                  onClick={() => {
                    setRoomCatalogOpen(true);
                    setContextMenu(null);
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  title={t({ it: 'Apri catalogo stanze', en: 'Open room catalog' })}
                >
                  <Square size={14} className="text-slate-500" /> {t({ it: 'Catalogo stanze', en: 'Room catalog' })}
                </button>
                <button
                  onClick={() => {
                    beginCorridorPolyDraw();
                    setContextMenu(null);
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  title={t({ it: 'Crea corridoio', en: 'Create corridor' })}
                >
                  <Square size={14} className="text-slate-500" /> {t({ it: 'Crea corridoio', en: 'Create corridor' })}
                </button>
                <div className="my-2 h-px bg-slate-100" />
                <div className="px-2 text-[11px] font-semibold text-slate-500">{t({ it: 'Oggetti', en: 'Objects' })}</div>
                <button
                  onClick={() => {
                    setAllTypesDefaultTab('objects');
                    setAllTypesOpen(true);
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  title={t({ it: 'Apri catalogo oggetti', en: 'Open object catalog' })}
                >
                  <LayoutGrid size={14} className="text-slate-500" /> {t({ it: 'Catalogo oggetti', en: 'Object catalog' })}
                </button>
                <button
                  onClick={() => {
                    setWallDrawMode(false);
                    setMeasureMode(false);
                    setScaleMode(false);
                    setRoomDrawMode(null);
                    setPanToolActive(false);
                    setPendingType('text');
                    setPaletteSection('objects');
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  title={t({ it: 'Aggiungi testo', en: 'Add text' })}
                >
                  <TypeIcon size={14} className="text-slate-500" /> {t({ it: 'Aggiungi testo', en: 'Add text' })}
                </button>
                <button
                  onClick={() => {
                    setWallDrawMode(false);
                    setMeasureMode(false);
                    setScaleMode(false);
                    setRoomDrawMode(null);
                    setPanToolActive(false);
                    setPendingType('image');
                    setPaletteSection('objects');
                    setContextMenu(null);
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  title={t({ it: 'Aggiungi immagine', en: 'Add image' })}
                >
                  <ImageIcon size={14} className="text-slate-500" /> {t({ it: 'Aggiungi immagine', en: 'Add image' })}
                </button>
                <button
                  onClick={() => {
                    setWallDrawMode(false);
                    setMeasureMode(false);
                    setScaleMode(false);
                    setRoomDrawMode(null);
                    setPanToolActive(false);
                    setPendingType('photo');
                    setPaletteSection('objects');
                    setContextMenu(null);
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  title={t({ it: 'Aggiungi foto', en: 'Add photo' })}
                >
                  <Camera size={14} className="text-slate-500" /> {t({ it: 'Aggiungi foto', en: 'Add photo' })}
                </button>
                <button
                  onClick={() => {
                    setWallDrawMode(false);
                    setMeasureMode(false);
                    setScaleMode(false);
                    setRoomDrawMode(null);
                    setPanToolActive(false);
                    setPendingType('postit');
                    setPaletteSection('objects');
                    setContextMenu(null);
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  title={t({ it: 'Aggiungi post-it', en: 'Add post-it' })}
                >
                  <StickyNote size={14} className="text-slate-500" /> {t({ it: 'Aggiungi post-it', en: 'Add post-it' })}
                </button>
                <div className="my-2 h-px bg-slate-100" />
                <div className="px-2 text-[11px] font-semibold text-slate-500">{t({ it: 'Scrivanie', en: 'Desks' })}</div>
                <button
                  onClick={() => {
                    if (!deskCatalogDefs.length) return;
                    setDeskCatalogOpen(true);
                    setContextMenu(null);
                  }}
                  disabled={!deskCatalogDefs.length}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  title={t({ it: 'Apri catalogo scrivanie', en: 'Open desk catalog' })}
                >
                  <LayoutGrid size={14} className="text-slate-500" /> {t({ it: 'Catalogo scrivanie', en: 'Desk catalog' })}
                </button>
                {!deskCatalogDefs.length ? (
                  <div className="mt-2 px-2 text-xs text-slate-500">
                    {t({ it: 'Nessuna scrivania disponibile.', en: 'No desks available.' })}
                  </div>
                ) : null}
                <div className="my-2 h-px bg-slate-100" />
                <div className="px-2 text-[11px] font-semibold text-slate-500">{t({ it: 'Mura', en: 'Walls' })}</div>
                <button
                  onClick={() => {
                    if (!wallTypeDefs.length) return;
                    setWallCatalogOpen(true);
                    setContextMenu(null);
                  }}
                  disabled={!wallTypeDefs.length}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  title={t({ it: 'Apri catalogo mura', en: 'Open wall catalog' })}
                >
                  <Square size={14} className="text-slate-500" /> {t({ it: 'Catalogo mura', en: 'Wall catalog' })}
                </button>
                {!wallTypeDefs.length ? (
                  <div className="mt-2 px-2 text-xs text-slate-500">
                    {t({ it: 'Nessun muro disponibile.', en: 'No walls available.' })}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="px-2 py-2 text-xs text-slate-500">{t({ it: 'Sola lettura', en: 'Read-only' })}</div>
            )}
          </div>
        ) : null}

        {contextMenu.kind === 'map' && mapSubmenu === 'print' ? (
          <div
            className="fixed z-50 w-60 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
            style={getSubmenuStyle(240)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">{t({ it: 'Stampa', en: 'Print' })}</div>
            {!isReadOnly ? (
              <button
                onClick={() => {
                  if ((basePlan as any)?.printArea) {
                    updateFloorPlan(basePlan.id, { printArea: undefined });
                    setContextMenu(null);
                    push(t({ it: 'Area di stampa rimossa correttamente', en: 'Print area removed successfully' }), 'info');
                    return;
                  }
                  setPrintAreaMode(true);
                  setContextMenu(null);
                  push(
                    t({
                      it: 'Disegna un rettangolo sulla mappa per impostare l’area di stampa.',
                      en: 'Draw a rectangle on the map to set the print area.'
                    }),
                    'info'
                  );
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={(basePlan as any)?.printArea ? t({ it: 'Rimuovi area di stampa', en: 'Clear print area' }) : t({ it: 'Imposta area di stampa', en: 'Set print area' })}
              >
                <Crop size={14} className="text-slate-500" />{' '}
                {(basePlan as any)?.printArea
                  ? t({ it: 'Rimuovi area di stampa', en: 'Clear print area' })
                  : t({ it: 'Imposta area di stampa', en: 'Set print area' })}
              </button>
            ) : null}
            {(basePlan as any)?.printArea ? (
              <button
                onClick={() => {
                  toggleShowPrintArea(basePlan.id);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={t({ it: 'Mostra/nascondi area di stampa come overlay', en: 'Show/hide the print area overlay' })}
              >
                {showPrintArea ? <EyeOff size={14} className="text-slate-500" /> : <Eye size={14} className="text-slate-500" />}{' '}
                {showPrintArea
                  ? t({ it: 'Nascondi area di stampa', en: 'Hide print area' })
                  : t({ it: 'Mostra area di stampa', en: 'Show print area' })}
              </button>
            ) : null}
            <button
              onClick={() => {
                setExportModalOpen(true);
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
              title={t({ it: 'Esporta PDF', en: 'Export PDF' })}
            >
              <FileDown size={14} className="text-slate-500" /> {t({ it: 'Esporta PDF', en: 'Export PDF' })}
            </button>
          </div>
        ) : null}

        {contextMenu.kind === 'map' && mapSubmenu === 'manage' ? (
          <div
            className="fixed z-50 w-60 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
            style={getSubmenuStyle(240)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">{t({ it: 'Gestione', en: 'Manage' })}</div>
            {!isReadOnly ? (
              <button
                onClick={() => {
                  setConfirmClearObjects(true);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-600 hover:bg-rose-50"
                title={t({ it: 'Elimina tutti gli oggetti', en: 'Delete all objects' })}
              >
                <Trash size={14} /> {t({ it: 'Elimina tutti gli oggetti', en: 'Delete all objects' })}
              </button>
            ) : (
              <div className="px-2 py-2 text-xs text-slate-500">{t({ it: 'Sola lettura', en: 'Read-only' })}</div>
            )}
          </div>
        ) : null}
        </>
  );
};

export default ContextMenuPanel;
