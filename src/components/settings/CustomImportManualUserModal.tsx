/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';

// Manual (non-imported) user create/edit modal. Extracted from CustomImportPanel.
export const CustomImportManualUserModal = (props: any) => {
  const {
    manualUserModalOpen,
    activeClient,
    activeClientId,
    manualUserDialogFocusRef,
    manualUserEditingId,
    manualUserEditingKind,
    manualUserForm,
    manualUserSaving,
    saveManualUser,
    setManualUserForm,
    setManualUserModalOpen,
    t,
  } = props;
  return (
      <Transition show={manualUserModalOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[140]"
          initialFocus={manualUserDialogFocusRef}
          onClose={() => {
            if (manualUserSaving) return;
            setManualUserModalOpen(false);
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
                <Dialog.Panel className="w-full max-w-4xl modal-panel">
                  <button ref={manualUserDialogFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="modal-header">
                    <div>
                      <Dialog.Title className="modal-title">
                        {manualUserEditingId
                          ? manualUserEditingKind === 'imported'
                            ? t({ it: 'Modifica utente importato', en: 'Edit imported user' })
                            : t({ it: 'Modifica utente manuale', en: 'Edit manual user' })
                          : t({ it: 'Nuovo utente manuale', en: 'New manual user' })}
                      </Dialog.Title>
                      <div className="modal-description">
                        {manualUserEditingId && manualUserEditingKind === 'imported'
                          ? t({
                              it: `Stai modificando un utente importato già presente nel contenitore locale di ${activeClient ? activeClient.name : ''}. Questa modifica è locale: un futuro reimport da LDAP/WebAPI/CSV può sovrascriverla.`,
                              en: `You are editing an imported user already present in the local container of ${activeClient ? activeClient.name : ''}. This is a local edit: a future LDAP/WebAPI/CSV reimport may overwrite it.`
                            })
                          : activeClient
                            ? activeClient.name
                            : ''}
                      </div>
                    </div>
                    <button onClick={() => setManualUserModalOpen(false)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {[
                      { key: 'externalId', label: 'External ID', placeholder: 'manual:...' },
                      { key: 'firstName', label: t({ it: 'Nome', en: 'First name' }), placeholder: 'Mario' },
                      { key: 'lastName', label: t({ it: 'Cognome', en: 'Last name' }), placeholder: 'Rossi' },
                      { key: 'email', label: 'Email', placeholder: 'mario.rossi@example.com' },
                      { key: 'mobile', label: t({ it: 'Cellulare', en: 'Mobile' }), placeholder: '+39...' },
                      { key: 'role', label: t({ it: 'Ruolo', en: 'Role' }), placeholder: t({ it: 'Tecnico', en: 'Technician' }) },
                      { key: 'dept1', label: 'Reparto 1', placeholder: 'IT' },
                      { key: 'dept2', label: 'Reparto 2', placeholder: '' },
                      { key: 'dept3', label: 'Reparto 3', placeholder: '' },
                      { key: 'ext1', label: 'Interno 1', placeholder: '' },
                      { key: 'ext2', label: 'Interno 2', placeholder: '' },
                      { key: 'ext3', label: 'Interno 3', placeholder: '' }
                    ].map((field) => (
                      <label key={field.key} className="block text-sm font-medium text-slate-700">
                        {field.label}
                        <input
                          value={(manualUserForm as any)[field.key] || ''}
                          onChange={(e) => setManualUserForm((prev: any) => ({ ...prev, [field.key]: e.target.value }))}
                          disabled={field.key === 'externalId' && !!manualUserEditingId}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary disabled:bg-slate-50 disabled:text-slate-500"
                          placeholder={field.placeholder}
                          title={
                            field.key === 'externalId'
                              ? t({ it: 'Identificativo tecnico del record nel contenitore locale. In modifica non è editabile per evitare di rompere i collegamenti esistenti.', en: 'Technical identifier of the record in the local container. In edit mode it is locked to avoid breaking existing links.' })
                              : t({ it: `Campo ${field.label}. Il valore viene salvato nel contenitore locale del cliente.`, en: `${field.label} field. The value is saved in the client local container.` })
                          }
                        />
                      </label>
                    ))}
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={manualUserForm.isExternal}
                        onChange={(e) => setManualUserForm((prev: any) => ({ ...prev, isExternal: e.target.checked }))}
                      />
                      {t({ it: 'Utente esterno', en: 'External user' })}
                    </label>
                    <div className="mt-1 text-xs text-slate-500">
                      {(manualUserEditingId && manualUserEditingKind === 'imported')
                        ? t({
                            it: 'Stai modificando un record importato. Il record resta collegato al suo external ID originale e può essere aggiornato di nuovo da una futura sincronizzazione della sorgente.',
                            en: 'You are editing an imported record. The record stays linked to its original external ID and may be updated again by a future source synchronization.'
                          })
                        : t({
                            it: 'Puoi lasciare vuoto External ID in creazione: verrà generato automaticamente con prefisso manual:.',
                            en: 'You can leave External ID empty on creation: it will be generated automatically with manual: prefix.'
                          })}
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button
                      type="button"
                      onClick={() => setManualUserModalOpen(false)}
                      className="btn-secondary"
                      disabled={manualUserSaving}
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      type="button"
                      onClick={saveManualUser}
                      disabled={manualUserSaving || !activeClientId}
                      className="btn-primary disabled:opacity-60"
                      title={
                        manualUserEditingId
                          ? manualUserEditingKind === 'imported'
                            ? t({ it: 'Salva le modifiche locali su questo utente importato nel contenitore del cliente.', en: 'Save the local changes for this imported user in the client container.' })
                            : t({ it: 'Salva le modifiche su questo utente manuale.', en: 'Save the changes for this manual user.' })
                          : t({ it: 'Crea un nuovo utente manuale nel contenitore del cliente.', en: 'Create a new manual user in the client container.' })
                      }
                    >
                      {manualUserSaving ? t({ it: 'Salvataggio…', en: 'Saving…' }) : t({ it: 'Salva', en: 'Save' })}
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
