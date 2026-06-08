import { Fragment, type Dispatch, type SetStateAction } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { DoorOpen, X } from 'lucide-react';
import type { DoorVerificationEntry } from '../../store/types';
import type { ToastTone } from '../../store/useToast';
import CorridorDoorModalPanel from './CorridorDoorModalPanel';

type Translate = (msg: { it: string; en: string }) => string;

export type CorridorDoorState = {
  corridorId: string;
  doorId: string;
  description: string;
  isEmergency: boolean;
  isMainEntrance: boolean;
  isExternal: boolean;
  isFireDoor: boolean;
  lastVerificationAt: string;
  verifierCompany: string;
  verificationHistory: DoorVerificationEntry[];
  mode: 'static' | 'auto_sensor' | 'automated';
  automationUrl: string;
};

export type PlanCorridorDoorModalProps = {
  corridorDoorModal: CorridorDoorState | null;
  setCorridorDoorModal: Dispatch<SetStateAction<CorridorDoorState | null>>;
  saveCorridorDoorModal: () => void;
  push: (message: string, tone?: ToastTone) => void;
  t: Translate;
};

/**
 * Corridor door properties modal (type/flags, automated opening link, panic-door
 * verification panel). Extracted from PlanViewView.tsx.
 */
export const PlanCorridorDoorModal = ({
  corridorDoorModal,
  setCorridorDoorModal,
  saveCorridorDoorModal,
  push,
  t
}: PlanCorridorDoorModalProps) => (
      <Transition show={!!corridorDoorModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setCorridorDoorModal(null)}>
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
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="modal-title">{t({ it: 'Proprietà porta', en: 'Door properties' })}</Dialog.Title>
                    <button
                      onClick={() => setCorridorDoorModal(null)}
                      className="text-slate-500 hover:text-ink"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <Dialog.Description className="mt-2 text-sm text-slate-600">
                    {t({ it: 'Configura tipo e azione della porta selezionata.', en: 'Configure type and action for the selected door.' })}
                  </Dialog.Description>
                  <div className="mt-4 space-y-4">
                    {(() => {
                      const canOpenNow =
                        corridorDoorModal?.mode === 'automated' &&
                        /^https?:\/\//i.test(String(corridorDoorModal?.automationUrl || '').trim());
                      return (
                        <>
                          <label className="text-sm font-semibold text-slate-700">
                            {t({ it: 'Descrizione porta', en: 'Door description' })}
                            <textarea
                              value={corridorDoorModal?.description || ''}
                              onChange={(e) =>
                                setCorridorDoorModal((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        description: e.target.value
                                      }
                                    : prev
                                )
                              }
                              className="mt-1 min-h-[72px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              placeholder={t({ it: 'Es. Porta lato reception', en: 'e.g. Reception-side door' })}
                            />
                          </label>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label
                              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                              title={t({
	                                it: 'Se attivo puoi registrare verifiche e storico porta antipanico.',
	                                en: 'When enabled you can record checks and panic-door history.'
                              })}
                            >
                              <input
                                type="checkbox"
                                checked={!!corridorDoorModal?.isEmergency}
                                onChange={(e) =>
                                  setCorridorDoorModal((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          isEmergency: e.target.checked
                                        }
                                      : prev
                                  )
                                }
                              />
	                              {t({ it: 'Antipanico', en: 'Panic' })}
                            </label>
                            <label
                              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                              title={t({
                                it: 'Segna questa porta come ingresso principale.',
                                en: 'Mark this door as a main entrance.'
                              })}
                            >
                              <input
                                type="checkbox"
                                checked={!!corridorDoorModal?.isMainEntrance}
                                onChange={(e) =>
                                  setCorridorDoorModal((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          isMainEntrance: e.target.checked
                                        }
                                      : prev
                                  )
                                }
                              />
                              {t({ it: 'Ingresso principale', en: 'Main entrance' })}
                            </label>
                            <label
                              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                              title={t({
                                it: "Segna questa porta come esterna (uscita verso l'esterno edificio).",
                                en: 'Mark this door as external (exit to outside of building).'
                              })}
                            >
                              <input
                                type="checkbox"
                                checked={!!corridorDoorModal?.isExternal}
                                onChange={(e) =>
                                  setCorridorDoorModal((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          isExternal: e.target.checked
                                        }
                                      : prev
                                  )
                                }
                              />
                              {t({ it: 'Esterno', en: 'External' })}
                            </label>
                            <label
                              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                              title={t({
                                it: 'Segna la porta come tagliafuoco.',
                                en: 'Mark this door as fire-rated.'
                              })}
                            >
                              <input
                                type="checkbox"
                                checked={!!corridorDoorModal?.isFireDoor}
                                onChange={(e) =>
                                  setCorridorDoorModal((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          isFireDoor: e.target.checked
                                        }
                                      : prev
                                  )
                                }
                              />
                              {t({ it: 'Tagliafuoco', en: 'Fire-rated' })}
                            </label>
                            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                              <input
                                type="checkbox"
                                checked={corridorDoorModal?.mode === 'auto_sensor'}
                                onChange={(e) =>
                                  setCorridorDoorModal((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          mode: e.target.checked ? 'auto_sensor' : 'static'
                                        }
                                      : prev
                                  )
                                }
                              />
                              {t({ it: 'Apertura a rilevazione', en: 'Sensor opening' })}
                            </label>
                            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                              <input
                                type="checkbox"
                                checked={corridorDoorModal?.mode === 'automated'}
                                onChange={(e) =>
                                  setCorridorDoorModal((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          mode: e.target.checked ? 'automated' : 'static'
                                        }
                                      : prev
                                  )
                                }
                              />
                              {t({ it: 'Apertura automatizzata', en: 'Automated opening' })}
                            </label>
                          </div>
                          {corridorDoorModal?.isEmergency ? <CorridorDoorModalPanel {...{ corridorDoorModal, push, setCorridorDoorModal, t }} /> : null}
                          {corridorDoorModal?.mode === 'automated' ? (
                            <>
                              <label className="text-sm font-semibold text-slate-700">
                                {t({ it: 'Link apertura', en: 'Opening link' })}
                                <input
                                  value={corridorDoorModal?.automationUrl || ''}
                                  onChange={(e) =>
                                    setCorridorDoorModal((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            automationUrl: e.target.value
                                          }
                                        : prev
                                    )
                                  }
                                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                  placeholder="https://..."
                                />
                              </label>
                              <div className="text-xs text-slate-500">
                                {t({
                                  it: 'Il link è opzionale. Senza link il pulsante Apri non viene mostrato.',
                                  en: 'The link is optional. Without a link the Open button is hidden.'
                                })}
                              </div>
                            </>
                          ) : (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                              {t({
                                it: 'Attiva la modalità automatizzata per configurare un eventuale link di apertura remota.',
                                en: 'Enable automated mode to optionally configure a remote opening link.'
                              })}
                            </div>
                          )}
                          {canOpenNow ? (
                            <div className="flex items-center justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  const requestUrl = `${String(corridorDoorModal?.automationUrl || '').trim()}${
                                    String(corridorDoorModal?.automationUrl || '').includes('?') ? '&' : '?'
                                  }_plixmap_open_ts=${Date.now()}`;
                                  fetch(requestUrl, {
                                    method: 'GET',
                                    mode: 'no-cors',
                                    cache: 'no-store',
                                    keepalive: true
                                  }).catch(() => {});
                                  push(t({ it: 'Comando apertura porta avviato.', en: 'Door opening command started.' }), 'success');
                                }}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                title={t({ it: 'Apri', en: 'Open' })}
                              >
                                <DoorOpen size={14} />
                                {t({ it: 'Apri', en: 'Open' })}
                              </button>
                            </div>
                          ) : null}
                        </>
                      );
                    })()}
                  </div>
                  <div className="modal-footer">
                    <button
                      onClick={() => setCorridorDoorModal(null)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button onClick={saveCorridorDoorModal} className="btn-primary">
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
