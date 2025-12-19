import { Fragment, useEffect, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Star, X } from 'lucide-react';
import { FloorPlanView } from '../../store/types';
import { useT } from '../../i18n/useT';

interface Props {
  open: boolean;
  views: FloorPlanView[];
  onClose: () => void;
  onConfirm: (newDefaultViewId: string) => void;
}

const ChooseDefaultViewModal = ({ open, views, onClose, onConfirm }: Props) => {
  const firstId = useMemo(() => views[0]?.id, [views]);
  const [selectedId, setSelectedId] = useState<string>(firstId || '');
  const t = useT();

  useEffect(() => {
    if (!open) return;
    setSelectedId(firstId || '');
  }, [firstId, open]);

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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
              <Dialog.Panel className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card">
                <div className="flex items-center justify-between">
                  <Dialog.Title className="text-lg font-semibold text-ink">
                    {t({ it: 'Scegli la nuova vista predefinita', en: 'Choose the new default view' })}
                  </Dialog.Title>
                  <button onClick={onClose} className="text-slate-500 hover:text-ink">
                    <X size={18} />
                  </button>
                </div>
                <Dialog.Description className="mt-2 text-sm text-slate-600">
                  {t({
                    it: 'Stai eliminando la vista predefinita: seleziona quale vista impostare come nuova predefinita.',
                    en: 'You are deleting the default view: choose which view should become the new default.'
                  })}
                </Dialog.Description>

                <div className="mt-4 space-y-2">
                  {views.length ? (
                    views.map((v) => (
                      <label
                        key={v.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition ${
                          selectedId === v.id ? 'border-primary bg-primary/5' : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="default-view"
                          value={v.id}
                          checked={selectedId === v.id}
                          onChange={() => setSelectedId(v.id)}
                          className="mt-1 h-4 w-4 text-primary"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-ink">{v.name}</div>
                          {v.description ? (
                            <div className="truncate text-xs text-slate-500">{v.description}</div>
                          ) : null}
                        </div>
                      </label>
                    ))
                  ) : (
                    <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                      {t({ it: 'Nessuna vista disponibile.', en: 'No views available.' })}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={onClose}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {t({ it: 'Annulla', en: 'Cancel' })}
                  </button>
                  <button
                    disabled={!selectedId}
                    onClick={() => {
                      if (!selectedId) return;
                      onConfirm(selectedId);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white enabled:hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Star size={16} className="text-amber-300" />
                    {t({ it: 'Imposta predefinita', en: 'Set default' })}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default ChooseDefaultViewModal;
