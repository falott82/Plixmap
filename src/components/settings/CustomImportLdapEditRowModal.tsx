/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { normalizeImportEmailInput, normalizeImportMobileInput, normalizeUpperInput } from './CustomImportPanel.helpers';

// LDAP import row edit modal (complete missing fields before import).
// Extracted from CustomImportPanel.
export const CustomImportLdapEditRowModal = (props: any) => {
  const {
    ldapImportEditRowId,
    ldapImportEditDialogFocusRef,
    ldapImportEditForm,
    ldapImporting,
    saveLdapImportEdit,
    setLdapImportEditForm,
    setLdapImportEditRowId,
    t,
  } = props;
  return (
      <Transition show={!!ldapImportEditRowId} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[134]"
          onClose={() => {
            if (ldapImporting) return;
            setLdapImportEditRowId(null);
          }}
          initialFocus={ldapImportEditDialogFocusRef}
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
                  <button ref={ldapImportEditDialogFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="modal-header">
                    <div>
                      <Dialog.Title className="modal-title">{t({ it: 'Completa dati utente LDAP', en: 'Complete LDAP user data' })}</Dialog.Title>
                      <div className="modal-description">
                        {t({
                          it: 'Questi valori vengono applicati solo all’import corrente dei record selezionati.',
                          en: 'These values are applied only to the current import of the selected records.'
                        })}
                      </div>
                    </div>
                    <button onClick={() => setLdapImportEditRowId(null)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {[
                      { key: 'firstName', label: t({ it: 'Nome', en: 'First name' }), placeholder: 'MARIO' },
                      { key: 'lastName', label: t({ it: 'Cognome', en: 'Last name' }), placeholder: 'ROSSI' },
                      { key: 'email', label: 'Email', placeholder: 'mario.rossi@example.com' },
                      { key: 'mobile', label: t({ it: 'Cellulare', en: 'Mobile' }), placeholder: '+39...' },
                      { key: 'role', label: t({ it: 'Ruolo', en: 'Role' }), placeholder: 'TECNICO' },
                      { key: 'dept1', label: 'Reparto 1', placeholder: 'IT' },
                      { key: 'dept2', label: 'Reparto 2', placeholder: '' },
                      { key: 'dept3', label: 'Reparto 3', placeholder: '' }
                    ].map((field: any) => (
                      <label key={field.key} className="block text-sm font-medium text-slate-700">
                        {field.label}
                        <input
                          value={(ldapImportEditForm as Record<string, string>)[field.key] || ''}
                          onChange={(e) =>
                            setLdapImportEditForm((prev: any) => ({
                              ...prev,
                              [field.key]:
                                field.key === 'email'
                                  ? normalizeImportEmailInput(e.target.value)
                                  : field.key === 'mobile'
                                    ? normalizeImportMobileInput(e.target.value)
                                    : normalizeUpperInput(e.target.value)
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                          placeholder={field.placeholder}
                        />
                      </label>
                    ))}
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    {t({
                      it: 'Nome, cognome, ruolo e reparti vengono salvati in maiuscolo. Email viene normalizzata in minuscolo, telefono senza spazi.',
                      en: 'First name, last name, role, and departments are stored in uppercase. Email is normalized to lowercase, phone without spaces.'
                    })}
                  </div>

                  <div className="modal-footer">
                    <button type="button" onClick={() => setLdapImportEditRowId(null)} className="btn-secondary">
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button type="button" onClick={saveLdapImportEdit} className="btn-primary">
                      {t({ it: 'Salva dati', en: 'Save data' })}
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
