import { lazy, Suspense } from 'react';

import { LayoutGrid, Trash, X, Pencil, History, Save, CalendarClock, Footprints, Ruler, Hourglass, Unlock, Undo2, Redo2 } from 'lucide-react';

import SearchBar from './SearchBar';

import PrinterMenuButton from './PrinterMenuButton';
import UserAvatar from '../ui/UserAvatar';

import SearchResultsPopover from './SearchResultsPopover';

import { isRackLinkId } from './planViewUtils';

import { usePlanView, UNLOCK_REQUEST_EVENT, FORCE_UNLOCK_EVENT } from './usePlanView';
const UserMenu = lazy(() => import('../layout/UserMenu'));

import RoomsMenuPanel from './RoomsMenuPanel';

import ViewsMenuPanel from './ViewsMenuPanel';
import CountsMenuPanel from './CountsMenuPanel';
import LayersPopoverPanel from './LayersPopoverPanel';


type PlanHeaderBarProps = Pick<ReturnType<typeof usePlanView>, 'activeRevision' | 'allItemsLabel' | 'allItemsSelected' | 'applyView' | 'basePlan' | 'beginRoomDraw' | 'beginRoomPolyDraw' | 'canRedo' | 'canUndo' | 'cancelScaleMode' | 'clearSelection' | 'client' | 'counts' | 'countsOpen' | 'dismissSelectionHintToasts' | 'effectiveVisibleLayerIds' | 'expandedRoomId' | 'expandedType' | 'formatMinutes' | 'formatPresenceDate' | 'formatPresenceLock' | 'getLayerNote' | 'getObjectNameById' | 'getTypeIcon' | 'getTypeLabel' | 'grantRemainingMinutes' | 'gridMenuOpen' | 'gridMenuRef' | 'gridSize' | 'gridSnapEnabled' | 'handleEdit' | 'handleOverwriteView' | 'handleSearch' | 'handleSearchEnter' | 'hasUnsavedUi' | 'hideAllLayers' | 'isReadOnly' | 'isSuperAdmin' | 'lang' | 'layerIds' | 'layersPopoverOpen' | 'layersPopoverRef' | 'linksInSelection' | 'lockActiveTitle' | 'lockAvailable' | 'lockInfoOpen' | 'lockInfoRef' | 'lockRequired' | 'lockState' | 'lockedByOther' | 'lockedByTitle' | 'newRoomMenuOpen' | 'normalizeLayerSelection' | 'objectListMatches' | 'objectListQuery' | 'objectsByType' | 'openEditRoom' | 'openUnlockCompose' | 'orderedPlanLayers' | 'orderedViews' | 'performRedo' | 'performUndo' | 'plan' | 'planAccess' | 'planId' | 'planScale' | 'presenceCount' | 'presenceEntries' | 'presenceOpen' | 'presenceRef' | 'presentationMode' | 'promptRevealForObject' | 'push' | 'rackOverlayById' | 'renderPlan' | 'renderPlanObjectById' | 'requestPlanLock' | 'roomDrawMode' | 'roomStatsById' | 'rooms' | 'roomsOpen' | 'scaleMode' | 'searchInputRef' | 'searchResultsObjects' | 'searchResultsOpen' | 'searchResultsRooms' | 'searchResultsTerm' | 'selectedLinkId' | 'selectedObjectId' | 'selectedObjectIds' | 'selectedRoomId' | 'selectedViewId' | 'setCapacityDashboardOpen' | 'setCapacityDashboardPreset' | 'setChooseDefaultModal' | 'setConfirmDelete' | 'setConfirmDeleteRoomId' | 'setConfirmDeleteViewId' | 'setConfirmSetDefaultViewId' | 'setCountsOpen' | 'setExpandedRoomId' | 'setExpandedType' | 'setExportModalOpen' | 'setGridMenuOpen' | 'setGridSize' | 'setGridSnapEnabled' | 'setHideAllLayers' | 'setHighlightRoom' | 'setInternalMapOpen' | 'setLayersPopoverOpen' | 'setLayersQuickMenu' | 'setLinkEditId' | 'setLockInfoOpen' | 'setMeetingHubModalOpen' | 'setNewRoomMenuOpen' | 'setObjectListQuery' | 'setPresenceOpen' | 'setPrintAreaMode' | 'setRevisionsOpen' | 'setRoomAllocationOpen' | 'setRoomAllocationPreset' | 'setRoomDrawMode' | 'setRoomsOpen' | 'setSaveRevisionModalPreset' | 'setSaveRevisionOpen' | 'setSearchResultsObjects' | 'setSearchResultsOpen' | 'setSearchResultsRooms' | 'setSelectedObject' | 'setSelectedObjectsModalOpen' | 'setSelectedRoomId' | 'setSelectedRoomIds' | 'setSelectedViewId' | 'setShowGrid' | 'setShowScaleLine' | 'setTypeMenu' | 'setViewModalOpen' | 'setViewsMenuOpen' | 'setVisibleLayerIds' | 'showGrid' | 'site' | 'startScaleMode' | 't' | 'totalLayerCount' | 'triggerHighlight' | 'updateFloorPlan' | 'user' | 'viewsMenuOpen' | 'visibleLayerCount'>;

const PlanHeaderBar = (props: PlanHeaderBarProps) => {
  const {
    activeRevision,
    allItemsLabel,
    allItemsSelected,
    applyView,
    basePlan,
    beginRoomDraw,
    beginRoomPolyDraw,
    canRedo,
    canUndo,
    cancelScaleMode,
    clearSelection,
    client,
    counts,
    countsOpen,
    dismissSelectionHintToasts,
    effectiveVisibleLayerIds,
    expandedRoomId,
    expandedType,
    formatMinutes,
    formatPresenceDate,
    formatPresenceLock,
    getLayerNote,
    getObjectNameById,
    getTypeIcon,
    getTypeLabel,
    grantRemainingMinutes,
    gridMenuOpen,
    gridMenuRef,
    gridSize,
    gridSnapEnabled,
    handleEdit,
    handleOverwriteView,
    handleSearch,
    handleSearchEnter,
    hasUnsavedUi,
    hideAllLayers,
    isReadOnly,
    isSuperAdmin,
    lang,
    layerIds,
    layersPopoverOpen,
    layersPopoverRef,
    linksInSelection,
    lockActiveTitle,
    lockAvailable,
    lockInfoOpen,
    lockInfoRef,
    lockRequired,
    lockState,
    lockedByOther,
    lockedByTitle,
    newRoomMenuOpen,
    normalizeLayerSelection,
    objectListMatches,
    objectListQuery,
    objectsByType,
    openEditRoom,
    openUnlockCompose,
    orderedPlanLayers,
    orderedViews,
    performRedo,
    performUndo,
    plan,
    planAccess,
    planId,
    planScale,
    presenceCount,
    presenceEntries,
    presenceOpen,
    presenceRef,
    presentationMode,
    promptRevealForObject,
    push,
    rackOverlayById,
    renderPlan,
    renderPlanObjectById,
    requestPlanLock,
    roomDrawMode,
    roomStatsById,
    rooms,
    roomsOpen,
    scaleMode,
    searchInputRef,
    searchResultsObjects,
    searchResultsOpen,
    searchResultsRooms,
    searchResultsTerm,
    selectedLinkId,
    selectedObjectId,
    selectedObjectIds,
    selectedRoomId,
    selectedViewId,
    setCapacityDashboardOpen,
    setCapacityDashboardPreset,
    setChooseDefaultModal,
    setConfirmDelete,
    setConfirmDeleteRoomId,
    setConfirmDeleteViewId,
    setConfirmSetDefaultViewId,
    setCountsOpen,
    setExpandedRoomId,
    setExpandedType,
    setExportModalOpen,
    setGridMenuOpen,
    setGridSize,
    setGridSnapEnabled,
    setHideAllLayers,
    setHighlightRoom,
    setInternalMapOpen,
    setLayersPopoverOpen,
    setLayersQuickMenu,
    setLinkEditId,
    setLockInfoOpen,
    setMeetingHubModalOpen,
    setNewRoomMenuOpen,
    setObjectListQuery,
    setPresenceOpen,
    setPrintAreaMode,
    setRevisionsOpen,
    setRoomAllocationOpen,
    setRoomAllocationPreset,
    setRoomDrawMode,
    setRoomsOpen,
    setSaveRevisionModalPreset,
    setSaveRevisionOpen,
    setSearchResultsObjects,
    setSearchResultsOpen,
    setSearchResultsRooms,
    setSelectedObject,
    setSelectedObjectsModalOpen,
    setSelectedRoomId,
    setSelectedRoomIds,
    setSelectedViewId,
    setShowGrid,
    setShowScaleLine,
    setTypeMenu,
    setViewModalOpen,
    setViewsMenuOpen,
    setVisibleLayerIds,
    showGrid,
    site,
    startScaleMode,
    t,
    totalLayerCount,
    triggerHighlight,
    updateFloorPlan,
    user,
    viewsMenuOpen,
    visibleLayerCount
  } = props;
  if (!renderPlan) return null;
  return (
          <div className={`flex flex-nowrap items-center justify-between gap-2 ${presentationMode ? 'hidden' : ''}`}>
	        <div className="min-w-0">
	          <div className="text-[11px] font-semibold uppercase text-slate-500">
	            {client?.shortName || client?.name} → {site?.name}
	          </div>
			          {/* Avoid overflow clipping: dropdowns (presence/layers/etc) are positioned absolutely. */}
			          <div className="mt-1 flex min-w-0 flex-nowrap items-center gap-2 overflow-visible whitespace-nowrap">
		            <h1 className="truncate text-xl font-semibold text-ink">{renderPlan.name}</h1>
		            {lockRequired && (lockState.mine || lockedByOther) ? (
		              <div ref={lockInfoRef} className="relative">
		                <button
		                  type="button"
		                  onClick={() => setLockInfoOpen((v) => !v)}
		                  className={
		                    lockState.mine
		                      ? 'rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100'
		                      : 'rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100'
		                  }
		                  title={
		                    lockState.mine
		                      ? lockActiveTitle
		                      : lockState.lockedBy
		                        ? lockedByTitle
		                        : t({
		                            it: `Lock riservato a ${lockState.grant?.username || 'utente'}.`,
		                            en: `Lock reserved for ${lockState.grant?.username || 'user'}.`
		                          })
		                  }
		                >
		                  {lockState.mine ? (
		                    <span>{t({ it: 'Lock attivo', en: 'Lock active' })}</span>
		                  ) : lockState.lockedBy ? (
		                    <span className="inline-flex items-center gap-1.5">
		                      <UserAvatar src={(lockState as any)?.lockedBy?.avatarUrl} username={(lockState as any)?.lockedBy?.username} size={14} />
		                      <span>
		                        {t({
		                          it: `Bloccata da ${lockState.lockedBy?.username || 'utente'}`,
		                          en: `Locked by ${lockState.lockedBy?.username || 'user'}`
		                        })}
		                      </span>
		                    </span>
		                  ) : (
		                    <span className="inline-flex items-center gap-1.5">
		                      <Hourglass size={14} className="text-amber-700" />
		                      <span>
		                        {t({
		                          it: `Lock concesso a ${lockState.grant?.username || 'utente'}`,
		                          en: `Lock granted to ${lockState.grant?.username || 'user'}`
		                        })}
		                      </span>
		                    </span>
		                  )}
		                </button>
		                {lockInfoOpen ? (
		                  <div className="absolute left-0 z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-2 text-xs shadow-card">
		                    <div className="flex items-center justify-between border-b border-slate-100 px-2 pb-2">
		                      <div className="font-semibold text-ink">{t({ it: 'Lock planimetria', en: 'Floor plan lock' })}</div>
		                      <button
		                        onClick={() => setLockInfoOpen(false)}
		                        className="text-slate-400 hover:text-ink"
		                        title={t({ it: 'Chiudi', en: 'Close' })}
		                      >
		                        <X size={14} />
		                      </button>
		                    </div>
		                    <div className="px-2 pt-2 text-sm font-semibold text-ink">{renderPlan.name}</div>
		                    <div className="px-2 text-[11px] text-slate-500">
		                      {client?.shortName || client?.name} / {site?.name}
		                    </div>
		                    {lockState.grant ? (
		                      <div className="mt-2 flex items-center gap-2 px-2 text-[11px] text-slate-600">
		                        <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700">
		                          <Hourglass size={14} />
		                        </span>
		                        <span>
		                          {t({ it: 'Lock concesso a', en: 'Lock granted to' })}:{' '}
		                          <span className="font-semibold text-ink">{lockState.grant.username}</span>
		                        </span>
		                      </div>
		                    ) : lockState.lockedBy ? (
		                      <div className="mt-2 flex items-center gap-2 px-2 text-[11px] text-slate-600">
		                        <UserAvatar src={(lockState as any)?.lockedBy?.avatarUrl} username={(lockState as any)?.lockedBy?.username} size={18} />
		                        <span>
		                          {t({ it: 'Bloccato da', en: 'Locked by' })}:{' '}
		                          <span className="font-semibold text-ink">{lockState.lockedBy.username}</span>
		                        </span>
		                      </div>
		                    ) : null}
		                    <div className="mt-3 space-y-1 px-2 text-[11px] text-slate-600">
		                      <div>
		                        <span className="font-semibold text-slate-700">{t({ it: 'Ultima azione', en: 'Last action' })}</span>:{' '}
		                        {formatPresenceDate((lockState as any)?.meta?.lastActionAt)}
		                      </div>
		                      <div>
		                        <span className="font-semibold text-slate-700">{t({ it: 'Ultimo salvataggio', en: 'Last save' })}</span>:{' '}
		                        {formatPresenceDate((lockState as any)?.meta?.lastSavedAt)}
		                      </div>
		                      <div>
		                        <span className="font-semibold text-slate-700">{t({ it: 'Revisione', en: 'Revision' })}</span>:{' '}
		                        {String((lockState as any)?.meta?.lastSavedRev || '').trim() || '—'}
		                      </div>
		                      {lockState.grant ? (
		                        <div>
		                          <span className="font-semibold text-slate-700">{t({ it: 'Valida per', en: 'Valid for' })}</span>:{' '}
		                          {formatMinutes(grantRemainingMinutes ?? lockState.grant.minutes)} {t({ it: 'minuti', en: 'minutes' })}
		                        </div>
		                      ) : null}
		                    </div>
		                    {lockState.lockedBy && lockState.lockedBy.userId !== user?.id ? (
		                      <button
		                        onClick={() => {
		                          setLockInfoOpen(false);
                              const detail = {
                                planId,
                                planName: renderPlan.name,
                                clientName: client?.shortName || client?.name,
                                siteName: site?.name,
                                userId: lockState.lockedBy?.userId,
                                username: lockState.lockedBy?.username,
                                avatarUrl: (lockState.lockedBy as any)?.avatarUrl || ''
                              };
                              window.dispatchEvent(new CustomEvent(UNLOCK_REQUEST_EVENT, { detail }));
		                        }}
		                        className="mt-3 flex w-full items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
		                        title={t({ it: 'Chiedi unlock', en: 'Request unlock' })}
		                      >
		                        {t({ it: 'Chiedi unlock', en: 'Request unlock' })}
		                      </button>
		                    ) : null}
		                    {isSuperAdmin && lockState.lockedBy && lockState.lockedBy.userId !== user?.id ? (
		                      <button
		                        onClick={() => {
		                          setLockInfoOpen(false);
                              const detail = {
                                planId,
                                planName: renderPlan.name,
                                clientName: client?.shortName || client?.name,
                                siteName: site?.name,
                                userId: lockState.lockedBy?.userId,
                                username: lockState.lockedBy?.username,
                                avatarUrl: (lockState.lockedBy as any)?.avatarUrl || ''
                              };
                              window.dispatchEvent(new CustomEvent(FORCE_UNLOCK_EVENT, { detail }));
		                        }}
		                        className="mt-2 flex w-full items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
		                        title={t({ it: 'Force unlock (Superadmin)', en: 'Force unlock (Superadmin)' })}
		                      >
		                        {t({ it: 'Force unlock', en: 'Force unlock' })}
		                      </button>
		                    ) : null}
		                  </div>
		                ) : null}
		              </div>
		            ) : null}
		            {isReadOnly && !lockedByOther ? (
		              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
		                {activeRevision
		                  ? t({ it: `Sola lettura: ${activeRevision.name}`, en: `Read-only: ${activeRevision.name}` })
		                  : planAccess !== 'rw'
		                    ? t({ it: 'Sola lettura (permessi)', en: 'Read-only (permissions)' })
		                    : lockRequired
		                      ? t({ it: 'Lock non acquisito', en: 'Lock not acquired' })
		                      : t({ it: 'Sola lettura', en: 'Read-only' })}
		              </span>
		            ) : null}
	            {lockRequired && !lockState.mine && lockAvailable ? (
	              <button
	                onClick={requestPlanLock}
	                className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
	                title={t({ it: 'Richiedi il lock per modificare', en: 'Request the lock to edit' })}
	              >
	                {t({ it: 'Prendi lock', en: 'Acquire lock' })}
	              </button>
	            ) : null}
	            {presenceCount ? (
	              <div ref={presenceRef} className="relative">
	                <button
	                  onClick={() => setPresenceOpen((v) => !v)}
	                  className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
	                  title={t({ it: 'Mostra utenti online', en: 'Show online users' })}
	                >
	                  {t({ it: `${presenceCount} utenti online`, en: `${presenceCount} users online` })}
	                </button>
	                {presenceOpen ? (
	                  <div className="absolute left-0 z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 text-xs shadow-card">
	                    <div className="flex items-center justify-between px-2 pb-2">
	                      <div className="font-semibold text-ink">{t({ it: 'Utenti online', en: 'Online users' })}</div>
	                      <button
	                        onClick={() => setPresenceOpen(false)}
	                        className="text-slate-400 hover:text-ink"
	                        title={t({ it: 'Chiudi', en: 'Close' })}
	                      >
	                        <X size={14} />
	                      </button>
	                    </div>
		                    <div className="max-h-56 space-y-2 overflow-y-auto px-1 pb-1">
			                      {presenceEntries.map((entry) => (
			                        <div
			                          key={entry.userId}
			                          className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5"
			                        >
			                          <div className="flex items-start justify-between gap-2">
			                            <div className="min-w-0">
			                              <div className="flex items-center gap-2">
			                                <UserAvatar src={(entry as any).avatarUrl} username={entry.username} size={18} />
			                                <div className="min-w-0 text-xs font-semibold text-ink">{entry.username || 'user'}</div>
			                              </div>
			                            </div>
				                            {entry.userId !== user?.id ? (
				                              <button
				                                onClick={() => openUnlockCompose(entry)}
				                                disabled={
				                                  !(
				                                    (Array.isArray((entry as any).locks) && (entry as any).locks.length) ||
				                                    (entry as any).lock
				                                  )
				                                }
				                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
				                                title={t({ it: 'Richiedi unlock', en: 'Request unlock' })}
				                              >
				                                <Unlock size={14} />
				                              </button>
				                            ) : null}
			                          </div>
			                          <div className="text-[11px] text-slate-500">
			                            {t({ it: 'Connesso', en: 'Connected' })}: {formatPresenceDate(entry.connectedAt)}
			                          </div>
			                          {isSuperAdmin ? (
			                            <div className="text-[11px] text-slate-500">
			                              {t({ it: 'IP', en: 'IP' })}: {entry.ip || '—'}
			                            </div>
			                          ) : null}
		                          <div className="text-[11px] text-slate-500">
		                            {t({ it: 'Lock', en: 'Lock' })}: {formatPresenceLock(entry.lock, entry.locks)}
		                          </div>
		                        </div>
		                      ))}
	                    </div>
	                  </div>
	                ) : null}
	              </div>
	            ) : null}
            {totalLayerCount ? <LayersPopoverPanel {...{ allItemsLabel, allItemsSelected, effectiveVisibleLayerIds, getLayerNote, hideAllLayers, lang, layerIds, layersPopoverOpen, layersPopoverRef, normalizeLayerSelection, orderedPlanLayers, planId, setHideAllLayers, setLayersPopoverOpen, setLayersQuickMenu, setVisibleLayerIds, t, totalLayerCount, visibleLayerCount }} /> : null}
            <div className="relative">
	              <button
	                onClick={() => setCountsOpen((v) => !v)}
	                className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
	                title={t({ it: 'Numero oggetti', en: 'Object count' })}
	              >
	                {t({ it: `${renderPlan.objects.length} oggetti`, en: `${renderPlan.objects.length} objects` })}
              </button>
	              {countsOpen ? <CountsMenuPanel {...{ counts, expandedType, getTypeIcon, getTypeLabel, objectListMatches, objectListQuery, objectsByType, renderPlan, setCountsOpen, setExpandedType, setObjectListQuery, setSelectedObject, setTypeMenu, t, triggerHighlight }} /> : null}
	            </div>
            <div className="relative">
	              <button
	                onClick={() => setRoomsOpen((v) => !v)}
	                className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
	                title={t({ it: 'Stanze', en: 'Rooms' })}
	              >
	                {rooms.length} {t({ it: 'stanze', en: 'rooms' })}
	              </button>
              {roomsOpen ? <RoomsMenuPanel {...{ beginRoomDraw, beginRoomPolyDraw, clearSelection, expandedRoomId, getTypeIcon, isReadOnly, newRoomMenuOpen, openEditRoom, roomDrawMode, roomStatsById, rooms, selectedRoomId, setCapacityDashboardOpen, setCapacityDashboardPreset, setConfirmDeleteRoomId, setExpandedRoomId, setHighlightRoom, setNewRoomMenuOpen, setRoomAllocationOpen, setRoomAllocationPreset, setRoomDrawMode, setRoomsOpen, setSelectedObject, setSelectedRoomId, setSelectedRoomIds, t, triggerHighlight }} /> : null}
            </div>
	            <div className="ml-1 flex h-8 items-center gap-1.5">
	              {selectedObjectId ? (
	                <>
	                  <span className="text-xs font-semibold text-slate-600">
	                    {t({ it: 'Selezionato:', en: 'Selected:' })}
	                  </span>
	                  <span className="inline-flex min-w-0 max-w-[220px] items-center truncate rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
	                    {selectedObjectIds.length > 1 || linksInSelection.length
	                      ? t({
	                          it: `${selectedObjectIds.length + linksInSelection.length} elementi`,
	                          en: `${selectedObjectIds.length + linksInSelection.length} items`
                        })
                      : renderPlanObjectById.get(selectedObjectId)?.name}
                  </span>
                  <button
                    onClick={() => {
                      if (selectedObjectIds.length > 1 || linksInSelection.length) {
                        setSelectedObjectsModalOpen(true);
                        return;
                      }
                      handleEdit(selectedObjectId);
	                    }}
	                    disabled={isReadOnly}
	                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
	                    title={t({ it: 'Modifica', en: 'Edit' })}
	                  >
	                    <Pencil size={12} />
	                  </button>
	                  <button
	                    onClick={() => setConfirmDelete([...selectedObjectIds])}
	                    disabled={isReadOnly}
	                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
	                    title={t({ it: 'Elimina', en: 'Delete' })}
	                  >
	                    <Trash size={12} />
	                  </button>
	                </>
	              ) : selectedLinkId ? (
	                isRackLinkId(selectedLinkId) ? (
	                  <>
	                    <span className="text-xs font-semibold text-slate-600">
	                      {t({ it: 'Collegamento rack:', en: 'Rack link:' })}
	                    </span>
	                    <span className="inline-flex min-w-0 max-w-[320px] items-center truncate rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-ink">
	                      {(() => {
	                        const l = rackOverlayById.get(selectedLinkId);
	                        const a = l ? getObjectNameById(String(l.rackFromRackId)) : '';
	                        const b = l ? getObjectNameById(String(l.rackToRackId)) : '';
                        const kindLabel = l?.rackKind === 'fiber' ? t({ it: 'Fibra', en: 'Fiber' }) : t({ it: 'Rame', en: 'Copper' });
                        return `${kindLabel}: ${a} → ${b}`;
                      })()}
                    </span>
                  </>
	                ) : (
	                  <>
	                    <span className="text-xs font-semibold text-slate-600">{t({ it: 'Collegamento:', en: 'Link:' })}</span>
	                    <span className="inline-flex min-w-0 max-w-[320px] items-center truncate rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-ink">
	                      {(() => {
	                        const l = ((basePlan as any).links || []).find((x: any) => x.id === selectedLinkId);
	                        const a = l ? getObjectNameById(String(l.fromId)) : '';
	                        const b = l ? getObjectNameById(String(l.toId)) : '';
                        const label = l ? String(l.name || l.label || t({ it: 'Collegamento', en: 'Link' })) : t({ it: 'Collegamento', en: 'Link' });
                        return `${label}: ${a} → ${b}`;
                      })()}
                    </span>
	                    <button
	                      onClick={() => setLinkEditId(selectedLinkId)}
	                      disabled={isReadOnly}
	                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
	                      title={t({ it: 'Modifica', en: 'Edit' })}
	                    >
	                      <Pencil size={12} />
	                    </button>
	                  </>
	                )
	              ) : (
	                selectedRoomId ? (
	                  <>
	                    <span className="text-xs font-semibold text-slate-600">{t({ it: 'Stanza:', en: 'Room:' })}</span>
	                    <span className="inline-flex min-w-0 max-w-[220px] items-center truncate rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-ink">
	                      {rooms.find((r) => r.id === selectedRoomId)?.name || t({ it: 'Stanza', en: 'Room' })}
	                    </span>
	                    {!isReadOnly ? (
	                      <>
	                        <button
	                          onClick={() => openEditRoom(selectedRoomId)}
	                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
	                          title={t({ it: 'Rinomina stanza', en: 'Rename room' })}
	                        >
	                          <Pencil size={12} />
	                        </button>
	                      </>
	                    ) : null}
                  </>
                ) : (
                  <span className="text-sm text-slate-400">{t({ it: 'Nessuna selezione', en: 'No selection' })}</span>
                )
              )}
            </div>
          </div>
        </div>
          <div className="flex items-center gap-3">
            <div className="relative">
            <SearchBar onSearch={handleSearch} onEnter={handleSearchEnter} inputRef={searchInputRef} className="w-96" />
            <SearchResultsPopover
              open={searchResultsOpen}
              term={searchResultsTerm}
              objectResults={searchResultsObjects}
              roomResults={searchResultsRooms}
              anchorRef={searchInputRef}
              onClose={() => {
                setSearchResultsOpen(false);
                setSearchResultsObjects([]);
                setSearchResultsRooms([]);
              }}
              onSelectObject={(id) => {
                const obj = renderPlan?.objects.find((o) => o.id === id);
                if (!obj) return;
                if (promptRevealForObject(obj)) return;
                setSelectedObject(id);
                triggerHighlight(id);
              }}
              onSelectRoom={(id) => {
                clearSelection();
                setSelectedRoomId(id);
                setSelectedRoomIds([id]);
                setHighlightRoom({ roomId: id, until: Date.now() + 3200 });
              }}
            />
          </div>
              <div className="group relative">
                <button
                  onClick={() => {
                    setMeetingHubModalOpen(true);
                  }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300 bg-emerald-600 text-white shadow-card transition hover:bg-emerald-700"
                  title={t({ it: 'Meeting center', en: 'Meeting center' })}
                >
                  <CalendarClock size={15} />
                </button>
                <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-80 -translate-x-1/2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium leading-5 text-white opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100">
                  {t({
                    it: 'Apri il centro meeting: scegli Scheduling per la timeline sale oppure My meetings per i tuoi meeting.',
                    en: 'Open meeting center: choose Scheduling for room timeline or My meetings for your meetings.'
                  })}
                </div>
              </div>
		          <button
		            onClick={() => {
		              dismissSelectionHintToasts();
		              setInternalMapOpen(true);
	            }}
	            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-card hover:bg-slate-50"
	            title={t({
	              it: 'Mappa interna guidata (3 passi): 1) scegli punto A, 2) scegli punto B, 3) calcola percorso nei corridoi. Supporta ricerca utenti/oggetti/stanze.',
	              en: 'Guided internal map (3 steps): 1) set point A, 2) set point B, 3) compute corridor route. Supports user/object/room search.'
	            })}
	          >
	            <Footprints size={15} />
	          </button>
	          <button
	            onClick={() => setRevisionsOpen(true)}
	            title={t({
	              it: 'Time machine: apri la cronologia revisioni della planimetria, confronta versioni e ripristina uno stato precedente.',
	              en: 'Time machine: open floor-plan revision history, compare versions, and restore a previous state.'
	            })}
	            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-ink shadow-card hover:bg-slate-50"
	          >
	            <History size={18} />
	          </button>
	          <div className="flex items-center gap-2">
	            <button
	              onClick={() => performUndo()}
	              disabled={!canUndo || isReadOnly}
	              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              title={t({ it: 'Annulla (Ctrl/Cmd+Z)', en: 'Undo (Ctrl/Cmd+Z)' })}
            >
              <Undo2 size={16} />
            </button>
            <button
              onClick={() => performRedo()}
              disabled={!canRedo || isReadOnly}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              title={t({ it: 'Ripeti (Ctrl/Cmd+Y)', en: 'Redo (Ctrl/Cmd+Y)' })}
            >
              <Redo2 size={16} />
            </button>
          </div>
          <div
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              hasUnsavedUi ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'
            }`}
            title={
              hasUnsavedUi
                ? t({ it: 'Modifiche non salvate', en: 'Unsaved changes' })
                : t({ it: 'Tutto salvato', en: 'All changes saved' })
            }
          >
            {hasUnsavedUi ? t({ it: 'Non salvato', en: 'Unsaved' }) : t({ it: 'Salvato', en: 'Saved' })}
          </div>
          {!isReadOnly ? (
            <button
              onClick={() => {
                if (!plan) return;
                if (!hasUnsavedUi) {
                  push(t({ it: 'Nessuna modifica da salvare', en: 'No changes to save' }), 'info');
                  return;
                }
                setSaveRevisionModalPreset({ initialBump: 'minor', requireNoteForMajor: false });
                setSaveRevisionOpen(true);
              }}
              title={t({
                it: 'Salva revisione (Cmd/Ctrl+S rapido minor · Cmd/Ctrl+Shift+S major con nota)',
                en: 'Save revision (Cmd/Ctrl+S quick minor · Cmd/Ctrl+Shift+S major with note)'
              })}
              disabled={!hasUnsavedUi}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border shadow-card ${
                hasUnsavedUi
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  : 'border-slate-200 bg-white text-slate-400 opacity-60'
              }`}
            >
	              <Save size={18} />
	            </button>
	          ) : null}
		          {/* Presentation button moved to the in-canvas toolbar (under "VD"). */}
	          <div className="relative">
            {viewsMenuOpen ? <ViewsMenuPanel {...{ applyView, basePlan, handleOverwriteView, orderedViews, push, selectedViewId, setChooseDefaultModal, setConfirmDeleteViewId, setConfirmSetDefaultViewId, setSelectedViewId, setViewModalOpen, setViewsMenuOpen, t }} /> : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
	            <div ref={gridMenuRef} className="relative">
	              <button
	                onClick={() => setGridMenuOpen((v) => !v)}
	                title={t({
                    it: 'Griglia: attiva/disattiva overlay, snap ai punti e step di aggancio per posizionamenti precisi.',
                    en: 'Grid: toggle overlay, snap-to-grid, and step spacing for precise placement.'
                  })}
	                className={`flex h-10 w-10 items-center justify-center rounded-xl border bg-white shadow-card hover:bg-slate-50 ${
	                  gridMenuOpen ? 'border-primary text-primary' : 'border-slate-200 text-ink'
	                }`}
	              >
	                <LayoutGrid size={18} />
              </button>
              {gridMenuOpen ? (
                <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-card">
                  <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Griglia', en: 'Grid' })}</div>
                  <label className="mt-3 flex items-center justify-between gap-2 text-sm font-semibold text-slate-700">
                    <span>{t({ it: 'Snap', en: 'Snap' })}</span>
                    <input
                      type="checkbox"
                      checked={gridSnapEnabled}
                      onChange={(e) => setGridSnapEnabled(e.target.checked)}
                      aria-label={t({ it: 'Snap', en: 'Snap' })}
                    />
                  </label>
                  <label className="mt-2 flex items-center justify-between gap-2 text-sm font-semibold text-slate-700">
                    <span>{t({ it: 'Mostra', en: 'Show' })}</span>
                    <input
                      type="checkbox"
                      checked={showGrid}
                      onChange={(e) => setShowGrid(e.target.checked)}
                      aria-label={t({ it: 'Mostra', en: 'Show' })}
                    />
                  </label>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                      <span>{t({ it: 'Step', en: 'Step' })}</span>
                      <span className="tabular-nums">{gridSize}px</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={80}
                      step={5}
                      value={gridSize}
                      onChange={(e) => setGridSize(Number(e.target.value))}
                      className="mt-2 w-full"
                      title={t({ it: 'Dimensione griglia', en: 'Grid size' })}
                    />
                  </div>
                </div>
              ) : null}
            </div>
            <button
              onClick={(e) => {
                if (scaleMode) {
                  cancelScaleMode();
                  return;
                }
                if (!planScale || e.shiftKey) {
                  startScaleMode();
                  return;
                }
                setShowScaleLine((prev) => !prev);
              }}
              title={
                scaleMode
                  ? t({ it: 'Annulla scala', en: 'Cancel scale' })
                  : planScale
                    ? t({ it: 'Mostra/nascondi scala (Shift per ricalibrare)', en: 'Show/hide scale (Shift to recalibrate)' })
                    : t({
                        it: 'Imposta la scala: necessaria per le misurazioni',
                        en: 'Set the scale: required for measurements'
                      })
              }
              className={`flex h-10 w-10 items-center justify-center rounded-xl border shadow-card ${
                !planScale
                  ? 'border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100'
                  : scaleMode
                    ? 'border-primary bg-white text-primary hover:bg-slate-50'
                    : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
              }`}
	            >
	              <Ruler size={18} />
	            </button>
	            <PrinterMenuButton
		              isReadOnly={isReadOnly}
		              hasPrintArea={!!(basePlan as any)?.printArea}
                  triggerTitle={t({
                    it: 'Stampa: imposta area di stampa, rimuovi area o esporta PDF della planimetria.',
                    en: 'Print: set print area, clear print area, or export floor plan to PDF.'
                  })}
		              onSetPrintArea={() => {
		                setPrintAreaMode(true);
		                push(
	                  t({
	                    it: 'Disegna un rettangolo sulla mappa per impostare l’area di stampa.',
	                    en: 'Draw a rectangle on the map to set the print area.'
	                  }),
	                  'info'
	                );
	              }}
		              onClearPrintArea={() => {
	                updateFloorPlan(basePlan.id, { printArea: undefined });
	                push(t({ it: 'Area di stampa rimossa correttamente', en: 'Print area removed successfully' }), 'info');
	              }}
		              onExportPdf={() => setExportModalOpen(true)}
		            />
		            <Suspense fallback={null}>
		              <UserMenu />
		            </Suspense>
		          </div>
		        </div>
		      </div>
  );
};

export default PlanHeaderBar;
