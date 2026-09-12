import { Fragment, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';

type Translate = (msg: { it: string; en: string }) => string;

export type SidebarSiteSupportContactsModalProps = {
  siteSupportContactsModal: any;
  setSiteSupportContactsModal: Dispatch<SetStateAction<any>>;
  siteSupportContactsFocusRef: MutableRefObject<any>;
  updateSite: (...args: any[]) => any;
  t: Translate;
};

/**
 * Site support-contacts editor modal (cleaning/IT/coffee service contacts),
 * extracted from SidebarTree.tsx.
 */
export const SidebarSiteSupportContactsModal = ({
  siteSupportContactsModal,
  setSiteSupportContactsModal,
  siteSupportContactsFocusRef,
  updateSite,
  t
}: SidebarSiteSupportContactsModalProps) => {
  return (
          <Transition show={!!siteSupportContactsModal} as={Fragment}>
            <Dialog
              as="div"
              className="relative z-[90]"
              onClose={() => setSiteSupportContactsModal(null)}
              initialFocus={siteSupportContactsFocusRef}
            >
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm" />
              </Transition.Child>
              <div className="fixed inset-0 overflow-y-auto p-4">
                <div className="flex min-h-full items-center justify-center">
                  <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-150"
                    enterFrom="opacity-0 scale-95"
                    enterTo="opacity-100 scale-100"
                    leave="ease-in duration-100"
                    leaveFrom="opacity-100 scale-100"
                    leaveTo="opacity-0 scale-95"
                  >
                    <Dialog.Panel className="w-full max-w-[68rem] rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                        <div>
                          <Dialog.Title className="text-lg font-semibold text-ink">
                            {t({ it: 'Contatti utili sede', en: 'Site useful contacts' })}
                          </Dialog.Title>
                          <div className="text-xs text-slate-500">
                            {`${siteSupportContactsModal?.clientName || '-'} • ${siteSupportContactsModal?.siteName || '-'}`}
                          </div>
                        </div>
                        <button
                          ref={siteSupportContactsFocusRef}
                          type="button"
                          onClick={() => setSiteSupportContactsModal(null)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                          title={t({ it: 'Chiudi', en: 'Close' })}
                        >
                          <X size={18} />
                        </button>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        {[
                          { key: 'cleaning', label: t({ it: 'Cleaning service', en: 'Cleaning service' }), contact: siteSupportContactsModal?.supportContacts?.cleaning },
                          { key: 'it', label: t({ it: 'IT Service', en: 'IT Service' }), contact: siteSupportContactsModal?.supportContacts?.it },
                          { key: 'coffee', label: t({ it: 'Coffee service', en: 'Coffee service' }), contact: siteSupportContactsModal?.supportContacts?.coffee }
                        ].map((row) => (
                          <div key={row.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="text-sm font-semibold text-slate-700">{row.label}</div>
                            <div className="mt-2 space-y-2">
                              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                                <div className="font-semibold text-slate-500">Email</div>
                                <input
                                  type="email"
                                  value={String(row.contact?.email || '')}
                                  onChange={(e) =>
                                    setSiteSupportContactsModal((prev: any) =>
                                      !prev
                                        ? prev
                                        : {
                                            ...prev,
                                            supportContacts: {
                                              ...(prev.supportContacts || {}),
                                              [row.key]: {
                                                ...((prev.supportContacts as any)?.[row.key] || {}),
                                                email: e.target.value
                                              }
                                            }
                                          }
                                    )
                                  }
                                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-primary"
                                  placeholder="email@example.com"
                                />
                              </div>
                              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                                <div className="font-semibold text-slate-500">{t({ it: 'Telefono', en: 'Phone' })}</div>
                                <input
                                  type="text"
                                  value={String(row.contact?.phone || '')}
                                  onChange={(e) =>
                                    setSiteSupportContactsModal((prev: any) =>
                                      !prev
                                        ? prev
                                        : {
                                            ...prev,
                                            supportContacts: {
                                              ...(prev.supportContacts || {}),
                                              [row.key]: {
                                                ...((prev.supportContacts as any)?.[row.key] || {}),
                                                phone: e.target.value
                                              }
                                            }
                                          }
                                    )
                                  }
                                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-primary"
                                  placeholder="+39..."
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!siteSupportContactsModal) return;
                            updateSite(siteSupportContactsModal.siteId, {
                              supportContacts: siteSupportContactsModal.supportContacts || {}
                            } as any);
                            setSiteSupportContactsModal(null);
                          }}
                          className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
                          title={t({ it: 'Salva contatti utili', en: 'Save support contacts' })}
                        >
                          {t({ it: 'Salva', en: 'Save' })}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSiteSupportContactsModal(null)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {t({ it: 'Chiudi', en: 'Close' })}
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
