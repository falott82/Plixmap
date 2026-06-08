import ConfirmDialog from '../ui/ConfirmDialog';
import { postAuditEvent } from '../../api/audit';
import type { FloorPlan } from '../../store/types';
import { usePlanView } from './usePlanView';

type PlanPlacementConfirmDialogsProps = Pick<
  ReturnType<typeof usePlanView>,
  | 'cancelPaste' | 'capacityConfirm' | 'capacityConfirmRef' | 'clearScaleConfirmOpen' | 'clearScaleNow' | 'confirmPaste' | 'deleteObject' | 'dragStartRef' | 'lastInsertedRef' | 'markTouched' | 'moveObject' | 'overlapNotice' | 'pasteConfirm' | 'planId' | 'planRef' | 'proceedPlaceUser' | 'push' | 'roomDepartmentConfirm' | 'setCapacityConfirm' | 'setClearScaleConfirmOpen' | 'setOverlapNotice' | 'setRoomDepartmentConfirm' | 'setUndoConfirm' | 't' | 'undoConfirm' | 'updateObject' | 'updateRoom'
>;

/** Placement/capacity/overlap/scale/paste confirmation dialogs from PlanViewView. */
export const PlanPlacementConfirmDialogs = ({
  cancelPaste,
  capacityConfirm,
  capacityConfirmRef,
  clearScaleConfirmOpen,
  clearScaleNow,
  confirmPaste,
  deleteObject,
  dragStartRef,
  lastInsertedRef,
  markTouched,
  moveObject,
  overlapNotice,
  pasteConfirm,
  planId,
  planRef,
  proceedPlaceUser,
  push,
  roomDepartmentConfirm,
  setCapacityConfirm,
  setClearScaleConfirmOpen,
  setOverlapNotice,
  setRoomDepartmentConfirm,
  setUndoConfirm,
  t,
  undoConfirm,
  updateObject,
  updateRoom,
}: PlanPlacementConfirmDialogsProps) => (
  <>
      <ConfirmDialog
        open={!!capacityConfirm}
        title={t({ it: 'Capienza stanza superata', en: 'Room capacity exceeded' })}
        description={t({
          it: `La stanza "${capacityConfirm?.roomName || t({ it: 'Stanza', en: 'Room' })}" ospita un massimo di ${capacityConfirm?.capacity || 0} postazioni. Vuoi continuare comunque?`,
          en: `Room "${capacityConfirm?.roomName || t({ it: 'Room', en: 'Room' })}" hosts a maximum of ${capacityConfirm?.capacity || 0} seats. Do you want to continue anyway?`
        })}
        confirmLabel={t({ it: 'Sì', en: 'Yes' })}
        cancelLabel={t({ it: 'No', en: 'No' })}
        onCancel={() => {
          const current = capacityConfirmRef.current;
          if (current?.mode === 'move' && current.objectId) {
            moveObject(current.objectId, current.prevX ?? 0, current.prevY ?? 0);
            updateObject(current.objectId, { roomId: current.prevRoomId });
            dragStartRef.current.delete(current.objectId);
          }
          setCapacityConfirm(null);
        }}
        onConfirm={() => {
          const current = capacityConfirmRef.current;
          if (!current) return;
          const { mode, type, x, y, objectId, roomId } = current;
          if (mode === 'move' && objectId) {
            markTouched();
            moveObject(objectId, x, y);
            updateObject(objectId, { roomId });
            dragStartRef.current.delete(objectId);
            setCapacityConfirm(null);
            return;
          }
          setCapacityConfirm(null);
          proceedPlaceUser(type, x, y);
        }}
      />

      <ConfirmDialog
        open={!!overlapNotice}
        title={t({ it: 'Sovrapposizione non consentita', en: 'Overlap not allowed' })}
        description={overlapNotice || undefined}
        confirmLabel={t({ it: 'Ok', en: 'Ok' })}
        cancelLabel={null}
        onCancel={() => setOverlapNotice(null)}
        onConfirm={() => setOverlapNotice(null)}
      />

      <ConfirmDialog
        open={!!roomDepartmentConfirm}
        title={t({ it: 'Allineare reparto stanza?', en: 'Align room department?' })}
        description={
          roomDepartmentConfirm
            ? t({
                it: `L'utente "${roomDepartmentConfirm.userName}" appartiene al reparto "${roomDepartmentConfirm.departmentToAdd}", che non è presente nella stanza "${roomDepartmentConfirm.roomName}". Vuoi aggiungere questo reparto alla stanza?`,
                en: `User "${roomDepartmentConfirm.userName}" belongs to department "${roomDepartmentConfirm.departmentToAdd}", which is not currently assigned to room "${roomDepartmentConfirm.roomName}". Do you want to add this department to the room?`
              })
            : undefined
        }
        confirmLabel={t({ it: 'Aggiungi reparto', en: 'Add department' })}
        cancelLabel={t({ it: 'Non aggiungere', en: 'Do not add' })}
        onCancel={() => {
          const current = roomDepartmentConfirm;
          if (current?.objectId) {
            markTouched();
            moveObject(current.objectId, current.x, current.y);
            updateObject(current.objectId, { roomId: current.roomId });
            dragStartRef.current.delete(current.objectId);
          }
          setRoomDepartmentConfirm(null);
        }}
        onConfirm={() => {
          const current = roomDepartmentConfirm;
          if (!current?.objectId) return;
          const currentPlan = planRef.current as FloorPlan | undefined;
          if (currentPlan) {
            const room = (currentPlan.rooms || []).find((entry) => entry.id === current.roomId);
            if (room) {
              const existingTags = Array.isArray((room as any)?.departmentTags)
                ? ((room as any).departmentTags as any[])
                    .map((tag) => String(tag || '').trim())
                    .filter(Boolean)
                : [];
              const exists = existingTags.some(
                (tag) => tag.toLocaleLowerCase() === String(current.departmentToAdd || '').trim().toLocaleLowerCase()
              );
              if (!exists) {
                updateRoom(currentPlan.id, room.id, { departmentTags: [...existingTags, current.departmentToAdd] } as any);
              }
            }
          }
          markTouched();
          moveObject(current.objectId, current.x, current.y);
          updateObject(current.objectId, { roomId: current.roomId });
          dragStartRef.current.delete(current.objectId);
          setRoomDepartmentConfirm(null);
        }}
      />

      <ConfirmDialog
        open={!!undoConfirm}
        title={t({ it: 'Annullare inserimento?', en: 'Undo placement?' })}
        description={
          undoConfirm
            ? t({
                it: `Stai per annullare l’inserimento dell’oggetto "${undoConfirm.name}".`,
                en: `You are about to undo the insertion of "${undoConfirm.name}".`
              })
            : undefined
        }
        confirmLabel={t({ it: 'Annulla inserimento', en: 'Undo placement' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
        onCancel={() => setUndoConfirm(null)}
        onConfirm={() => {
          if (!undoConfirm) return;
          markTouched();
          deleteObject(undoConfirm.id);
          postAuditEvent({ event: 'object_undo', scopeType: 'plan', scopeId: planId, details: { id: undoConfirm.id } });
          push(t({ it: 'Inserimento annullato', en: 'Placement undone' }), 'info');
          lastInsertedRef.current = null;
          setUndoConfirm(null);
        }}
      />

      <ConfirmDialog
        open={clearScaleConfirmOpen}
        title={t({ it: 'Rimuovere la scala?', en: 'Remove the scale?' })}
        description={t({
          it: 'Se rimuovi la scala, i range WiFi spariranno finché non ne imposti una nuova e le quote verranno convertite in pixel. Confermi?',
          en: 'If you remove the scale, WiFi ranges will disappear until you set a new one, and existing quotes will switch to pixels. Continue?'
        })}
        confirmLabel={t({ it: 'Rimuovi scala', en: 'Remove scale' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
        onCancel={() => setClearScaleConfirmOpen(false)}
        onConfirm={() => {
          setClearScaleConfirmOpen(false);
          clearScaleNow();
        }}
      />

      <ConfirmDialog
        open={!!pasteConfirm}
        title={pasteConfirm?.title || ''}
        description={pasteConfirm?.description}
        confirmLabel={t({ it: 'Incolla', en: 'Paste' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
        onCancel={cancelPaste}
        onConfirm={confirmPaste}
      />
  </>
);
