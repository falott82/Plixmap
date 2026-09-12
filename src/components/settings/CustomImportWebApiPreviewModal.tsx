/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ArrowUpCircle, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';

// WebAPI device/user import preview modal (dual list + variation table).
// Extracted verbatim from CustomImportPanel; receives state/handlers via props.
export const CustomImportWebApiPreviewModal = (props: any) => {
  const {
    webApiPreviewOpen,
    activeClient,
    activeClientId,
    applySelectedWebApiVariations,
    clearWebApiPreviewSelection,
    deleteSingleImportedUser,
    handleWebApiPreviewRowMouseDown,
    importSingleWebApiUser,
    openWebApiPreviewContextMenu,
    openWebApiPreviewRowContextMenu,
    previewSummaryCounts,
    refreshWebApiPreview,
    selectAllWebApiPreviewRows,
    t,
    webApiPreviewContextMenu,
    webApiPreviewContextMenuFocusRef,
    webApiPreviewContextMenuRef,
    webApiPreviewDeletingIds,
    webApiPreviewDialogFocusRef,
    webApiPreviewError,
    webApiPreviewExistingFiltered,
    webApiPreviewExistingRows,
    webApiPreviewFilter,
    webApiPreviewImportingIds,
    webApiPreviewLeftQuery,
    webApiPreviewLoading,
    webApiPreviewRemoteById,
    webApiPreviewRemoteRows,
    webApiPreviewRightQuery,
    webApiPreviewSelectedAddRows,
    webApiPreviewSelectedDeleteRows,
    webApiPreviewSelectedLeftIdSet,
    webApiPreviewSelectedRightIdSet,
    webApiPreviewSelectedUpdateRows,
    webApiPreviewSelectedVariationRows,
    webApiVariationRows,
    setWebApiPreviewFilter,
    setWebApiPreviewLeftQuery,
    setWebApiPreviewOpen,
    setWebApiPreviewRightQuery,
  } = props;
  return (
      <Transition show={webApiPreviewOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[130]"
          onClose={() => setWebApiPreviewOpen(false)}
          initialFocus={webApiPreviewDialogFocusRef}
        >
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-6xl modal-panel">
                  <button ref={webApiPreviewDialogFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="modal-header">
                    <div>
                      <Dialog.Title className="modal-title">{t({ it: 'Importazione WebAPI', en: 'WebAPI import' })}</Dialog.Title>
                      <div className="modal-description">{activeClient ? activeClient.name : ''}</div>
                    </div>
                    <button type="button" onClick={() => activeClientId && refreshWebApiPreview(activeClientId)} className="btn-secondary inline-flex items-center gap-2">
                      <RefreshCw size={16} className={webApiPreviewLoading ? 'animate-spin' : ''} />
                      {t({ it: 'Ricarica', en: 'Reload' })}
                    </button>
                  </div>
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="font-semibold text-ink">
                        {t({ it: 'Totali da importazione', en: 'Total from import' })}: {webApiPreviewRemoteRows.length} · {t({ it: 'Utenti esistenti', en: 'Existing users' })}: {webApiPreviewExistingRows.length}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => setWebApiPreviewFilter('remove')}
                          className={`rounded-full border px-3 py-1 ${webApiPreviewFilter === 'remove' ? 'border-rose-300 bg-rose-100 text-rose-700' : 'border-rose-200 bg-white text-rose-700 hover:bg-rose-50'}`}
                        >
                          {t({ it: 'Da eliminare', en: 'To delete' })}: {previewSummaryCounts.remove}
                        </button>
                        <button
                          type="button"
                          onClick={() => setWebApiPreviewFilter('update')}
                          className={`rounded-full border px-3 py-1 ${webApiPreviewFilter === 'update' ? 'border-amber-300 bg-amber-100 text-amber-700' : 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50'}`}
                        >
                          {t({ it: 'Da aggiornare', en: 'To update' })}: {previewSummaryCounts.update}
                        </button>
                        <button
                          type="button"
                          onClick={() => setWebApiPreviewFilter('add')}
                          className={`rounded-full border px-3 py-1 ${webApiPreviewFilter === 'add' ? 'border-emerald-300 bg-emerald-100 text-emerald-700' : 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'}`}
                        >
                          {t({ it: 'Da aggiungere', en: 'To add' })}: {previewSummaryCounts.add}
                        </button>
                        <button
                          type="button"
                          onClick={() => setWebApiPreviewFilter('all')}
                          className={`rounded-full border px-3 py-1 ${webApiPreviewFilter === 'all' ? 'border-slate-300 bg-slate-200 text-slate-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                        >
                          {t({ it: 'Tutti', en: 'All' })}
                        </button>
                      </div>
                    </div>
                  </div>
                  {webApiPreviewError ? <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{webApiPreviewError}</div> : null}
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="overflow-hidden rounded-2xl border border-slate-200" onContextMenu={(event) => openWebApiPreviewContextMenu('left', event)}>
                      <div className="flex items-center justify-between bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-600">
                        <span>{t({ it: 'Utenti esistenti', en: 'Existing users' })}</span>
                        <span className="text-slate-500">{webApiPreviewExistingFiltered.length}</span>
                      </div>
                      <div className="border-b border-slate-200 bg-white px-3 py-2">
                        <div className="relative">
                          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            value={webApiPreviewLeftQuery}
                            onChange={(e) => setWebApiPreviewLeftQuery(e.target.value)}
                            className="h-9 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-sm outline-none focus:border-primary"
                            placeholder={t({ it: 'Cerca utenti esistenti…', en: 'Search existing users…' })}
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="max-h-[420px] overflow-auto">
                        {!webApiPreviewExistingFiltered.length && !webApiPreviewLoading ? <div className="px-4 py-4 text-sm text-slate-500">{t({ it: 'Nessun utente esistente.', en: 'No existing users.' })}</div> : null}
                        {webApiPreviewExistingFiltered.map((r: any, rowIndex: number) => {
                          const name = `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.email || r.externalId;
                          const isMissingFromImport = !webApiPreviewRemoteById.has(String(r.externalId));
                          return (
                            <div
                              key={`existing:${r.externalId}`}
                              onMouseDown={(event) => handleWebApiPreviewRowMouseDown('left', String(r.externalId), rowIndex, event)}
                              onContextMenu={(event) => openWebApiPreviewRowContextMenu('left', String(r.externalId), rowIndex, event)}
                              className={`cursor-pointer select-none border-t border-slate-100 px-4 py-3 text-sm ${webApiPreviewSelectedLeftIdSet.has(String(r.externalId)) ? 'bg-primary/20 ring-1 ring-primary/30' : 'bg-white hover:bg-slate-50'}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="truncate font-semibold text-ink">{name}</div>
                                    {isMissingFromImport ? (
                                      <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                                        {t({ it: 'Rimosso dalla WebAPI', en: 'Removed from WebAPI' })}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="truncate text-xs text-slate-500">{[r.email, r.mobile].filter(Boolean).join(' · ') || '—'}</div>
                                  <div className="truncate text-[11px] text-slate-500">{[r.role, r.dept1, r.dept2, r.dept3].filter(Boolean).join(' · ') || '—'}</div>
                                </div>
                                <div />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-slate-200" onContextMenu={(event) => openWebApiPreviewContextMenu('right', event)}>
                      <div className="flex items-center justify-between bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-600">
                        <span>{t({ it: 'Variazioni da importazione', en: 'Import variations' })}</span>
                        <span className="text-slate-500">{webApiVariationRows.length}</span>
                      </div>
                      <div className="border-b border-slate-200 bg-white px-3 py-2">
                        <div className="relative">
                          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            value={webApiPreviewRightQuery}
                            onChange={(e) => setWebApiPreviewRightQuery(e.target.value)}
                            className="h-9 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-sm outline-none focus:border-primary"
                            placeholder={t({ it: 'Cerca variazioni…', en: 'Search variations…' })}
                          />
                        </div>
                      </div>
                      <div className="max-h-[420px] overflow-auto">
                        {webApiPreviewLoading ? <div className="px-4 py-4 text-sm text-slate-500">{t({ it: 'Ricerca in corso…', en: 'Searching…' })}</div> : null}
                        {!webApiPreviewLoading && !webApiVariationRows.length ? <div className="px-4 py-4 text-sm text-slate-500">{t({ it: 'Nessuna variazione rilevata.', en: 'No variations detected.' })}</div> : null}
                        {webApiVariationRows.map((r: any, rowIndex: number) => {
                          const name = `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.email || r.externalId;
                          const variationType = String(r.variationType || '');
                          const isAdd = variationType === 'add';
                          const isUpdate = variationType === 'update';
                          const tagClass = isAdd ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : isUpdate ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-rose-200 bg-rose-50 text-rose-700';
                          return (
                            <div
                              key={`remote:${r.externalId}`}
                              onMouseDown={(event) => handleWebApiPreviewRowMouseDown('right', String(r.externalId), rowIndex, event)}
                              onContextMenu={(event) => openWebApiPreviewRowContextMenu('right', String(r.externalId), rowIndex, event)}
                              className={`cursor-pointer select-none border-t border-slate-100 px-4 py-3 text-sm ${webApiPreviewSelectedRightIdSet.has(String(r.externalId)) ? 'bg-primary/20 ring-1 ring-primary/30' : 'bg-white hover:bg-slate-50'}`}
                            >
                              <div className="flex items-start gap-2">
                                {isAdd || isUpdate ? (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void importSingleWebApiUser(r);
                                    }}
                                    disabled={!!webApiPreviewImportingIds[r.externalId]}
                                    className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 disabled:opacity-40"
                                    title={isAdd ? t({ it: 'Aggiungi utente', en: 'Add user' }) : t({ it: 'Aggiorna utente esistente', en: 'Update existing user' })}
                                  >
                                    {isAdd ? <Plus size={14} className={webApiPreviewImportingIds[r.externalId] ? 'animate-pulse' : ''} /> : <ArrowUpCircle size={14} className={webApiPreviewImportingIds[r.externalId] ? 'animate-pulse' : ''} />}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void deleteSingleImportedUser(r.externalId);
                                    }}
                                    disabled={!!webApiPreviewDeletingIds[r.externalId]}
                                    className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-40"
                                    title={t({ it: 'Elimina dal contenitore utenti', en: 'Delete from users container' })}
                                  >
                                    <Trash2 size={14} className={webApiPreviewDeletingIds[r.externalId] ? 'animate-pulse' : ''} />
                                  </button>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="truncate font-semibold text-ink">{name}</div>
                                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tagClass}`}>
                                      {isAdd ? t({ it: 'Da aggiungere', en: 'To add' }) : isUpdate ? t({ it: 'Da aggiornare', en: 'To update' }) : t({ it: 'Da eliminare', en: 'To delete' })}
                                    </span>
                                  </div>
                                  <div className="truncate text-xs text-slate-500">{[r.email, r.mobile].filter(Boolean).join(' · ') || '—'}</div>
                                  <div className="truncate text-[11px] text-slate-500">{[r.role, r.dept1, r.dept2, r.dept3].filter(Boolean).join(' · ') || '—'}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  {webApiPreviewContextMenu ? (
                    <div
                      ref={webApiPreviewContextMenuRef}
                      className="fixed z-[140] min-w-[200px] rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
                      style={{ left: webApiPreviewContextMenu.x, top: webApiPreviewContextMenu.y }}
                    >
                      <button ref={webApiPreviewContextMenuFocusRef} type="button" className="sr-only" tabIndex={0}>focus</button>
                      <button type="button" onClick={() => selectAllWebApiPreviewRows(webApiPreviewContextMenu.side)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                        {t({ it: 'Seleziona tutto', en: 'Select all' })}
                      </button>
                      <button type="button" onClick={() => clearWebApiPreviewSelection(webApiPreviewContextMenu.side)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                        {t({ it: 'Deseleziona tutto', en: 'Deselect all' })}
                      </button>
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                      <span>{t({ it: 'Selezionati', en: 'Selected' })}: <span className="font-semibold text-ink">{webApiPreviewSelectedVariationRows.length}</span></span>
                      <span className="text-emerald-700">{t({ it: 'Add', en: 'Add' })}: {webApiPreviewSelectedAddRows.length}</span>
                      <span className="text-amber-700">{t({ it: 'Update', en: 'Update' })}: {webApiPreviewSelectedUpdateRows.length}</span>
                      <span className="text-rose-700">{t({ it: 'Delete', en: 'Delete' })}: {webApiPreviewSelectedDeleteRows.length}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void applySelectedWebApiVariations()}
                        disabled={
                          !webApiPreviewSelectedVariationRows.length ||
                          Object.keys(webApiPreviewImportingIds).length > 0 ||
                          Object.keys(webApiPreviewDeletingIds).length > 0
                        }
                        className="btn-secondary disabled:opacity-50"
                      >
                        {t({ it: 'Apply selected', en: 'Apply selected' })}
                      </button>
                      <button onClick={() => setWebApiPreviewOpen(false)} className="btn-secondary">{t({ it: 'Chiudi', en: 'Close' })}</button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
  );
};
