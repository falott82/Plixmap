import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Check, Filter, RefreshCw, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ExternalUserRow, listExternalUsers } from '../../api/customImport';
import { useT } from '../../i18n/useT';

interface Props {
  open: boolean;
  clientId: string;
  clientName?: string;
  assignedCounts?: Map<string, number>;
  onClose: () => void;
  onSelect: (user: ExternalUserRow) => void;
}

const RealUserPickerModal = ({ open, clientId, clientName, assignedCounts, onClose, onSelect }: Props) => {
  const t = useT();
  const [q, setQ] = useState('');
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ExternalUserRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [responseClientName, setResponseClientName] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);
  const tRef = useRef(t);
  const navigate = useNavigate();

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const load = useCallback(
    async () => {
      if (!clientId) {
        setRows([]);
        setLoadError(tRef.current({ it: 'Cliente non disponibile.', en: 'Client not available.' }));
        return;
      }
      setLoading(true);
      setLoadError(null);
      try {
        const res = await listExternalUsers({ clientId, includeMissing: true, includeHidden: true });
        setRows(res.rows || []);
        setResponseClientName(res.clientName || null);
        setLastLoadedAt(Date.now());
      } catch {
        setRows([]);
        setLoadError(tRef.current({ it: 'Caricamento non riuscito.', en: 'Failed to load users.' }));
      } finally {
        setLoading(false);
      }
    },
    [clientId]
  );

  useEffect(() => {
    if (!open) return;
    setQ('');
    setOnlyUnassigned(false);
    setShowHidden(false);
    setShowMissing(false);
    setSelectedId('');
    setLoadError(null);
    setLastLoadedAt(null);
    setResponseClientName(null);
    load();
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }, [clientId, load, open]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = rows;
    if (!showHidden) list = list.filter((r) => !r.hidden);
    if (!showMissing) list = list.filter((r) => r.present);
    if (onlyUnassigned) {
      list = list.filter((r) => (assignedCounts?.get(`${r.clientId}:${r.externalId}`) || 0) === 0);
    }
    if (!query) return list;
    return list.filter((r) => {
      const hay = `${r.externalId} ${r.firstName} ${r.lastName} ${r.role} ${r.dept1} ${r.dept2} ${r.dept3} ${r.email} ${r.mobile}`.toLowerCase();
      return hay.includes(query);
    });
  }, [assignedCounts, onlyUnassigned, q, rows, showHidden, showMissing]);

  const selectedIndex = useMemo(() => filtered.findIndex((r) => r.externalId === selectedId), [filtered, selectedId]);
  const selected = useMemo(() => (selectedIndex >= 0 ? filtered[selectedIndex] : null), [filtered, selectedIndex]);
  const resolvedClientName = clientName || responseClientName || clientId;
  const visibleCount = filtered.length;
  const totalCount = rows.length;
  const missingCount = useMemo(() => rows.filter((r) => !r.present).length, [rows]);
  const hiddenCount = useMemo(() => rows.filter((r) => r.hidden).length, [rows]);

  useEffect(() => {
    if (!open) return;
    if (!filtered.length) return;
    if (selectedIndex !== -1) return;
    setSelectedId(filtered[0].externalId);
  }, [filtered, open, selectedIndex]);

  useEffect(() => {
    if (!selectedId) return;
    const el = listRef.current?.querySelector(`[data-user-id="${selectedId}"]`) as HTMLElement | null;
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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
                <div className="modal-header items-center">
                  <Dialog.Title className="modal-title">{t({ it: 'Seleziona un utente reale', en: 'Select a real user' })}</Dialog.Title>
                  <button onClick={onClose} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>
                <Dialog.Description className="mt-2 text-sm text-slate-600">
                  {t({
                    it: 'Scegli un dipendente importato dalla WebAPI o da CSV. Puoi inserire lo stesso utente più volte (es. due postazioni).',
                    en: 'Pick an employee imported from WebAPI or CSV. You can place the same user multiple times (e.g. two desks).'
                  })}
                </Dialog.Description>
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Cliente attivo', en: 'Active client' })}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold text-ink">{resolvedClientName || '—'}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                      <span className="rounded-full bg-white px-2 py-1">
                        {t({ it: `Caricati ${totalCount}`, en: `Loaded ${totalCount}` })}
                      </span>
                      <span className="rounded-full bg-white px-2 py-1">
                        {t({ it: `Visibili ${visibleCount}`, en: `Visible ${visibleCount}` })}
                      </span>
                      {missingCount ? (
                        <span className="rounded-full bg-white px-2 py-1">
                          {t({ it: `Mancanti ${missingCount}`, en: `Missing ${missingCount}` })}
                        </span>
                      ) : null}
                      {hiddenCount ? (
                        <span className="rounded-full bg-white px-2 py-1">
                          {t({ it: `Nascosti ${hiddenCount}`, en: `Hidden ${hiddenCount}` })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {t({
                      it: 'Gli utenti reali sono importati e visibili per singolo cliente. Se non trovi un utente, verifica l’import (WebAPI/CSV) o cambia cliente.',
                      en: 'Real users are imported and visible per client. If you cannot find someone, check the import (WebAPI/CSV) or switch client.'
                    })}
                  </div>
                  {lastLoadedAt ? (
                    <div className="mt-2 text-[11px] text-slate-400">
                      {t({ it: 'Aggiornato', en: 'Last refresh' })}: {new Date(lastLoadedAt).toLocaleTimeString()}
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[240px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      ref={searchRef}
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      onKeyDown={(e) => {
                        if (!filtered.length) return;
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          const next = Math.min(filtered.length - 1, Math.max(0, selectedIndex + 1));
                          setSelectedId(filtered[next].externalId);
                        }
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          const next = Math.max(0, selectedIndex === -1 ? 0 : selectedIndex - 1);
                          setSelectedId(filtered[next].externalId);
                        }
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (selected) onSelect(selected);
                        }
                      }}
                      className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-primary"
                      placeholder={t({ it: 'Cerca per nome, ruolo, email…', en: 'Search by name, role, email…' })}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => load()}
                    className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    title={t({ it: 'Ricarica elenco', en: 'Reload list' })}
                  >
                    <RefreshCw size={16} className={loading ? 'animate-spin text-primary' : 'text-slate-500'} />
                    {t({ it: 'Aggiorna', en: 'Refresh' })}
                  </button>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                    <Filter size={16} className="text-slate-500" />
                    <input type="checkbox" checked={onlyUnassigned} onChange={(e) => setOnlyUnassigned(e.target.checked)} />
                    {t({ it: 'Solo non assegnati', en: 'Only unassigned' })}
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={showMissing} onChange={(e) => setShowMissing(e.target.checked)} />
                    {t({ it: 'Includi mancanti', en: 'Include missing' })}
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
                    {t({ it: 'Mostra nascosti', en: 'Show hidden' })}
                  </label>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {t({
                    it: 'Suggerimento: usa le frecce per navigare e premi Invio per inserire.',
                    en: 'Tip: use arrows to navigate and press Enter to insert.'
                  })}
                </div>

                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                  <div className="grid grid-cols-12 gap-2 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
                    <div className="col-span-5">{t({ it: 'Nome', en: 'Name' })}</div>
                    <div className="col-span-2">{t({ it: 'ID', en: 'ID' })}</div>
                    <div className="col-span-4">{t({ it: 'Ruolo / Reparto', en: 'Role / Dept' })}</div>
                    <div className="col-span-1 text-center">{t({ it: 'Alloc.', en: 'Alloc.' })}</div>
                  </div>
                  <div ref={listRef} className="max-h-[340px] overflow-auto">
                    {loading ? (
                      <div className="px-4 py-6 text-sm text-slate-600">{t({ it: 'Caricamento…', en: 'Loading…' })}</div>
                    ) : null}
                    {!loading && loadError ? (
                      <div className="px-4 py-6 text-sm text-rose-700">{loadError}</div>
                    ) : null}
                    {!loading && !filtered.length ? (
                      <div className="px-4 py-6 text-sm text-slate-600">
                        {t({
                          it: 'Nessun utente trovato per questo cliente. Verifica l’import o modifica i filtri.',
                          en: 'No users found for this client. Check the import or adjust filters.'
                        })}
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              navigate('/settings?tab=import');
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            title={t({ it: 'Apri Custom Import', en: 'Open Custom Import' })}
                          >
                            {t({ it: 'Apri Custom Import', en: 'Open Custom Import' })}
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {filtered.map((r) => {
                      const count = assignedCounts?.get(`${r.clientId}:${r.externalId}`) || 0;
                      const selected = selectedId === r.externalId;
                      const displayName =
                        `${String(r.firstName || '').trim()} ${String(r.lastName || '').trim()}`.trim() || r.email || r.externalId;
                      return (
                        <button
                          key={r.externalId}
                          data-user-id={r.externalId}
                          onClick={() => setSelectedId(r.externalId)}
                          onDoubleClick={() => onSelect(r)}
                          className={`grid w-full grid-cols-12 gap-2 border-t border-slate-200 px-4 py-3 text-left text-sm hover:bg-slate-50 ${
                            selected ? 'bg-primary/10 ring-1 ring-primary/30 shadow-sm' : ''
                          }`}
                          aria-selected={selected}
                          title={displayName}
                        >
                          <div className="col-span-5 min-w-0">
                            <div className="truncate font-semibold text-ink">
                              {displayName}
                              {!r.present ? (
                                <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                  {t({ it: 'Non presente', en: 'Missing' })}
                                </span>
                              ) : null}
                              {r.hidden ? (
                                <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                  {t({ it: 'Nascosto', en: 'Hidden' })}
                                </span>
                              ) : null}
                              {count > 0 ? (
                                <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                  {t({ it: 'Già assegnato', en: 'Already placed' })}
                                </span>
                              ) : null}
                            </div>
                            <div className="truncate text-xs text-slate-500">{r.email || ''}</div>
                          </div>
                          <div className="col-span-2 font-mono text-[12px] text-slate-700">{r.externalId}</div>
                          <div className="col-span-4 min-w-0">
                            <div className="truncate text-xs text-slate-700">{r.role || '—'}</div>
                            <div className="truncate text-[11px] text-slate-500">{[r.dept1, r.dept2, r.dept3].filter(Boolean).join(' / ')}</div>
                          </div>
                          <div className="col-span-1 text-center text-sm font-semibold text-slate-700">{count}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    onClick={onClose}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    title={t({ it: 'Annulla', en: 'Cancel' })}
                  >
                    {t({ it: 'Annulla', en: 'Cancel' })}
                  </button>
                  <button
                    disabled={!selected}
                    onClick={() => {
                      if (!selected) return;
                      onSelect(selected);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white enabled:hover:bg-primary/90 disabled:opacity-50"
                    title={t({ it: 'Inserisci', en: 'Insert' })}
                  >
                    <Check size={16} />
                    {t({ it: 'Inserisci', en: 'Insert' })}
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

export default RealUserPickerModal;
