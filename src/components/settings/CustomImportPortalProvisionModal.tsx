/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Mail, UserPlus, X } from 'lucide-react';

// Portal-account provisioning modal for an imported user. Extracted from CustomImportPanel.
export const CustomImportPortalProvisionModal = (props: any) => {
  const {
    portalProvisionModalOpen,
    portalProvisionDialogFocusRef,
    portalProvisionForm,
    portalProvisionSaving,
    portalProvisionSourceUser,
    submitPortalProvision,
    setPortalProvisionForm,
    setPortalProvisionModalOpen,
    t,
  } = props;
  return (
      <Transition show={portalProvisionModalOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[140]"
          initialFocus={portalProvisionDialogFocusRef}
          onClose={() => {
            if (portalProvisionSaving) return;
            setPortalProvisionModalOpen(false);
          }}
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
                <Dialog.Panel className="w-full max-w-3xl modal-panel">
                  <button ref={portalProvisionDialogFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="modal-header">
                    <div>
                      <Dialog.Title className="modal-title">{t({ it: 'Crea utente portale', en: 'Create portal user' })}</Dialog.Title>
                      <div className="modal-description">
                        {portalProvisionSourceUser
                          ? `${String(portalProvisionSourceUser.firstName || '').trim()} ${String(portalProvisionSourceUser.lastName || '').trim()}`.trim() ||
                            portalProvisionSourceUser.email ||
                            portalProvisionSourceUser.externalId
                          : ''}
                      </div>
                    </div>
                    <button onClick={() => setPortalProvisionModalOpen(false)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Username', en: 'Username' })}
                      <input
                        value={portalProvisionForm.username}
                        onChange={(e) => setPortalProvisionForm((prev: any) => ({ ...prev, username: e.target.value.toLowerCase() }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                        placeholder="mario.rossi"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Lingua iniziale', en: 'Initial language' })}
                      <select
                        value={portalProvisionForm.language}
                        onChange={(e) => setPortalProvisionForm((prev: any) => ({ ...prev, language: e.target.value === 'en' ? 'en' : 'it' }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                      >
                        <option value="it">Italiano</option>
                        <option value="en">English</option>
                      </select>
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Nome', en: 'First name' })}
                      <input
                        value={portalProvisionForm.firstName}
                        onChange={(e) => setPortalProvisionForm((prev: any) => ({ ...prev, firstName: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Cognome', en: 'Last name' })}
                      <input
                        value={portalProvisionForm.lastName}
                        onChange={(e) => setPortalProvisionForm((prev: any) => ({ ...prev, lastName: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Email
                      <input
                        value={portalProvisionForm.email}
                        onChange={(e) => setPortalProvisionForm((prev: any) => ({ ...prev, email: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Telefono', en: 'Phone' })}
                      <input
                        value={portalProvisionForm.phone}
                        onChange={(e) => setPortalProvisionForm((prev: any) => ({ ...prev, phone: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Accesso sul cliente', en: 'Client access' })}
                      <select
                        value={portalProvisionForm.access}
                        onChange={(e) => setPortalProvisionForm((prev: any) => ({ ...prev, access: e.target.value === 'rw' ? 'rw' : 'ro' }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                      >
                        <option value="ro">{t({ it: 'Sola lettura', en: 'Read only' })}</option>
                        <option value="rw">{t({ it: 'Lettura / scrittura', en: 'Read / write' })}</option>
                      </select>
                    </label>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                      <div className="font-semibold text-slate-800">{t({ it: 'Provisioning automatico', en: 'Automatic provisioning' })}</div>
                      <div className="mt-1 text-xs text-slate-600">
                        {t({
                          it: 'La password temporanea viene generata dal server, mostrata una sola volta e l’utente sara obbligato a cambiarla al primo login.',
                          en: 'The temporary password is generated server-side, shown only once, and the user will be forced to change it on first login.'
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2">
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-ink">
                      <input
                        type="checkbox"
                        checked={portalProvisionForm.chat}
                        onChange={(e) => setPortalProvisionForm((prev: any) => ({ ...prev, chat: e.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      {t({ it: 'Abilita chat sul cliente', en: 'Enable client chat' })}
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-ink">
                      <input
                        type="checkbox"
                        checked={portalProvisionForm.canCreateMeetings}
                        onChange={(e) => setPortalProvisionForm((prev: any) => ({ ...prev, canCreateMeetings: e.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      {t({ it: 'Puo creare meeting in autonomia', en: 'Can create meetings autonomously' })}
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-ink">
                      <input
                        type="checkbox"
                        checked={portalProvisionForm.sendEmail}
                        disabled={!String(portalProvisionForm.email || '').trim()}
                        onChange={(e) => setPortalProvisionForm((prev: any) => ({ ...prev, sendEmail: e.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      <Mail size={15} />
                      {t({ it: 'Invia credenziali via email', en: 'Send credentials by email' })}
                    </label>
                    <div className="text-xs text-slate-500">
                      {t({
                        it: 'Se configurato, verra usato prima l’SMTP del cliente e in fallback quello globale del portale.',
                        en: 'If configured, the client SMTP is used first, then the global portal SMTP as fallback.'
                      })}
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button
                      type="button"
                      onClick={() => setPortalProvisionModalOpen(false)}
                      className="btn-secondary"
                      disabled={portalProvisionSaving}
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      type="button"
                      onClick={() => void submitPortalProvision()}
                      className="btn-primary inline-flex items-center gap-2"
                      disabled={portalProvisionSaving}
                    >
                      <UserPlus size={15} />
                      {portalProvisionSaving ? t({ it: 'Creazione…', en: 'Creating…' }) : t({ it: 'Crea utente', en: 'Create user' })}
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
