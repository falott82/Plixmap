import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import RoomShapePreview from './RoomShapePreview';
import { getWallTypeColor } from '../../utils/wallColors';
import { DEFAULT_WALL_TYPES } from '../../store/data';

type Translate = (msg: { it: string; en: string }) => string;

export type PlanRoomWallTypeModalProps = {
  roomWallTypeModal: { mode?: 'create' | 'edit'; roomName?: string; segments?: Array<{ label: string }> } | null;
  setRoomWallTypeModal: (value: null) => void;
  roomWallPreview: { points: { x: number; y: number }[]; segments: { label: string; lengthLabel?: string | null }[] } | null;
  roomWallTypeAllValue: string | null;
  applyRoomWallTypeAll: (value: string) => void;
  wallTypeDefs: Array<{ id: string }>;
  getTypeLabel: (id: string) => string;
  roomWallTypeSelections: string[];
  defaultWallTypeId: string | undefined;
  setRoomWallTypeAt: (index: number, value: string) => void;
  createRoomWalls: () => void;
  t: Translate;
};

/**
 * Modal to choose per-segment wall materials when creating/editing a room's
 * walls, extracted from PlanViewView.tsx.
 */
export const PlanRoomWallTypeModal = ({
  roomWallTypeModal,
  setRoomWallTypeModal,
  roomWallPreview,
  roomWallTypeAllValue,
  applyRoomWallTypeAll,
  wallTypeDefs,
  getTypeLabel,
  roomWallTypeSelections,
  defaultWallTypeId,
  setRoomWallTypeAt,
  createRoomWalls,
  t
}: PlanRoomWallTypeModalProps) => (
  <Transition show={!!roomWallTypeModal} as={Fragment}>
    <Dialog as="div" className="relative z-50" onClose={() => setRoomWallTypeModal(null)}>
      <Transition.Child
        as={Fragment}
        enter="ease-out duration-150"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-in duration-100"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
      </Transition.Child>
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center px-4 py-8">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="w-full max-w-5xl modal-panel">
              <Dialog.Title className="modal-title">{t({ it: 'Muri stanza', en: 'Room walls' })}</Dialog.Title>
              <div className="mt-2 text-sm text-slate-600">
                {t({
                  it:
                    roomWallTypeModal?.mode === 'edit'
                      ? `Modifica il materiale per i muri della stanza "${roomWallTypeModal?.roomName || 'stanza'}".`
                      : `Seleziona il materiale per i muri della stanza "${roomWallTypeModal?.roomName || 'stanza'}".`,
                  en:
                    roomWallTypeModal?.mode === 'edit'
                      ? `Edit the wall material for room "${roomWallTypeModal?.roomName || 'room'}".`
                      : `Choose the wall material for room "${roomWallTypeModal?.roomName || 'room'}".`
                })}
              </div>
              {roomWallPreview ? (
                <RoomShapePreview points={roomWallPreview.points} segments={roomWallPreview.segments} className="mt-4 h-48 w-full" />
              ) : null}
              <label className="mt-4 block text-sm font-semibold text-slate-700">
                {t({ it: 'Tipo predefinito', en: 'Default wall type' })}
              </label>
              <select
                value={roomWallTypeAllValue || ''}
                onChange={(e) => applyRoomWallTypeAll(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="" disabled>
                  {t({ it: 'Selezione personalizzata', en: 'Custom selection' })}
                </option>
                {wallTypeDefs.map((def) => {
                  const label = getTypeLabel(def.id);
                  const attenuation = Number((def as any).attenuationDb);
                  const suffix = Number.isFinite(attenuation) ? ` (${attenuation} dB)` : '';
                  return (
                    <option key={def.id} value={def.id}>
                      {label}
                      {suffix}
                    </option>
                  );
                })}
              </select>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="grid gap-2 md:grid-cols-2">
                  {(roomWallTypeModal?.segments || []).map((segment, index) => {
                    const value = roomWallTypeSelections[index] || defaultWallTypeId || DEFAULT_WALL_TYPES[0];
                    return (
                      <div key={`${segment.label}-${index}`} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2">
                        <div className="min-w-[64px] text-xs font-semibold text-slate-600">{segment.label}</div>
                        <span
                          className="inline-flex h-3 w-3 rounded-full border border-slate-200"
                          style={{ background: getWallTypeColor(value) }}
                        />
                        <select
                          value={value}
                          onChange={(e) => setRoomWallTypeAt(index, e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                        >
                          {wallTypeDefs.map((def) => {
                            const label = getTypeLabel(def.id);
                            const attenuation = Number((def as any).attenuationDb);
                            const suffix = Number.isFinite(attenuation) ? ` (${attenuation} dB)` : '';
                            return (
                              <option key={def.id} value={def.id}>
                                {label}
                                {suffix}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={() => setRoomWallTypeModal(null)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {t({ it: 'Annulla', en: 'Cancel' })}
                </button>
                <button
                  onClick={createRoomWalls}
                  className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                >
                  {roomWallTypeModal?.mode === 'edit'
                    ? t({ it: 'Salva muri', en: 'Save walls' })
                    : t({ it: 'Crea muri', en: 'Create walls' })}
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </div>
    </Dialog>
  </Transition>
);
