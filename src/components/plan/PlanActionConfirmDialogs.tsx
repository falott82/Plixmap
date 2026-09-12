import ConfirmDialog from '../ui/ConfirmDialog';
import { postAuditEvent } from '../../api/audit';
import { usePlanView } from './usePlanView';

type PlanActionConfirmDialogsProps = Pick<
  ReturnType<typeof usePlanView>,
  | 'basePlan' | 'clearObjects' | 'clearSelection' | 'computeRoomReassignments' | 'confirmClearObjects' | 'confirmDelete' | 'confirmDeleteCorridorId' | 'confirmDeleteRoomId' | 'confirmDeleteRoomIds' | 'confirmDeleteViewId' | 'confirmSetDefaultViewId' | 'corridorDoorDraft' | 'corridorQuickMenu' | 'deleteObject' | 'deleteRoom' | 'deleteView' | 'getLayerLabel' | 'getObjectToastLabel' | 'getTypeLabel' | 'goToDefaultView' | 'hideAllLayers' | 'lastInsertedRef' | 'layerRevealPrompt' | 'markTouched' | 'normalizeLayerSelection' | 'pendingRoomDeletesRef' | 'planId' | 'planRef' | 'push' | 'renderPlanObjectById' | 'rooms' | 'selectedCorridorId' | 'selectedRoomDoorId' | 'selectedRoomId' | 'selectedRoomIds' | 'selectedViewId' | 'setConfirmClearObjects' | 'setConfirmDelete' | 'setConfirmDeleteCorridorId' | 'setConfirmDeleteRoomId' | 'setConfirmDeleteRoomIds' | 'setConfirmDeleteViewId' | 'setConfirmSetDefaultViewId' | 'setContextMenu' | 'setCorridorDoorDraft' | 'setCorridorQuickMenu' | 'setDefaultView' | 'setHideAllLayers' | 'setLayerRevealPrompt' | 'setObjectRoomIds' | 'setPendingRoomDeletes' | 'setSelectedCorridorId' | 'setSelectedObject' | 'setSelectedRoomDoorId' | 'setSelectedRoomId' | 'setSelectedRoomIds' | 'setSelectedViewId' | 'setViewsMenuOpen' | 'setVisibleLayerIds' | 't' | 'triggerHighlight' | 'updateFloorPlan' | 'visibleLayerIds'
>;

/** Delete/clear/default-view/layer-reveal confirmation dialogs from PlanViewView. */
export const PlanActionConfirmDialogs = ({
  basePlan,
  clearObjects,
  clearSelection,
  computeRoomReassignments,
  confirmClearObjects,
  confirmDelete,
  confirmDeleteCorridorId,
  confirmDeleteRoomId,
  confirmDeleteRoomIds,
  confirmDeleteViewId,
  confirmSetDefaultViewId,
  corridorDoorDraft,
  corridorQuickMenu,
  deleteObject,
  deleteRoom,
  deleteView,
  getLayerLabel,
  getObjectToastLabel,
  getTypeLabel,
  goToDefaultView,
  hideAllLayers,
  lastInsertedRef,
  layerRevealPrompt,
  markTouched,
  normalizeLayerSelection,
  pendingRoomDeletesRef,
  planId,
  planRef,
  push,
  renderPlanObjectById,
  rooms,
  selectedCorridorId,
  selectedRoomDoorId,
  selectedRoomId,
  selectedRoomIds,
  selectedViewId,
  setConfirmClearObjects,
  setConfirmDelete,
  setConfirmDeleteCorridorId,
  setConfirmDeleteRoomId,
  setConfirmDeleteRoomIds,
  setConfirmDeleteViewId,
  setConfirmSetDefaultViewId,
  setContextMenu,
  setCorridorDoorDraft,
  setCorridorQuickMenu,
  setDefaultView,
  setHideAllLayers,
  setLayerRevealPrompt,
  setObjectRoomIds,
  setPendingRoomDeletes,
  setSelectedCorridorId,
  setSelectedObject,
  setSelectedRoomDoorId,
  setSelectedRoomId,
  setSelectedRoomIds,
  setSelectedViewId,
  setViewsMenuOpen,
  setVisibleLayerIds,
  t,
  triggerHighlight,
  updateFloorPlan,
  visibleLayerIds,
}: PlanActionConfirmDialogsProps) => (
  <>
      <ConfirmDialog
        open={!!layerRevealPrompt}
        title={t({ it: 'Oggetto in layer nascosto', en: 'Object in hidden layer' })}
        description={
          layerRevealPrompt
            ? t({
                it: `Per visualizzare "${getObjectToastLabel(layerRevealPrompt.objectName, layerRevealPrompt.typeId)}" devi attivare il layer ${getLayerLabel(layerRevealPrompt.missingLayerIds[0])}${
                  layerRevealPrompt.missingLayerIds.length > 1 ? ' (e altri).' : '.'
                }`,
                en: `To show "${getObjectToastLabel(layerRevealPrompt.objectName, layerRevealPrompt.typeId)}" you need to enable layer ${getLayerLabel(layerRevealPrompt.missingLayerIds[0])}${
                  layerRevealPrompt.missingLayerIds.length > 1 ? ' (and others).' : '.'
                }`
              })
            : undefined
        }
        onCancel={() => setLayerRevealPrompt(null)}
        onConfirm={() => {
          if (!layerRevealPrompt) return;
          const missing = layerRevealPrompt.missingLayerIds;
          if (hideAllLayers) setHideAllLayers(planId, false);
          const next = normalizeLayerSelection([...visibleLayerIds, ...missing]);
          setVisibleLayerIds(planId, next);
          const targetId = layerRevealPrompt.objectId;
          setLayerRevealPrompt(null);
          setSelectedObject(targetId);
          triggerHighlight(targetId);
        }}
        confirmLabel={t({ it: 'Mostra', en: 'Show' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
      />
      <ConfirmDialog
        open={!!confirmDelete}
        title={
          confirmDelete && confirmDelete.length > 1
            ? t({ it: 'Eliminare gli oggetti?', en: 'Delete objects?' })
            : t({ it: 'Eliminare l’oggetto?', en: 'Delete object?' })
        }
	        description={
	          (() => {
	            if (!confirmDelete || !confirmDelete.length)
                return t({
                  it: 'L’oggetto verrà rimosso dalla planimetria.',
                  en: 'The object will be removed from the floor plan.'
                });
            if (confirmDelete.length === 1) {
              const obj = renderPlanObjectById.get(confirmDelete[0]);
              const label = obj ? getTypeLabel(obj.type) : undefined;
              const name = obj?.name || t({ it: 'oggetto', en: 'object' });
              const normalizedLabel = label ? label.trim().toLowerCase() : '';
              const normalizedName = String(name || '').trim().toLowerCase();
              const showLabel = !!label && normalizedLabel && normalizedLabel !== normalizedName;
              return t({
                  it: `Rimuovere ${showLabel ? `${label!.toLowerCase()} ` : ''}"${name}" dalla planimetria?`,
                  en: `Remove ${showLabel ? `${label} ` : ''}"${name}" from the floor plan?`
                });
            }
	            return t({
                it: `Rimuovere ${confirmDelete.length} oggetti dalla planimetria?`,
                en: `Remove ${confirmDelete.length} objects from the floor plan?`
              });
	          })()
	        }
        onCancel={() => {
          setConfirmDelete(null);
          setPendingRoomDeletes([]);
        }}
        onConfirm={() => {
          if (!confirmDelete || !confirmDelete.length) return;
          markTouched();
          confirmDelete.forEach((id) => deleteObject(id));
          if (lastInsertedRef.current && confirmDelete.includes(lastInsertedRef.current.id)) {
            lastInsertedRef.current = null;
          }
          const roomDeletes = pendingRoomDeletesRef.current || [];
          if (roomDeletes.length) {
            const remainingRooms = rooms.filter((r) => !roomDeletes.includes(r.id));
            const updates = computeRoomReassignments(remainingRooms, basePlan.objects);
            const currentRoomDoors = Array.isArray((planRef.current as any)?.roomDoors) ? ((planRef.current as any).roomDoors as any[]) : [];
            for (const roomId of roomDeletes) {
              deleteRoom(basePlan.id, roomId);
              postAuditEvent({ event: 'room_delete', scopeType: 'plan', scopeId: basePlan.id, details: { id: roomId } });
            }
            if (currentRoomDoors.length) {
              const nextRoomDoors = currentRoomDoors.filter((door) => {
                const a = String((door as any)?.roomAId || '');
                const b = String((door as any)?.roomBId || '');
                return !roomDeletes.includes(a) && !roomDeletes.includes(b);
              });
              if (nextRoomDoors.length !== currentRoomDoors.length) {
                updateFloorPlan(basePlan.id, { roomDoors: nextRoomDoors as any } as any);
              }
            }
            if (Object.keys(updates).length) setObjectRoomIds(basePlan.id, updates);
            setSelectedRoomIds((prev) => prev.filter((id) => !roomDeletes.includes(id)));
            if (selectedRoomId && roomDeletes.includes(selectedRoomId)) setSelectedRoomId(undefined);
            if (selectedRoomDoorId) {
              const stillExists = currentRoomDoors.some(
                (door) =>
                  String((door as any)?.id || '') === selectedRoomDoorId &&
                  !roomDeletes.includes(String((door as any)?.roomAId || '')) &&
                  !roomDeletes.includes(String((door as any)?.roomBId || ''))
              );
              if (!stillExists) setSelectedRoomDoorId(null);
            }
            setPendingRoomDeletes([]);
          }
          push(
            confirmDelete.length === 1 && !roomDeletes.length
              ? t({ it: 'Oggetto eliminato', en: 'Object deleted' })
              : t({
                  it: roomDeletes.length ? 'Oggetti e stanze eliminati' : 'Oggetti eliminati',
                  en: roomDeletes.length ? 'Objects and rooms deleted' : 'Objects deleted'
                }),
            'info'
          );
          postAuditEvent({
            event: confirmDelete.length === 1 ? 'object_delete' : 'objects_delete',
            scopeType: 'plan',
            scopeId: planId,
            details: { ids: confirmDelete }
          });
          setConfirmDelete(null);
          setContextMenu(null);
          clearSelection();
        }}
        confirmLabel={t({ it: 'Elimina', en: 'Delete' })}
        cancelLabel="Esc"
      />

      <ConfirmDialog
        open={!!confirmSetDefaultViewId}
        title={t({ it: 'Rendere questa vista predefinita?', en: 'Make this view the default?' })}
        description={t({
          it: 'Procedendo, questa vista diventerà la vista predefinita per la planimetria e sostituirà l’eventuale predefinita esistente.',
          en: 'If you continue, this view will become the default for this floor plan and will replace the current default view (if any).'
        })}
        onCancel={() => setConfirmSetDefaultViewId(null)}
        onConfirm={() => {
          if (!confirmSetDefaultViewId) return;
          setDefaultView(basePlan.id, confirmSetDefaultViewId);
          push(t({ it: 'Vista predefinita aggiornata', en: 'Default view updated' }), 'success');
          setConfirmSetDefaultViewId(null);
        }}
        confirmLabel={t({ it: 'Rendi default', en: 'Make default' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
      />

      <ConfirmDialog
        open={!!confirmDeleteRoomId}
        title={t({ it: 'Eliminare la stanza?', en: 'Delete room?' })}
        description={
          confirmDeleteRoomId
            ? t({
                it: `Eliminare la stanza "${rooms.find((r) => r.id === confirmDeleteRoomId)?.name || 'stanza'}" e scollegare gli oggetti associati?`,
                en: `Delete room "${rooms.find((r) => r.id === confirmDeleteRoomId)?.name || 'room'}" and unlink associated objects?`
              })
            : undefined
        }
        onCancel={() => setConfirmDeleteRoomId(null)}
        onConfirm={() => {
          if (!confirmDeleteRoomId) return;
          markTouched();
          const roomName = rooms.find((r) => r.id === confirmDeleteRoomId)?.name;
          const remainingRooms = rooms.filter((r) => r.id !== confirmDeleteRoomId);
          const updates = computeRoomReassignments(remainingRooms, basePlan.objects);
          const currentRoomDoors = Array.isArray((planRef.current as any)?.roomDoors) ? ((planRef.current as any).roomDoors as any[]) : [];
          deleteRoom(basePlan.id, confirmDeleteRoomId);
          if (currentRoomDoors.length) {
            const nextRoomDoors = currentRoomDoors.filter((door) => {
              const a = String((door as any)?.roomAId || '');
              const b = String((door as any)?.roomBId || '');
              return a !== confirmDeleteRoomId && b !== confirmDeleteRoomId;
            });
            if (nextRoomDoors.length !== currentRoomDoors.length) {
              updateFloorPlan(basePlan.id, { roomDoors: nextRoomDoors as any } as any);
            }
          }
          postAuditEvent({ event: 'room_delete', scopeType: 'plan', scopeId: basePlan.id, details: { id: confirmDeleteRoomId } });
          if (Object.keys(updates).length) setObjectRoomIds(basePlan.id, updates);
          if (selectedRoomId === confirmDeleteRoomId) setSelectedRoomId(undefined);
          if (selectedRoomIds.includes(confirmDeleteRoomId)) {
            setSelectedRoomIds(selectedRoomIds.filter((id) => id !== confirmDeleteRoomId));
          }
          if (selectedRoomDoorId) {
            const stillExists = currentRoomDoors.some(
              (door) =>
                String((door as any)?.id || '') === selectedRoomDoorId &&
                String((door as any)?.roomAId || '') !== confirmDeleteRoomId &&
                String((door as any)?.roomBId || '') !== confirmDeleteRoomId
            );
            if (!stillExists) setSelectedRoomDoorId(null);
          }
          push(
            t({
              it: `Stanza eliminata${roomName ? `: ${roomName}` : ''}`,
              en: `Room deleted${roomName ? `: ${roomName}` : ''}`
            }),
            'info'
          );
          setConfirmDeleteRoomId(null);
        }}
        confirmLabel={t({ it: 'Elimina', en: 'Delete' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
        confirmOnEnter
      />

      <ConfirmDialog
        open={!!confirmDeleteRoomIds}
        title={t({ it: 'Eliminare le stanze?', en: 'Delete rooms?' })}
        description={
          confirmDeleteRoomIds?.length
            ? t({
                it: `Stai per eliminare ${confirmDeleteRoomIds.length} stanze e scollegare gli oggetti associati. Continuare?`,
                en: `You are about to delete ${confirmDeleteRoomIds.length} rooms and unlink associated objects. Continue?`
              })
            : undefined
        }
        onCancel={() => setConfirmDeleteRoomIds(null)}
        onConfirm={() => {
          if (!confirmDeleteRoomIds?.length) return;
          markTouched();
          const roomIds = [...confirmDeleteRoomIds];
          const remainingRooms = rooms.filter((r) => !roomIds.includes(r.id));
          const updates = computeRoomReassignments(remainingRooms, basePlan.objects);
          const currentRoomDoors = Array.isArray((planRef.current as any)?.roomDoors) ? ((planRef.current as any).roomDoors as any[]) : [];
          for (const roomId of roomIds) {
            deleteRoom(basePlan.id, roomId);
            postAuditEvent({ event: 'room_delete', scopeType: 'plan', scopeId: basePlan.id, details: { id: roomId } });
          }
          if (currentRoomDoors.length) {
            const nextRoomDoors = currentRoomDoors.filter((door) => {
              const a = String((door as any)?.roomAId || '');
              const b = String((door as any)?.roomBId || '');
              return !roomIds.includes(a) && !roomIds.includes(b);
            });
            if (nextRoomDoors.length !== currentRoomDoors.length) {
              updateFloorPlan(basePlan.id, { roomDoors: nextRoomDoors as any } as any);
            }
          }
          if (Object.keys(updates).length) setObjectRoomIds(basePlan.id, updates);
          setSelectedRoomIds((prev) => prev.filter((id) => !roomIds.includes(id)));
          if (selectedRoomId && roomIds.includes(selectedRoomId)) setSelectedRoomId(undefined);
          if (selectedRoomDoorId) {
            const stillExists = currentRoomDoors.some(
              (door) =>
                String((door as any)?.id || '') === selectedRoomDoorId &&
                !roomIds.includes(String((door as any)?.roomAId || '')) &&
                !roomIds.includes(String((door as any)?.roomBId || ''))
            );
            if (!stillExists) setSelectedRoomDoorId(null);
          }
          push(
            t({
              it: `Stanze eliminate: ${roomIds.length}`,
              en: `Rooms deleted: ${roomIds.length}`
            }),
            'info'
          );
          setConfirmDeleteRoomIds(null);
        }}
        confirmLabel={t({ it: 'Elimina', en: 'Delete' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
        confirmOnEnter
      />

      <ConfirmDialog
        open={!!confirmDeleteCorridorId}
        title={t({ it: 'Eliminare il corridoio?', en: 'Delete corridor?' })}
        description={
          confirmDeleteCorridorId
            ? t({
                it: `Eliminare il corridoio "${(basePlan.corridors || []).find((c) => c.id === confirmDeleteCorridorId)?.name || 'corridoio'}" insieme a porte e punti di connessione?`,
                en: `Delete corridor "${(basePlan.corridors || []).find((c) => c.id === confirmDeleteCorridorId)?.name || 'corridor'}" including doors and connection points?`
              })
            : undefined
        }
        onCancel={() => setConfirmDeleteCorridorId(null)}
        onConfirm={() => {
          if (!confirmDeleteCorridorId) return;
          const current = (basePlan.corridors || []).filter(Boolean);
          const target = current.find((c) => c.id === confirmDeleteCorridorId);
          if (!target) {
            setConfirmDeleteCorridorId(null);
            return;
          }
          const next = current.filter((c) => c.id !== confirmDeleteCorridorId);
          markTouched();
          updateFloorPlan(basePlan.id, { corridors: next } as any);
          postAuditEvent({
            event: 'corridor_delete',
            scopeType: 'plan',
            scopeId: basePlan.id,
            details: {
              id: target.id,
              name: target.name || null,
              doors: Array.isArray(target.doors) ? target.doors.length : 0,
              connections: Array.isArray(target.connections) ? target.connections.length : 0
            }
          });
          if (selectedCorridorId === confirmDeleteCorridorId) setSelectedCorridorId(undefined);
          if (corridorDoorDraft?.corridorId === confirmDeleteCorridorId) setCorridorDoorDraft(null);
          if (corridorQuickMenu?.id === confirmDeleteCorridorId) setCorridorQuickMenu(null);
          push(t({ it: 'Corridoio eliminato', en: 'Corridor deleted' }), 'info');
          setContextMenu(null);
          setConfirmDeleteCorridorId(null);
        }}
        confirmLabel={t({ it: 'Elimina', en: 'Delete' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
        confirmOnEnter
      />

      <ConfirmDialog
        open={!!confirmDeleteViewId}
        title={t({ it: 'Eliminare la vista?', en: 'Delete view?' })}
        description={
          confirmDeleteViewId
            ? t({
                it: `Eliminare la vista "${basePlan.views?.find((v) => v.id === confirmDeleteViewId)?.name || 'vista'}"?`,
                en: `Delete view "${basePlan.views?.find((v) => v.id === confirmDeleteViewId)?.name || 'view'}"?`
              })
            : undefined
        }
        onCancel={() => setConfirmDeleteViewId(null)}
        onConfirm={() => {
          if (!confirmDeleteViewId) return;
          markTouched();
          const deleting = basePlan.views?.find((v) => v.id === confirmDeleteViewId);
          deleteView(basePlan.id, confirmDeleteViewId);
          setConfirmDeleteViewId(null);
          setViewsMenuOpen(false);
          push(t({ it: 'Vista eliminata', en: 'View deleted' }), 'info');
          if (selectedViewId === confirmDeleteViewId) setSelectedViewId('__last__');
          // After deleting, always return to default view if available.
          window.setTimeout(() => goToDefaultView(), 0);
          if (deleting?.isDefault && (basePlan.views || []).length <= 1) {
            push(t({ it: 'Nessuna vista di default rimasta', en: 'No default view remaining' }), 'info');
          }
        }}
        confirmLabel={t({ it: 'Elimina', en: 'Delete' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
      />

      <ConfirmDialog
        open={confirmClearObjects}
        title={t({ it: 'Eliminare tutti gli oggetti?', en: 'Delete all objects?' })}
        description={t({
          it: 'Tutti gli oggetti della planimetria verranno rimossi. Operazione non annullabile.',
          en: 'All objects in this floor plan will be removed. This cannot be undone.'
        })}
        onCancel={() => setConfirmClearObjects(false)}
        onConfirm={() => {
          clearObjects(basePlan.id);
          push(t({ it: 'Oggetti rimossi', en: 'Objects removed' }), 'info');
          setConfirmClearObjects(false);
          setSelectedObject(undefined);
        }}
        confirmLabel={t({ it: 'Elimina tutti', en: 'Delete all' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
      />

  </>
);
