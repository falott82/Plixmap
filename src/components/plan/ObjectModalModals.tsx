import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ArrowUpDown, Plus, Search, Trash2, X } from 'lucide-react';
import { formatBytes, uploadLimits, uploadMimes } from '../../utils/files';
import type { SecurityDocsSortKey } from './ObjectModal.helpers';
/* eslint-disable @typescript-eslint/no-explicit-any */
// Security-documents / security-history / wifi-catalog modals extracted verbatim from
// ObjectModal to keep it under 2k lines. Render-only; deps via props.

export const SecurityDocumentsModal = (props: any) => {
  const { addSecurityDocumentDraft, getDocumentStatus, handleAttachSecurityDocument, isSecurityType, readOnly, removeSecurityDocument, securityDocDraft, securityDocsCloseRef, securityDocsFirstFieldRef, securityDocsHideExpired, securityDocsSearch, securityDocsSort, securityDocumentsOpen, securityDocumentsRows, securityError, setSecurityDocDraft, setSecurityDocsHideExpired, setSecurityDocsSearch, setSecurityDocumentsOpen, t, toggleSecurityDocsSort, toggleSecurityDocumentValidity, open } = props;
  const getDocumentStatusMeta = (doc: { archived?: boolean; validUntil?: string }) => {
    const status = getDocumentStatus(doc);
    if (status === 'archived') {
      return {
        status,
        label: t({ it: 'Archivio', en: 'Archived' }),
        className: 'border-slate-300 bg-slate-200 text-slate-700'
      };
    }
    if (status === 'expired') {
      return {
        status,
        label: t({ it: 'Scaduto', en: 'Expired' }),
        className: 'border-rose-200 bg-rose-100 text-rose-700'
      };
    }
    if (status === 'warning') {
      return {
        status,
        label: t({ it: 'In scadenza', en: 'Expiring soon' }),
        className: 'border-amber-200 bg-amber-100 text-amber-800'
      };
    }
    if (status === 'ok') {
      return {
        status,
        label: t({ it: 'Valido', en: 'Valid' }),
        className: 'border-emerald-200 bg-emerald-100 text-emerald-700'
      };
    }
    return {
      status,
      label: t({ it: 'Senza scadenza', en: 'No expiry' }),
      className: 'border-slate-200 bg-slate-100 text-slate-700'
    };
  };
  return (
      <Transition show={open && isSecurityType && securityDocumentsOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[60]" initialFocus={securityDocsCloseRef} onClose={() => setSecurityDocumentsOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
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
                <Dialog.Panel className="w-full max-w-6xl modal-panel" onMouseDown={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="modal-title">{t({ it: 'Documenti sicurezza', en: 'Safety documents' })}</Dialog.Title>
                    <button
                      ref={securityDocsCloseRef}
                      onClick={() => setSecurityDocumentsOpen(false)}
                      className="text-slate-500 hover:text-ink"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.4fr]">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t({ it: 'Nuovo documento', en: 'New document' })}
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input
                          ref={securityDocsFirstFieldRef}
                          value={securityDocDraft.name}
                          disabled={readOnly}
                          onChange={(e) => setSecurityDocDraft((prev: any) => ({ ...prev, name: e.target.value }))}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2 sm:col-span-2"
                          placeholder={t({ it: 'Nome documento*', en: 'Document name*' })}
                        />
                        <label className="text-xs font-medium text-slate-600">
                          {t({ it: 'Scadenza documento', en: 'Document expiry' })}
                          <input
                            type="date"
                            value={securityDocDraft.validUntil}
                            disabled={readOnly}
                            onChange={(e) => setSecurityDocDraft((prev: any) => ({ ...prev, validUntil: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          />
                        </label>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {t({ it: 'Validità', en: 'Validity' })}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={!securityDocDraft.archived}
                              disabled={readOnly}
                              onClick={() => setSecurityDocDraft((prev: any) => ({ ...prev, archived: !prev.archived }))}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                                !securityDocDraft.archived ? 'bg-emerald-500' : 'bg-slate-400'
                              } disabled:cursor-not-allowed disabled:opacity-60`}
                            >
                              <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                                  !securityDocDraft.archived ? 'translate-x-5' : 'translate-x-1'
                                }`}
                              />
                            </button>
                            <span className={`text-xs font-semibold ${!securityDocDraft.archived ? 'text-emerald-700' : 'text-slate-600'}`}>
                              {!securityDocDraft.archived
                                ? t({ it: 'Valido', en: 'Valid' })
                                : t({ it: 'Archiviato', en: 'Archived' })}
                            </span>
                          </div>
                        </div>
                        <textarea
                          value={securityDocDraft.notes}
                          disabled={readOnly}
                          onChange={(e) => setSecurityDocDraft((prev: any) => ({ ...prev, notes: e.target.value }))}
                          className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          rows={3}
                          placeholder={t({ it: 'Note documento', en: 'Document notes' })}
                        />
                        <label
                          className={`relative inline-flex items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold ${
                            readOnly
                              ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                              : 'cursor-pointer border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {securityDocDraft.fileName
                            ? t({ it: `File: ${securityDocDraft.fileName}`, en: `File: ${securityDocDraft.fileName}` })
                            : t({ it: 'Carica PDF', en: 'Upload PDF' })}
                          <input
                            type="file"
                            accept={uploadMimes.pdf.join(',')}
                            disabled={readOnly}
                            onChange={(e) => {
                              void handleAttachSecurityDocument(e.target.files);
                              e.currentTarget.value = '';
                            }}
                            className="absolute inset-0 cursor-pointer opacity-0"
                          />
                        </label>
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={addSecurityDocumentDraft}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Plus size={14} />
                          {t({ it: 'Aggiungi documento', en: 'Add document' })}
                        </button>
                      </div>
                      <div className="mt-2 text-[11px] text-slate-500">
                        {t({
                          it: `Formato accettato: PDF (max ${formatBytes(uploadLimits.pdfBytes)}).`,
                          en: `Accepted format: PDF (max ${formatBytes(uploadLimits.pdfBytes)}).`
                        })}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t({ it: 'Tabella documenti', en: 'Documents table' })}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <label className="relative min-w-[220px] flex-1">
                          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            value={securityDocsSearch}
                            onChange={(e) => setSecurityDocsSearch(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-xs outline-none ring-primary/30 focus:ring-2"
                            placeholder={t({ it: 'Cerca documento...', en: 'Search document...' })}
                          />
                        </label>
                        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
                          <input
                            type="checkbox"
                            checked={securityDocsHideExpired}
                            onChange={(e) => setSecurityDocsHideExpired(e.target.checked)}
                          />
                          {t({ it: 'Nascondi scaduti', en: 'Hide expired' })}
                        </label>
                      </div>
                      <div className="mt-2 max-h-[52vh] overflow-auto rounded-lg border border-slate-200">
                        <table className="w-full text-left text-xs">
                          <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                            <tr>
                              {([
                                ['name', t({ it: 'Nome', en: 'Name' })],
                                ['uploadedAt', t({ it: 'Upload', en: 'Upload' })],
                                ['validUntil', t({ it: 'Scadenza', en: 'Expiry' })],
                                ['status', t({ it: 'Stato', en: 'Status' })]
                              ] as Array<[SecurityDocsSortKey, string]>).map(([key, label]) => (
                                <th key={key} className="px-2 py-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleSecurityDocsSort(key)}
                                    className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
                                  >
                                    {label}
                                    <ArrowUpDown size={12} className={securityDocsSort.key === key ? 'text-primary' : 'text-slate-400'} />
                                  </button>
                                </th>
                              ))}
                              <th className="px-2 py-2">{t({ it: 'Validità', en: 'Validity' })}</th>
                              <th className="px-2 py-2">{t({ it: 'Azioni', en: 'Actions' })}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {securityDocumentsRows.length ? (
                              securityDocumentsRows.map((doc: any) => {
                                const statusMeta = getDocumentStatusMeta(doc);
                                return (
                                  <tr key={doc.id} className={`border-t border-slate-100 ${doc.archived ? 'bg-slate-100 text-slate-500' : ''}`}>
                                    <td className="px-2 py-2">
                                      <div className="font-semibold text-slate-800">{doc.name}</div>
                                      <div className="text-[11px] text-slate-500">{doc.fileName || 'PDF'}</div>
                                    </td>
                                    <td className="px-2 py-2 text-slate-600">
                                      {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : '—'}
                                    </td>
                                    <td className="px-2 py-2 text-slate-700">{doc.validUntil || '—'}</td>
                                    <td className="px-2 py-2">
                                      <span className={`inline-flex rounded-full border px-2 py-0.5 font-semibold ${statusMeta.className}`}>
                                        {statusMeta.label}
                                      </span>
                                    </td>
                                    <td className="px-2 py-2">
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          role="switch"
                                          aria-checked={!doc.archived}
                                          disabled={readOnly}
                                          onClick={() => toggleSecurityDocumentValidity(doc.id, !!doc.archived)}
                                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                                            !doc.archived ? 'bg-emerald-500' : 'bg-slate-400'
                                          } disabled:cursor-not-allowed disabled:opacity-60`}
                                        >
                                          <span
                                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                                              !doc.archived ? 'translate-x-5' : 'translate-x-1'
                                            }`}
                                          />
                                        </button>
                                        <span className={`text-[11px] font-semibold ${!doc.archived ? 'text-emerald-700' : 'text-slate-600'}`}>
                                          {!doc.archived ? t({ it: 'Valido', en: 'Valid' }) : t({ it: 'Archiviato', en: 'Archived' })}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-2 py-2">
                                      {!readOnly ? (
                                        <button
                                          type="button"
                                          onClick={() => removeSecurityDocument(doc.id)}
                                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                          title={t({ it: 'Rimuovi', en: 'Remove' })}
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      ) : (
                                        '—'
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                                  {t({ it: 'Nessun documento trovato con i filtri correnti.', en: 'No documents found with current filters.' })}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  {securityError ? (
                    <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">{securityError}</div>
                  ) : null}
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => setSecurityDocumentsOpen(false)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
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

export const SecurityHistoryModal = (props: any) => {
  const { addSecurityCheckDraft, isSecurityType, readOnly, removeSecurityCheck, securityCheckDraft, securityCheckHistory, securityHistoryCloseRef, securityHistoryFirstFieldRef, securityHistoryOpen, setSecurityCheckDraft, setSecurityHistoryOpen, t, open } = props;
  return (
      <Transition show={open && isSecurityType && securityHistoryOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[60]" initialFocus={securityHistoryCloseRef} onClose={() => setSecurityHistoryOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
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
                <Dialog.Panel className="w-full max-w-5xl modal-panel" onMouseDown={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="modal-title">{t({ it: 'Storico modifiche/verifiche', en: 'Checks/changes history' })}</Dialog.Title>
                    <button
                      ref={securityHistoryCloseRef}
                      onClick={() => setSecurityHistoryOpen(false)}
                      className="text-slate-500 hover:text-ink"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t({ it: 'Nuova voce', en: 'New entry' })}
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <label className="text-xs font-medium text-slate-600">
                          {t({ it: 'Data verifica', en: 'Check date' })}
                          <input
                            ref={securityHistoryFirstFieldRef}
                            type="date"
                            value={securityCheckDraft.date}
                            disabled={readOnly}
                            onChange={(e) => setSecurityCheckDraft((prev: any) => ({ ...prev, date: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          />
                        </label>
                        <label className="text-xs font-medium text-slate-600">
                          {t({ it: 'Azienda', en: 'Company' })}
                          <input
                            value={securityCheckDraft.company}
                            disabled={readOnly}
                            onChange={(e) => setSecurityCheckDraft((prev: any) => ({ ...prev, company: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            placeholder={t({ it: 'Azienda', en: 'Company' })}
                          />
                        </label>
                        <textarea
                          value={securityCheckDraft.notes}
                          disabled={readOnly}
                          onChange={(e) => setSecurityCheckDraft((prev: any) => ({ ...prev, notes: e.target.value }))}
                          className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          rows={3}
                          placeholder={t({ it: 'Note verifica', en: 'Check notes' })}
                        />
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={addSecurityCheckDraft}
                          className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-lg border border-primary bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Plus size={14} />
                          {t({ it: 'Aggiungi verifica', en: 'Add check' })}
                        </button>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t({ it: 'Storico', en: 'History' })}
                      </div>
                      <div className="mt-2 max-h-[52vh] overflow-auto rounded-lg border border-slate-200">
                        <table className="w-full text-left text-xs">
                          <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-2 py-2">{t({ it: 'Data', en: 'Date' })}</th>
                              <th className="px-2 py-2">{t({ it: 'Azienda', en: 'Company' })}</th>
                              <th className="px-2 py-2">{t({ it: 'Note', en: 'Notes' })}</th>
                              <th className="px-2 py-2">{t({ it: 'Creato', en: 'Created' })}</th>
                              <th className="px-2 py-2">{t({ it: 'Stato', en: 'Status' })}</th>
                              <th className="px-2 py-2">{t({ it: 'Azioni', en: 'Actions' })}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {securityCheckHistory.length ? (
                              securityCheckHistory
                                .slice()
                                .sort((a: any, b: any) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
                                .map((entry: any) => (
                                  <tr key={entry.id} className="border-t border-slate-100">
                                    <td className="px-2 py-2 text-slate-700">{entry.date || '—'}</td>
                                    <td className="px-2 py-2 text-slate-700">{entry.company || '—'}</td>
                                    <td className="px-2 py-2 text-slate-600">{entry.notes || '—'}</td>
                                    <td className="px-2 py-2 text-slate-500">
                                      {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : '—'}
                                    </td>
                                    <td className="px-2 py-2">
                                      <span
                                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                          entry.archived === false
                                            ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                                            : 'border-slate-300 bg-slate-200 text-slate-700'
                                        }`}
                                      >
                                        {entry.archived === false
                                          ? t({ it: 'Attiva', en: 'Active' })
                                          : t({ it: 'Archiviata', en: 'Archived' })}
                                      </span>
                                    </td>
                                    <td className="px-2 py-2">
                                      {!readOnly ? (
                                        <button
                                          type="button"
                                          onClick={() => removeSecurityCheck(entry.id)}
                                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                          title={t({ it: 'Rimuovi', en: 'Remove' })}
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      ) : (
                                        '—'
                                      )}
                                    </td>
                                  </tr>
                                ))
                            ) : (
                              <tr>
                                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                                  {t({ it: 'Nessuna verifica registrata.', en: 'No checks registered.' })}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => setSecurityHistoryOpen(false)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
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

export const WifiCatalogSearchModal = (props: any) => {
  const { closeWifiCatalogSearch, filteredWifiCatalogModels, focusWifiSearch, handleSearchDialogClose, handleSelectCatalogModel, moveWifiCatalogSelection, selectedWifiCatalogModel, setWifiCatalogQuery, setWifiCatalogSelectedId, t, wifiCatalogQuery, wifiCatalogRowsRef, wifiCatalogSearchOpen, wifiCatalogSearchRef, wifiCatalogSelectedId, open } = props;
  return (
      <Transition
        show={open && wifiCatalogSearchOpen}
        as={Fragment}
        afterEnter={focusWifiSearch}
      >
        <Dialog
          as="div"
          className="relative z-[60]"
          initialFocus={wifiCatalogSearchRef}
          onClose={handleSearchDialogClose}
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
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
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
                <Dialog.Panel
                  className="w-full max-w-4xl modal-panel"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="modal-title">
                      {t({ it: 'Cerca nel catalogo', en: 'Search catalog' })}
                    </Dialog.Title>
                    <button
                      onClick={closeWifiCatalogSearch}
                      className="text-slate-500 hover:text-ink"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-4">
                    <input
                      ref={wifiCatalogSearchRef}
                      autoFocus
                      value={wifiCatalogQuery}
                      onChange={(e) => setWifiCatalogQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          closeWifiCatalogSearch();
                          return;
                        }
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          moveWifiCatalogSelection(1);
                          return;
                        }
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          moveWifiCatalogSelection(-1);
                          return;
                        }
                        if (e.key === 'Enter') {
                          if (selectedWifiCatalogModel) {
                            e.preventDefault();
                            handleSelectCatalogModel(selectedWifiCatalogModel);
                          } else if (filteredWifiCatalogModels.length) {
                            e.preventDefault();
                            handleSelectCatalogModel(filteredWifiCatalogModels[0]);
                          }
                        }
                      }}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({
                        it: 'Cerca per marca, modello o codice...',
                        en: 'Search by brand, model, or code...'
                      })}
                    />
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {t({
                      it: 'Usa su/giu e Invio per selezionare (o doppio click).',
                      en: 'Use up/down and Enter to select (or double click).'
                    })}
                  </div>
                  <div className="mt-4 max-h-[50vh] overflow-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-2">{t({ it: 'Marca', en: 'Brand' })}</th>
                          <th className="px-3 py-2">{t({ it: 'Modello', en: 'Model' })}</th>
                          <th className="px-3 py-2">{t({ it: 'Codice', en: 'Code' })}</th>
                          <th className="px-3 py-2">{t({ it: 'Standard', en: 'Standard' })}</th>
                          <th className="px-3 py-2">2.4</th>
                          <th className="px-3 py-2">5</th>
                          <th className="px-3 py-2">6</th>
                          <th className="px-3 py-2">{t({ it: 'Copertura', en: 'Coverage' })}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredWifiCatalogModels.map((model: any) => {
                          const isSelected = wifiCatalogSelectedId === model.id;
                          return (
                            <tr
                              key={model.id}
                              ref={(el) => {
                                wifiCatalogRowsRef.current[model.id] = el;
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={() => setWifiCatalogSelectedId(model.id)}
                              onDoubleClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleSelectCatalogModel(model);
                              }}
                              aria-selected={isSelected}
                              className={`cursor-pointer border-t border-slate-100 ${isSelected ? 'bg-sky-100' : 'hover:bg-slate-50'}`}
                            >
                              <td className="px-3 py-2 text-slate-700">{model.brand}</td>
                              <td className="px-3 py-2 text-slate-700">{model.model}</td>
                              <td className="px-3 py-2 text-slate-600">{model.modelCode}</td>
                              <td className="px-3 py-2 text-slate-600">{model.standard}</td>
                              <td className="px-3 py-2 text-slate-600">{model.band24 ? t({ it: 'Si', en: 'Yes' }) : t({ it: 'No', en: 'No' })}</td>
                              <td className="px-3 py-2 text-slate-600">{model.band5 ? t({ it: 'Si', en: 'Yes' }) : t({ it: 'No', en: 'No' })}</td>
                              <td className="px-3 py-2 text-slate-600">{model.band6 ? t({ it: 'Si', en: 'Yes' }) : t({ it: 'No', en: 'No' })}</td>
                              <td className="px-3 py-2 text-slate-600">{model.coverageSqm}</td>
                            </tr>
                          );
                        })}
                        {!filteredWifiCatalogModels.length ? (
                          <tr>
                            <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-500">
                              {t({ it: 'Nessun risultato nel catalogo.', en: 'No results in catalog.' })}
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span>{t({ it: 'Seleziona con Invio o "Seleziona".', en: 'Select with Enter or "Select".' })}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (!selectedWifiCatalogModel && filteredWifiCatalogModels.length) {
                            handleSelectCatalogModel(filteredWifiCatalogModels[0]);
                            return;
                          }
                          if (selectedWifiCatalogModel) handleSelectCatalogModel(selectedWifiCatalogModel);
                        }}
                        disabled={!selectedWifiCatalogModel && !filteredWifiCatalogModels.length}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                          selectedWifiCatalogModel || filteredWifiCatalogModels.length
                            ? 'border-primary bg-primary/10 text-primary hover:bg-primary/20'
                            : 'border-slate-200 bg-white text-slate-400'
                        }`}
                      >
                        {t({ it: 'Seleziona', en: 'Select' })}
                      </button>
                      <button
                        onClick={closeWifiCatalogSearch}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        {t({ it: 'Chiudi', en: 'Close' })}
                      </button>
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
