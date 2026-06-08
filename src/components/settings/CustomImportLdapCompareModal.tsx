/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { RefreshCw, UploadCloud, X } from 'lucide-react';
import { humanizeLdapSkipReason } from './CustomImportPanel.helpers';

// LDAP compare/preview modal. Extracted verbatim from CustomImportPanel.
export const CustomImportLdapCompareModal = (props: any) => {
  const {
    ldapCompareOpen,
    ldapCompareDialogFocusRef,
    ldapImporting,
    ldapImportSelectOpen,
    ldapPreviewFetchedAt,
    ldapPreviewLoading,
    ldapPreviewResult,
    openLdapImportSelection,
    runLdapPreview,
    setLdapCompareOpen,
    setLdapImportSelectOpen,
    setLdapSelectedExternalIds,
    t,
  } = props;
  return (
      <Transition show={ldapCompareOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[132]"
          onClose={() => {
            if (ldapImporting || ldapPreviewLoading || ldapImportSelectOpen) return;
            setLdapCompareOpen(false);
          }}
          initialFocus={ldapCompareDialogFocusRef}
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
                <Dialog.Panel className="w-full max-w-6xl modal-panel">
                  <button ref={ldapCompareDialogFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="modal-header">
                    <div>
                      <Dialog.Title className="modal-title">{t({ it: 'Confronto import LDAP', en: 'LDAP import comparison' })}</Dialog.Title>
                      <div className="modal-description">
                        {t({
                          it: 'Confronta gli utenti letti da LDAP con quelli gia presenti nel contenitore locale. Il confronto usa principalmente l’indirizzo email.',
                          en: 'Compare users read from LDAP with those already present in the local container. The comparison primarily uses the email address.'
                        })}
                      </div>
                    </div>
                    <button
                      onClick={() => setLdapCompareOpen(false)}
                      className="icon-button"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                      disabled={ldapImporting || ldapPreviewLoading}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      onClick={runLdapPreview}
                      disabled={ldapPreviewLoading}
                      className="flex items-center gap-2 btn-secondary disabled:opacity-60"
                      title={t({ it: 'Ricarica il confronto LDAP', en: 'Refresh LDAP comparison' })}
                    >
                      <RefreshCw size={16} className={ldapPreviewLoading ? 'animate-spin' : ''} />
                      {ldapPreviewLoading ? t({ it: 'Confronto…', en: 'Comparing…' }) : t({ it: 'Aggiorna confronto', en: 'Refresh comparison' })}
                    </button>
                    <button
                      onClick={openLdapImportSelection}
                      disabled={ldapImporting || !ldapPreviewResult?.importableCount}
                      className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-60"
                      title={
                        ldapPreviewResult?.importableCount
                          ? t({ it: 'Apri la selezione degli utenti LDAP importabili.', en: 'Open the selection of importable LDAP users.' })
                          : t({ it: 'Esegui prima il confronto e assicurati che ci siano utenti importabili.', en: 'Run the comparison first and ensure there are importable users.' })
                      }
                    >
                      <UploadCloud size={16} />
                      {ldapImporting ? t({ it: 'Import…', en: 'Importing…' }) : t({ it: 'Importa', en: 'Import' })}
                    </button>
                    {ldapPreviewResult ? (
                      <div className="ml-auto flex flex-wrap items-center gap-2 text-xs font-semibold">
                        <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-700">
                          {t({ it: 'Letti da LDAP', en: 'Read from LDAP' })}: {ldapPreviewResult.remoteCount}
                        </span>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                          {t({ it: 'Importabili', en: 'Importable' })}: {ldapPreviewResult.importableCount}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
                          {t({ it: 'Gia presenti', en: 'Already present' })}: {ldapPreviewResult.existingCount}
                        </span>
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
                          {t({ it: 'Saltati', en: 'Skipped' })}: {ldapPreviewResult.skippedCount}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    {ldapPreviewLoading
                      ? t({
                          it: 'Confronto LDAP in aggiornamento: i dati precedenti sono stati scartati e stiamo leggendo di nuovo dal server.',
                          en: 'LDAP comparison is refreshing: previous data was discarded and we are reading again from the server.'
                        })
                      : ldapPreviewFetchedAt
                        ? t({
                            it: `Confronto aggiornato alle ${new Date(ldapPreviewFetchedAt).toLocaleString()}.`,
                            en: `Comparison refreshed at ${new Date(ldapPreviewFetchedAt).toLocaleString()}.`
                          })
                        : t({
                            it: 'Nessun confronto LDAP caricato in questa sessione.',
                            en: 'No LDAP comparison loaded in this session.'
                          })}
                  </div>

                  {!ldapPreviewResult && !ldapPreviewLoading ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                      {t({
                        it: 'Apri il confronto per caricare utenti importabili, gia presenti e saltati in una vista separata.',
                        en: 'Open the comparison to load importable, already present, and skipped users in a separate view.'
                      })}
                    </div>
                  ) : null}

                  {ldapPreviewResult ? (
                    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr),minmax(0,1fr),minmax(0,1fr)]">
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="text-xs font-semibold uppercase text-emerald-700">{t({ it: 'Importabili', en: 'Importable' })}</div>
                        <div className="mt-1 text-2xl font-semibold text-emerald-900">{ldapPreviewResult.importableCount}</div>
                        <div className="mt-3 max-h-[50vh] space-y-2 overflow-auto text-sm text-emerald-900">
                          {ldapPreviewResult.importableRows.map((row: any) => (
                            <div key={`ldap-importable-${row.externalId}`} className="rounded-lg border border-emerald-200 bg-white px-3 py-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1 pr-2">
                                  <div className="font-semibold uppercase">{`${row.firstName || ''} ${row.lastName || ''}`.trim() || row.externalId}</div>
                                  <div className="break-all text-xs leading-5 text-emerald-700">{[row.email, row.mobile].filter(Boolean).join(' · ') || row.externalId}</div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLdapSelectedExternalIds([row.externalId]);
                                    setLdapImportSelectOpen(true);
                                  }}
                                  className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                                >
                                  <UploadCloud size={12} />
                                  {t({ it: 'Importa', en: 'Import' })}
                                </button>
                              </div>
                            </div>
                          ))}
                          {!ldapPreviewResult.importableRows.length ? <div className="text-sm text-emerald-700">{t({ it: 'Nessun nuovo utente da importare.', en: 'No new users to import.' })}</div> : null}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs font-semibold uppercase text-slate-600">{t({ it: 'Gia presenti nel contenitore locale', en: 'Already present in local container' })}</div>
                        <div className="mt-1 text-2xl font-semibold text-ink">{ldapPreviewResult.existingCount}</div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {t({
                            it: 'Questi record non arrivano da LDAP: sono utenti gia presenti localmente e abbinati per email.',
                            en: 'These records do not come from LDAP: they are users already present locally and matched by email.'
                          })}
                        </div>
                        <div className="mt-3 max-h-[50vh] space-y-2 overflow-auto text-sm text-slate-700">
                          {ldapPreviewResult.existingRows.map((row: any) => (
                            <div key={`ldap-existing-${row.externalId}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                              <div className="font-semibold uppercase">{`${row.firstName || ''} ${row.lastName || ''}`.trim() || row.externalId}</div>
                              <div className="text-xs text-slate-500">{[row.email, row.mobile].filter(Boolean).join(' · ') || row.externalId}</div>
                            </div>
                          ))}
                          {!ldapPreviewResult.existingRows.length ? <div className="text-sm text-slate-500">{t({ it: 'Nessuna sovrapposizione trovata.', en: 'No overlap found.' })}</div> : null}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <div className="text-xs font-semibold uppercase text-amber-700">{t({ it: 'Saltati', en: 'Skipped' })}</div>
                        <div className="mt-1 text-2xl font-semibold text-amber-900">{ldapPreviewResult.skippedCount}</div>
                        <div className="mt-3 max-h-[50vh] space-y-2 overflow-auto text-sm text-amber-900">
                          {ldapPreviewResult.skippedRows.map((row: any) => (
                            <div key={`ldap-skipped-${row.externalId}-${row.skipReason}`} className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                              <div className="font-semibold uppercase">{`${row.firstName || ''} ${row.lastName || ''}`.trim() || row.externalId}</div>
                              <div className="text-xs text-amber-700">{[row.email, row.mobile].filter(Boolean).join(' · ') || row.externalId}</div>
                              <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">{humanizeLdapSkipReason(row.skipReason, t)}</div>
                            </div>
                          ))}
                          {!ldapPreviewResult.skippedRows.length ? <div className="text-sm text-amber-700">{t({ it: 'Nessun utente saltato.', en: 'No skipped users.' })}</div> : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
  );
};
