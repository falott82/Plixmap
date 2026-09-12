import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';

type Translate = (msg: { it: string; en: string }) => string;

export type PlanWallTypeModalProps = {
  wallTypeModal: { ids: string[] } | null;
  setWallTypeModal: (value: null) => void;
  wallTypeDraft: string;
  setWallTypeDraft: (value: string) => void;
  wallTypeDefs: Array<{ id: string }>;
  getTypeLabel: (id: string) => string;
  applyWallType: () => void;
  t: Translate;
};

/**
 * Modal to choose the material/type for one or more selected wall segments,
 * extracted from PlanViewView.tsx.
 */
export const PlanWallTypeModal = ({
  wallTypeModal,
  setWallTypeModal,
  wallTypeDraft,
  setWallTypeDraft,
  wallTypeDefs,
  getTypeLabel,
  applyWallType,
  t
}: PlanWallTypeModalProps) => (
  <Transition show={!!wallTypeModal} as={Fragment}>
    <Dialog as="div" className="relative z-50" onClose={() => setWallTypeModal(null)}>
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
            <Dialog.Panel className="w-full max-w-md modal-panel">
              <Dialog.Title className="modal-title">{t({ it: 'Tipo muro', en: 'Wall type' })}</Dialog.Title>
              <div className="mt-2 text-sm text-slate-600">
                {(() => {
                  const count = wallTypeModal?.ids.length || 1;
                  const itLabel = count === 1 ? 'muro' : 'muri';
                  const enLabel = count === 1 ? 'wall' : 'walls';
                  return t({
                    it: `Seleziona il materiale per ${count} ${itLabel}.`,
                    en: `Choose the material for ${count} ${enLabel}.`
                  });
                })()}
              </div>
              <label className="mt-4 block text-sm font-semibold text-slate-700">
                {t({ it: 'Materiale', en: 'Material' })}
              </label>
              <select
                value={wallTypeDraft}
                onChange={(e) => setWallTypeDraft(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
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
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={() => setWallTypeModal(null)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {t({ it: 'Annulla', en: 'Cancel' })}
                </button>
                <button
                  onClick={applyWallType}
                  className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                >
                  {t({ it: 'Salva', en: 'Save' })}
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </div>
    </Dialog>
  </Transition>
);
