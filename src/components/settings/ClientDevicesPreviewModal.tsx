import { type MouseEvent as ReactMouseEvent } from 'react';
import { Plus, RefreshCw, Search, Trash2, UploadCloud, X } from 'lucide-react';
import ModalShell from '../ui/ModalShell';
import {
  type PreviewSide,
  getDisplayDeviceHeading,
  buildDeviceRowTooltip
} from './ClientDevicesImportPanel.helpers';

type Translate = (msg: { it: string; en: string }) => string;

export type ClientDevicesPreviewModalProps = {
  previewOpen: boolean;
  activeClient: any;
  activeClientId: string | null;
  previewError: string | null;
  previewLoading: boolean;
  previewLeftQuery: string;
  previewRightQuery: string;
  previewShowImportedRight: boolean;
  previewLeftRows: any[];
  previewRightRows: any[];
  previewRemoteRows: any[];
  previewExistingRows: any[];
  previewRemoteById: Map<string, any>;
  previewExistingById: Map<string, any>;
  previewSelectedLeftIdSet: Set<string>;
  previewSelectedRightIdSet: Set<string>;
  previewImportingIds: Record<string, boolean>;
  previewDeletingIds: Record<string, boolean>;
  previewSummary: { remove: number; add: number; update: number };
  selectedPreviewImportRows: any[];
  selectedPreviewDeleteRows: any[];
  previewContextMenu: { side: PreviewSide; x: number; y: number } | null;
  previewTooltipLabels: any;
  previewFocusRef: any;
  previewContextMenuFocusRef: any;
  setPreviewOpen: (v: boolean) => void;
  setPreviewLeftQuery: (v: string) => void;
  setPreviewRightQuery: (v: string) => void;
  setPreviewShowImportedRight: (v: boolean) => void;
  setPreviewContextMenu: (v: { side: PreviewSide; x: number; y: number } | null) => void;
  clearPreviewSelection: (side?: PreviewSide) => void;
  runImportMany: (rows: any[]) => void | Promise<void>;
  runImportOne: (row: any) => void | Promise<void>;
  runDeleteMany: (rows: any[]) => void | Promise<void>;
  refreshPreview: (clientId: string) => void | Promise<void>;
  requestPreviewDelete: (...args: any[]) => void;
  openPreviewContextMenu: (side: PreviewSide, event: ReactMouseEvent) => void;
  selectAllPreviewVisible: (side: PreviewSide) => void;
  togglePreviewSelection: (...args: any[]) => void;
  buildUpdateTitle: (row: any) => string;
  t: Translate;
};

/**
 * WebAPI device-import preview modal (dual list: existing devices vs remote
 * import rows, with per-row select/import/delete and a context menu).
 * Extracted from ClientDevicesImportPanel.tsx.
 */
export const ClientDevicesPreviewModal = ({
  previewOpen,
  activeClient,
  activeClientId,
  previewError,
  previewLoading,
  previewLeftQuery,
  previewRightQuery,
  previewShowImportedRight,
  previewLeftRows,
  previewRightRows,
  previewRemoteRows,
  previewExistingRows,
  previewRemoteById,
  previewExistingById,
  previewSelectedLeftIdSet,
  previewSelectedRightIdSet,
  previewImportingIds,
  previewDeletingIds,
  previewSummary,
  selectedPreviewImportRows,
  selectedPreviewDeleteRows,
  previewContextMenu,
  previewTooltipLabels,
  previewFocusRef,
  previewContextMenuFocusRef,
  setPreviewOpen,
  setPreviewLeftQuery,
  setPreviewRightQuery,
  setPreviewShowImportedRight,
  setPreviewContextMenu,
  clearPreviewSelection,
  runImportMany,
  runImportOne,
  runDeleteMany,
  refreshPreview,
  requestPreviewDelete,
  openPreviewContextMenu,
  selectAllPreviewVisible,
  togglePreviewSelection,
  buildUpdateTitle,
  t
}: ClientDevicesPreviewModalProps) => (
      <ModalShell
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={t({ it: 'Importazione WebAPI dispositivi', en: 'WebAPI device import' })}
        description={activeClient ? activeClient.name : ''}
        sizeClassName="max-w-7xl"
        rootClassName="z-[130]"
        backdropClassName="bg-black/35 backdrop-blur-sm"
        initialFocusRef={previewFocusRef as any}
        footer={
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-600">
              {t({ it: 'Selezionati per import', en: 'Selected for import' })}: <span className="font-semibold text-ink">{selectedPreviewImportRows.length}</span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={() => clearPreviewSelection()} className="btn-secondary">
                {t({ it: 'Pulisci selezione', en: 'Clear selection' })}
              </button>
              <button
                type="button"
                onClick={() => void runImportMany(selectedPreviewImportRows)}
                disabled={!selectedPreviewImportRows.length || Object.keys(previewImportingIds).length > 0}
                className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
              >
                <UploadCloud size={16} />
                {t({ it: 'Avvia importazione', en: 'Start import' })}
              </button>
            </div>
          </div>
        }
      >
        <button ref={previewFocusRef} type="button" className="sr-only" tabIndex={0}>focus</button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div className="font-semibold text-ink">
              {t({ it: 'Totali da importazione', en: 'Total from import' })}: {previewRemoteRows.length} · {t({ it: 'Dispositivi esistenti', en: 'Existing devices' })}: {previewExistingRows.length}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span className="text-rose-700">{t({ it: 'Da eliminare', en: 'To delete' })}: {previewSummary.remove}</span>
              <span className="text-emerald-700">{t({ it: 'Da aggiungere', en: 'To add' })}: {previewSummary.add}</span>
              <span className="text-amber-700">{t({ it: 'Da aggiornare', en: 'To update' })}: {previewSummary.update}</span>
            </div>
          </div>
          <button type="button" onClick={() => activeClientId && void refreshPreview(activeClientId)} className="btn-secondary inline-flex items-center gap-2">
            <RefreshCw size={16} className={previewLoading ? 'animate-spin' : ''} />
            {t({ it: 'Ricarica', en: 'Reload' })}
          </button>
        </div>
        {previewError ? <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{previewError}</div> : null}

        <div className="mt-2 text-xs text-slate-500">
          {t({
            it: 'Click per selezione multipla. Tasto destro dentro una lista per selezionare tutti i risultati visibili o pulire la selezione.',
            en: 'Click for multi-select. Right-click inside a list to select all visible results or clear the selection.'
          })}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr),72px,minmax(0,0.9fr)]">
          <div className="rounded-xl border border-slate-200" onContextMenu={(event) => openPreviewContextMenu('left', event)}>
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase text-slate-500">
              <span>{t({ it: 'Dispositivi esistenti', en: 'Existing devices' })}</span>
              <span>{previewExistingRows.length}</span>
            </div>
            <div className="px-3 py-2">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
                <input value={previewLeftQuery} onChange={(e) => setPreviewLeftQuery(e.target.value)} className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm" placeholder={t({ it: 'Cerca dispositivi esistenti...', en: 'Search existing devices...' })} />
              </div>
            </div>
            <div className="max-h-[460px] overflow-auto px-3 pb-3">
              {previewLeftRows.map((row) => {
                const removed = !previewRemoteById.has(String(row.devId)) && row.present;
                const selected = previewSelectedLeftIdSet.has(String(row.devId));
                return (
                  <button
                    key={`prev-left-${row.devId}`}
                    type="button"
                    onClick={(event) => togglePreviewSelection('left', String(row.devId), { shiftKey: event.shiftKey })}
                    title={buildDeviceRowTooltip(
                      row,
                      previewTooltipLabels,
                      removed
                        ? t({ it: 'Rimosso dalla WebAPI', en: 'Removed from WebAPI' })
                        : row.present
                          ? t({ it: 'Nel contenitore locale', en: 'In local container' })
                          : t({ it: 'Mancante', en: 'Missing' })
                    )}
                    className={`mb-2 w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                      selected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : removed
                          ? 'border-rose-200 bg-rose-50'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-ink">{getDisplayDeviceHeading(row)}</div>
                      <div className="truncate text-xs text-slate-500">{row.deviceType || '—'} · {row.manufacturer || '—'} · {row.model || '—'}</div>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{row.present ? t({ it: 'Nel contenitore locale', en: 'In local container' }) : t({ it: 'Mancante', en: 'Missing' })}</span>
                      {removed ? <span className="font-semibold text-rose-700">{t({ it: 'Rimosso dalla WebAPI', en: 'Removed from WebAPI' })}</span> : null}
                    </div>
                  </button>
                );
              })}
              {!previewLeftRows.length ? <div className="py-6 text-center text-sm text-slate-500">{t({ it: 'Nessun dispositivo', en: 'No devices' })}</div> : null}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-2 py-4">
            <button
              type="button"
              onClick={() => void runImportMany(selectedPreviewImportRows)}
              disabled={!selectedPreviewImportRows.length || Object.keys(previewImportingIds).length > 0}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-200 bg-white text-lg font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
              title={t({ it: 'Importa i dispositivi selezionati nel contenitore locale', en: 'Import selected devices into the local container' })}
            >
              {'<<'}
            </button>
          </div>

          <div className="rounded-xl border border-slate-200" onContextMenu={(event) => openPreviewContextMenu('right', event)}>
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase text-slate-500">
              <span>{t({ it: 'Dispositivi trovati dalla WebAPI', en: 'Devices found from WebAPI' })}</span>
              <span>{previewRightRows.length}</span>
            </div>
            <div className="px-3 py-2">
              <label className="mb-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                <input type="checkbox" checked={previewShowImportedRight} onChange={(e) => setPreviewShowImportedRight(e.target.checked)} />
                {t({ it: 'Mostra già importati', en: 'Show already imported' })}
              </label>
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
                <input value={previewRightQuery} onChange={(e) => setPreviewRightQuery(e.target.value)} className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm" placeholder={t({ it: 'Cerca dispositivi WebAPI...', en: 'Search WebAPI devices...' })} />
              </div>
            </div>
            <div className="max-h-[460px] overflow-auto px-2.5 pb-2.5">
              {previewRightRows.map((row) => {
                const importStatus = row.importStatus || 'existing';
                const selected = previewSelectedRightIdSet.has(String(row.devId));
                const importing = !!previewImportingIds[row.devId];
                const deleting = !!previewDeletingIds[row.devId];
                const existingRow = previewExistingById.get(String(row.devId));
                return (
                  <button
                    key={`prev-right-${row.devId}`}
                    type="button"
                    onClick={(event) => togglePreviewSelection('right', String(row.devId), { shiftKey: event.shiftKey })}
                    disabled={importStatus === 'existing'}
                    title={buildDeviceRowTooltip(
                      row,
                      previewTooltipLabels,
                      importStatus === 'existing'
                        ? t({ it: 'Già nel contenitore locale', en: 'Already in local container' })
                        : importStatus === 'update'
                          ? t({ it: 'Differenze rilevate', en: 'Changes detected' })
                          : t({ it: 'Pronto per import', en: 'Ready to import' })
                    )}
                    className={`mb-2 w-full rounded-lg border px-2.5 py-2 text-left text-sm transition ${
                      importStatus === 'existing'
                        ? 'cursor-default border-sky-200 bg-sky-50'
                        : selected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-ink">{getDisplayDeviceHeading(row)}</div>
                        <div className="truncate text-[11px] text-slate-500">{row.deviceType || '—'} · {row.manufacturer || '—'} · {row.model || '—'}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
                        {importStatus === 'new' ? (
                          <>
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              {t({ it: 'NEW', en: 'NEW' })}
                            </span>
                            <button
                              type="button"
                              disabled={importing}
                              onClick={() => void runImportOne(row)}
                              className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-2 text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                              title={t({ it: 'Importa questo dispositivo', en: 'Import this device' })}
                            >
                              <Plus size={13} />
                            </button>
                          </>
                        ) : importStatus === 'update' ? (
                          <button
                            type="button"
                            disabled={importing}
                            onClick={() => void runImportOne(row)}
                            className="inline-flex h-7 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                            title={buildUpdateTitle(row)}
                          >
                            {t({ it: 'UPDATE', en: 'UPDATE' })}
                          </button>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            {t({ it: 'OK', en: 'OK' })}
                          </span>
                        )}
                        {existingRow ? (
                          <button
                            type="button"
                            disabled={deleting}
                            onClick={() => requestPreviewDelete([String(row.devId)])}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                            title={t({ it: 'Rimuovi dal contenitore locale', en: 'Remove from local container' })}
                          >
                            <Trash2 size={13} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{importStatus === 'existing' ? t({ it: 'Già importato', en: 'Already imported' }) : t({ it: 'Pronto per import', en: 'Ready to import' })}</span>
                      {importStatus === 'existing' ? (
                        <span className="text-sky-700">{t({ it: 'Già nel contenitore', en: 'Already in container' })}</span>
                      ) : importStatus === 'update' ? (
                        <span className="text-amber-700">{t({ it: 'Differenze rilevate', en: 'Changes detected' })}</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
              {!previewRightRows.length ? <div className="py-6 text-center text-sm text-slate-500">{t({ it: 'Nessun dispositivo', en: 'No devices' })}</div> : null}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr),72px,minmax(0,0.9fr)]">
          <div className="flex flex-wrap items-center gap-2 pl-1">
            {selectedPreviewDeleteRows.length ? (
              <button
                type="button"
                onClick={() => void runDeleteMany(selectedPreviewDeleteRows.map((row) => row.devId))}
                disabled={Object.keys(previewDeletingIds).length > 0}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                title={t({ it: 'Rimuovi i dispositivi selezionati dal contenitore locale', en: 'Remove selected devices from the local container' })}
              >
                <X size={16} />
              </button>
            ) : null}
            <div className="text-sm text-slate-600">
              {t({ it: 'Selezionati per rimozione', en: 'Selected for removal' })}: <span className="font-semibold text-ink">{selectedPreviewDeleteRows.length}</span>
            </div>
          </div>
          <div />
          <div />
        </div>

        {previewContextMenu ? (
          <div
            className="fixed z-[135] min-w-[220px] rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
            style={{ left: previewContextMenu.x, top: previewContextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              ref={previewContextMenuFocusRef}
              type="button"
              onClick={() => {
                selectAllPreviewVisible(previewContextMenu.side);
                setPreviewContextMenu(null);
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <span>{t({ it: 'Seleziona tutto', en: 'Select all' })}</span>
              <span className="font-mono text-xs text-slate-400">
                {previewContextMenu.side === 'left' ? previewLeftRows.length : previewRightRows.filter((row) => row.importStatus !== 'existing').length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                clearPreviewSelection(previewContextMenu.side);
                setPreviewContextMenu(null);
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <span>{t({ it: 'Deseleziona tutto', en: 'Deselect all' })}</span>
              <span className="font-mono text-xs text-slate-400">
                {previewContextMenu.side === 'left' ? selectedPreviewDeleteRows.length : selectedPreviewImportRows.length}
              </span>
            </button>
          </div>
        ) : null}
      </ModalShell>
);
