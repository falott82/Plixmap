/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Pencil, X } from 'lucide-react';
import { humanizeLdapImportField, getLdapImportMissingFields } from './CustomImportPanel.helpers';

// LDAP importable-users selection modal. Extracted from CustomImportPanel.
export const CustomImportLdapImportSelectModal = (props: any) => {
  const {
    ldapImportSelectOpen,
    clearLdapImportSelection,
    ldapImporting,
    ldapImportRowsWithDrafts,
    ldapImportSelectDialogFocusRef,
    ldapPreviewResult,
    ldapSelectedExternalIdSet,
    ldapSelectedImportableCount,
    openLdapImportEditModal,
    runLdapImport,
    selectAllLdapImportRows,
    toggleLdapImportSelection,
    setLdapImportSelectOpen,
    t,
  } = props;
  return (
      <Transition show={ldapImportSelectOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[133]"
          onClose={() => {
            if (ldapImporting) return;
            setLdapImportSelectOpen(false);
          }}
          initialFocus={ldapImportSelectDialogFocusRef}
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
                  <button ref={ldapImportSelectDialogFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="modal-header">
                    <div>
                      <Dialog.Title className="modal-title">{t({ it: 'Seleziona utenti LDAP da importare', en: 'Select LDAP users to import' })}</Dialog.Title>
                      <div className="modal-description">
                        {t({
                          it: 'Scegli solo gli utenti importabili che vuoi importare nel contenitore locale. Il backend ricontrolla comunque il dataset LDAP prima di scrivere.',
                          en: 'Choose only the importable users you want to import into the local container. The backend still rechecks the LDAP dataset before writing.'
                        })}
                      </div>
                    </div>
                    <button
                      onClick={() => setLdapImportSelectOpen(false)}
                      className="icon-button"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                      disabled={ldapImporting}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={selectAllLdapImportRows} className="btn-secondary">
                      {t({ it: 'Seleziona tutti', en: 'Select all' })}
                    </button>
                    <button type="button" onClick={clearLdapImportSelection} className="btn-secondary">
                      {t({ it: 'Deseleziona tutti', en: 'Clear all' })}
                    </button>
                    <div className="ml-auto rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
                      {t({
                        it: `${ldapSelectedImportableCount} selezionati su ${(ldapPreviewResult?.importableRows || []).length}`,
                        en: `${ldapSelectedImportableCount} selected out of ${(ldapPreviewResult?.importableRows || []).length}`
                      })}
                    </div>
                  </div>

                  <div className="mt-4 max-h-[60vh] space-y-2 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    {ldapImportRowsWithDrafts.map((row: any) => {
                      const checked = ldapSelectedExternalIdSet.has(row.externalId);
                      const missingFields = getLdapImportMissingFields(row);
                      return (
                        <div
                          key={`ldap-import-select-${row.externalId}`}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 ${checked ? 'border-primary/30 bg-primary/5' : 'border-slate-200 bg-white'}`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                            checked={checked}
                            onChange={() => toggleLdapImportSelection(row.externalId)}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold uppercase text-ink">
                              {`${row.firstName || ''} ${row.lastName || ''}`.trim() || row.externalId}
                            </div>
                            <div className="truncate text-xs text-slate-500">{[row.email, row.mobile].filter(Boolean).join(' · ') || row.externalId}</div>
                            <div className="mt-1 truncate text-[11px] uppercase text-slate-500">
                              {[row.role, row.dept1, row.dept2, row.dept3].filter(Boolean).join(' · ') || row.externalId}
                            </div>
                            {missingFields.length ? (
                              <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                                {t({ it: 'Campi mancanti', en: 'Missing fields' })}: {missingFields.map((field: any) => humanizeLdapImportField(field, t)).join(', ')}
                              </div>
                            ) : null}
                          </div>
                          <div className="shrink-0">
                            <button
                              type="button"
                              onClick={() => openLdapImportEditModal(row)}
                              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${missingFields.length ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                            >
                              <Pencil size={14} />
                              {missingFields.length ? t({ it: 'Completa dati', en: 'Complete data' }) : t({ it: 'Modifica', en: 'Edit' })}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {!ldapImportRowsWithDrafts.length ? (
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                        {t({ it: 'Nessun utente LDAP disponibile per importazione.', en: 'No LDAP users available for import.' })}
                      </div>
                    ) : null}
                  </div>

                  <div className="modal-footer">
                    <button type="button" onClick={() => setLdapImportSelectOpen(false)} className="btn-secondary" disabled={ldapImporting}>
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      type="button"
                      onClick={runLdapImport}
                      disabled={ldapImporting || !ldapSelectedImportableCount}
                      className="btn-primary disabled:opacity-60"
                      title={
                        ldapSelectedImportableCount
                          ? t({ it: 'Importa solo gli utenti LDAP selezionati.', en: 'Import only the selected LDAP users.' })
                          : t({ it: 'Seleziona almeno un utente da importare.', en: 'Select at least one user to import.' })
                      }
                    >
                      {ldapImporting ? t({ it: 'Import…', en: 'Importing…' }) : t({ it: 'Importa selezionati', en: 'Import selected' })}
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
