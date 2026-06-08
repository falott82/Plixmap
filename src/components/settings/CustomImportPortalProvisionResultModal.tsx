/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Copy, X } from 'lucide-react';
import { humanizeProvisionMailReason } from './CustomImportPanel.helpers';

// Portal-provisioning result modal (generated credentials display + copy).
// Extracted from CustomImportPanel.
export const CustomImportPortalProvisionResultModal = (props: any) => {
  const {
    portalProvisionResult,
    portalProvisionResultFocusRef,
    copyPortalProvisionSecret,
    setPortalProvisionResult,
    t,
  } = props;
  return (
      <Transition show={!!portalProvisionResult} as={Fragment}>
        <Dialog as="div" className="relative z-[145]" initialFocus={portalProvisionResultFocusRef} onClose={() => setPortalProvisionResult(null)}>
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
                <Dialog.Panel className="w-full max-w-2xl modal-panel">
                  <button ref={portalProvisionResultFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="modal-header">
                    <div>
                      <Dialog.Title className="modal-title">{t({ it: 'Credenziali temporanee generate', en: 'Temporary credentials generated' })}</Dialog.Title>
                      <div className="modal-description">{portalProvisionResult?.importedDisplayName || ''}</div>
                    </div>
                    <button onClick={() => setPortalProvisionResult(null)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Username', en: 'Username' })}</div>
                      <div className="mt-1 text-base font-semibold text-ink">{portalProvisionResult?.username}</div>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                      <div className="text-xs font-semibold uppercase text-amber-700">{t({ it: 'Password temporanea', en: 'Temporary password' })}</div>
                      <div className="mt-1 break-all font-mono text-base font-semibold text-amber-900">{portalProvisionResult?.temporaryPassword}</div>
                      <div className="mt-1 text-xs text-amber-800">
                        {t({
                          it: 'Visibile solo ora. Al primo accesso l’utente dovra cambiarla obbligatoriamente.',
                          en: 'Visible only now. On first login the user will be forced to change it.'
                        })}
                      </div>
                    </div>
                    <div
                      className={`rounded-xl border px-3 py-3 text-sm ${
                        portalProvisionResult?.emailDelivery.sent
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : portalProvisionResult?.emailDelivery.attempted
                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      {portalProvisionResult?.emailDelivery.sent
                        ? t({ it: 'Le credenziali sono state inviate via email.', en: 'Credentials were sent by email.' })
                        : portalProvisionResult?.emailDelivery.attempted
                          ? t({
                              it: `Utente creato, ma l’invio email non e riuscito (${humanizeProvisionMailReason(String(portalProvisionResult.emailDelivery.reason || ''), t)}).`,
                              en: `User created, but email delivery failed (${humanizeProvisionMailReason(String(portalProvisionResult.emailDelivery.reason || ''), t)}).`
                            })
                          : t({ it: 'Invio email non richiesto.', en: 'Email delivery not requested.' })}
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button type="button" onClick={() => void copyPortalProvisionSecret('password')} className="btn-secondary inline-flex items-center gap-2">
                      <Copy size={14} />
                      {t({ it: 'Copia password', en: 'Copy password' })}
                    </button>
                    <button type="button" onClick={() => void copyPortalProvisionSecret('credentials')} className="btn-primary inline-flex items-center gap-2">
                      <Copy size={14} />
                      {t({ it: 'Copia credenziali', en: 'Copy credentials' })}
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
