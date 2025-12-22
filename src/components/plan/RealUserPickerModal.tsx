import { Fragment, useEffect, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Check, Filter, Search, X } from 'lucide-react';
import { ExternalUserRow, listExternalUsers } from '../../api/customImport';
import { useT } from '../../i18n/useT';

interface Props {
  open: boolean;
  clientId: string;
  assignedCounts?: Map<string, number>;
  onClose: () => void;
  onSelect: (user: ExternalUserRow) => void;
}

const RealUserPickerModal = ({ open, clientId, assignedCounts, onClose, onSelect }: Props) => {
  const t = useT();
  const [q, setQ] = useState('');
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ExternalUserRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const res = await listExternalUsers({ clientId, q: q.trim() || undefined });
      setRows(res.rows || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setQ('');
    setOnlyUnassigned(false);
    setSelectedId('');
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientId]);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      load();
    }, 250);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const filtered = useMemo(() => {
    const list = rows.filter((r) => r.present && !r.hidden);
    if (!onlyUnassigned) return list;
    return list.filter((r) => (assignedCounts?.get(`${r.clientId}:${r.externalId}`) || 0) === 0);
  }, [assignedCounts, onlyUnassigned, rows]);

  const selected = useMemo(() => filtered.find((r) => r.externalId === selectedId) || null, [filtered, selectedId]);

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
              <Dialog.Panel className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-card">
                <div className="flex items-center justify-between">
                  <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Seleziona un utente reale', en: 'Select a real user' })}</Dialog.Title>
                  <button onClick={onClose} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>
                <Dialog.Description className="mt-2 text-sm text-slate-600">
                  {t({
                    it: 'Scegli un dipendente importato dalla WebAPI. Puoi inserire lo stesso utente più volte (es. due postazioni).',
                    en: 'Pick an employee imported from the WebAPI. You can place the same user multiple times (e.g. two desks).'
                  })}
                </Dialog.Description>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[240px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-primary"
                      placeholder={t({ it: 'Cerca per nome, ruolo, email…', en: 'Search by name, role, email…' })}
                      autoFocus
                    />
                  </div>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                    <Filter size={16} className="text-slate-500" />
                    <input type="checkbox" checked={onlyUnassigned} onChange={(e) => setOnlyUnassigned(e.target.checked)} />
                    {t({ it: 'Solo non assegnati', en: 'Only unassigned' })}
                  </label>
                </div>

                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                  <div className="grid grid-cols-12 gap-2 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
                    <div className="col-span-5">{t({ it: 'Nome', en: 'Name' })}</div>
                    <div className="col-span-2">{t({ it: 'ID', en: 'ID' })}</div>
                    <div className="col-span-4">{t({ it: 'Ruolo / Reparto', en: 'Role / Dept' })}</div>
                    <div className="col-span-1 text-center">{t({ it: 'Alloc.', en: 'Alloc.' })}</div>
                  </div>
                  <div className="max-h-[340px] overflow-auto">
                    {loading ? (
                      <div className="px-4 py-6 text-sm text-slate-600">{t({ it: 'Caricamento…', en: 'Loading…' })}</div>
                    ) : null}
                    {!loading && !filtered.length ? (
                      <div className="px-4 py-6 text-sm text-slate-600">{t({ it: 'Nessun utente trovato.', en: 'No users found.' })}</div>
                    ) : null}
                    {filtered.map((r) => {
                      const count = assignedCounts?.get(`${r.clientId}:${r.externalId}`) || 0;
                      const selected = selectedId === r.externalId;
                      return (
                        <button
                          key={r.externalId}
                          onClick={() => setSelectedId(r.externalId)}
                          className={`grid w-full grid-cols-12 gap-2 border-t border-slate-200 px-4 py-3 text-left text-sm hover:bg-slate-50 ${
                            selected ? 'bg-primary/5' : ''
                          }`}
                        >
                          <div className="col-span-5 min-w-0">
                            <div className="truncate font-semibold text-ink">
                              {r.firstName} {r.lastName}
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

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={onClose}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
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

