import { Fragment, useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Check, X } from 'lucide-react';
import { useT } from '../../i18n/useT';

interface Props {
  open: boolean;
  planName: string;
  hasObjects: boolean;
  onClose: () => void;
  onConfirm: (options: { carryObjects: boolean }) => void;
}

const ReplacePlanImageModal = ({ open, planName, hasObjects, onClose, onConfirm }: Props) => {
  const t = useT();
  const [carryObjects, setCarryObjects] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCarryObjects(false);
  }, [open]);

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
              <Dialog.Panel className="w-full max-w-lg modal-panel">
                <div className="modal-header items-center">
                  <Dialog.Title className="modal-title">
                    {t({ it: 'Aggiorna planimetria', en: 'Update floor plan' })}
                  </Dialog.Title>
                  <button onClick={onClose} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>

                <Dialog.Description className="modal-description">
                  {t({ it: 'Stai aggiornando l’immagine di', en: 'You are updating the image for' })}{' '}
                  <span className="font-semibold text-ink">{planName}</span>.{' '}
                  {t({ it: 'La planimetria precedente verrà archiviata come revisione.', en: 'The previous floor plan will be archived as a revision.' })}
                </Dialog.Description>

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  {hasObjects ? (
                    <>
                      <div className="font-semibold text-ink">{t({ it: 'Oggetti esistenti', en: 'Existing objects' })}</div>
                      <div className="mt-1 text-slate-600">
                        {t({
                          it: 'Puoi scegliere se riportare gli oggetti nella nuova planimetria. In tal caso resteranno con le stesse coordinate e dovrai eventualmente risistemarli.',
                          en: 'You can choose whether to carry objects into the new floor plan. If you do, they keep the same coordinates and you may need to reposition them.'
                        })}
                      </div>
                      <label className="mt-3 flex items-start gap-2 font-semibold">
                        <input
                          type="checkbox"
                          checked={carryObjects}
                          onChange={(e) => setCarryObjects(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary"
                        />
                        <span>{t({ it: 'Riporta gli oggetti nella nuova planimetria', en: 'Carry objects into the new floor plan' })}</span>
                      </label>
                      {!carryObjects ? (
                        <div className="mt-2 text-rose-700">
                          {t({
                            it: 'Gli oggetti verranno rimossi nella nuova versione e dovranno essere reinseriti.',
                            en: 'Objects will be removed in the new version and must be re-added.'
                          })}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="text-slate-600">
                      {t({
                        it: 'Nessun oggetto presente: la nuova planimetria verrà applicata senza ulteriori modifiche.',
                        en: 'No objects present: the new floor plan will be applied without further changes.'
                      })}
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  <button
                    onClick={onClose}
                    className="btn-secondary"
                    title={t({ it: 'Chiudi senza cambiare immagine', en: 'Close without changing image' })}
                  >
                    {t({ it: 'Annulla', en: 'Cancel' })}
                  </button>
                  <button
                    onClick={() => {
                      onConfirm({ carryObjects });
                      onClose();
                    }}
                    className="inline-flex items-center gap-2 btn-primary"
                    title={t({ it: 'Conferma sostituzione planimetria', en: 'Confirm floor plan replacement' })}
                  >
                    <Check size={16} />
                    {t({ it: 'Conferma', en: 'Confirm' })}
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

export default ReplacePlanImageModal;
