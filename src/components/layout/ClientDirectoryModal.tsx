import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ChevronDown, ChevronUp, ChevronsUpDown, Mail, Search, Users, X } from 'lucide-react';
import { Client } from '../../store/types';
import { useT } from '../../i18n/useT';
import { ExternalUserRow, listExternalUsers } from '../../api/customImport';
import { useToastStore } from '../../store/useToast';
import { exportClientDirectoryToPdf } from '../../utils/pdf';

interface Props {
  open: boolean;
  client?: Client;
  onClose: () => void;
}

const ClientDirectoryModal = ({ open, client, onClose }: Props) => {
  const t = useT();
  const push = useToastStore((s) => s.push);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const cacheRef = useRef<Record<string, ExternalUserRow[]>>({});
  const inFlightRef = useRef<Record<string, Promise<ExternalUserRow[]> | null>>({});
  const [rows, setRows] = useState<ExternalUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [sortKey, setSortKey] = useState<'lastName' | 'firstName' | 'role' | 'dept' | 'email' | 'mobile' | 'ext'>('dept');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [exportGroupBy, setExportGroupBy] = useState<'dept' | 'surname'>('dept');

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelectedIndex(0);
    setSortKey('dept');
    setSortDir('asc');
  }, [client?.id, open]);

  useEffect(() => {
    if (!open) return;
    if (!client?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    const cached = cacheRef.current[client.id];
    if (cached) {
      setRows(cached);
      setLoading(false);
    }
    let active = true;
    const existing = inFlightRef.current[client.id];
    const request =
      existing ||
      listExternalUsers({ clientId: client.id, includeHidden: true, includeMissing: true }).then((res) => res.rows || []);
    inFlightRef.current[client.id] = request;
    if (!cached) setLoading(true);
    request
      .then((list) => {
        cacheRef.current[client.id] = list;
        if (!active) return;
        setRows(list);
      })
      .catch((err) => {
        if (!active) return;
        setRows([]);
        push(err?.message || t({ it: 'Impossibile caricare la rubrica.', en: 'Unable to load the directory.' }), 'danger');
      })
      .finally(() => {
        if (inFlightRef.current[client.id] === request) inFlightRef.current[client.id] = null;
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client?.id, open, push, t]);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = `${r.externalId} ${r.firstName} ${r.lastName} ${r.role} ${r.dept1} ${r.dept2} ${r.dept3} ${r.email} ${r.mobile} ${r.ext1} ${r.ext2} ${r.ext3}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, rows]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    const normalize = (value: string) => String(value || '').trim().toLowerCase();
    const getDept = (r: ExternalUserRow) => normalize(r.dept1 || r.dept2 || r.dept3 || '');
    const getSortValue = (r: ExternalUserRow) => {
      switch (sortKey) {
        case 'lastName':
          return normalize(r.lastName);
        case 'firstName':
          return normalize(r.firstName);
        case 'role':
          return normalize(r.role);
        case 'dept':
          return getDept(r);
        case 'email':
          return normalize(r.email);
        case 'mobile':
          return normalize(r.mobile);
        case 'ext':
          return normalize(r.ext1);
        default:
          return '';
      }
    };
    const compare = (a: string, b: string) => {
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;
      return a.localeCompare(b, 'it', { numeric: true, sensitivity: 'base' });
    };
    list.sort((a, b) => {
      const av = getSortValue(a);
      const bv = getSortValue(b);
      const main = compare(av, bv);
      if (main !== 0) return sortDir === 'asc' ? main : -main;
      const tie = compare(normalize(a.lastName), normalize(b.lastName)) || compare(normalize(a.firstName), normalize(b.firstName));
      return sortDir === 'asc' ? tie : -tie;
    });
    return list;
  }, [filtered, sortDir, sortKey]);

  const onSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir('asc');
  };

  useEffect(() => {
    if (!open) return;
    if (!sorted.length) {
      setSelectedIndex(-1);
      return;
    }
    setSelectedIndex((prev) => {
      if (prev < 0) return 0;
      return Math.min(prev, sorted.length - 1);
    });
  }, [open, sorted.length]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (!sorted.length) return;
      const key = e.key.toLowerCase();
      if (key === 'arrowdown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(sorted.length - 1, Math.max(0, prev) + 1));
        return;
      }
      if (key === 'arrowup') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(0, Math.max(0, prev) - 1));
        return;
      }
      if (key === 'home') {
        e.preventDefault();
        setSelectedIndex(0);
        return;
      }
      if (key === 'end') {
        e.preventDefault();
        setSelectedIndex(sorted.length - 1);
        return;
      }
      if (key === 'm' && (e.metaKey || e.ctrlKey)) {
        const target =
          sorted.length === 1
            ? sorted[0]
            : selectedIndex >= 0
              ? sorted[Math.min(sorted.length - 1, selectedIndex)]
              : null;
        const selected = target;
        if (!selected?.email) {
          push(t({ it: 'Nessuna email disponibile.', en: 'No email available.' }), 'info');
          return;
        }
        e.preventDefault();
        window.open(`mailto:${selected.email}`, '_blank', 'noopener,noreferrer');
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [open, push, selectedIndex, sorted, t]);

  const selectedRow = selectedIndex >= 0 ? sorted[selectedIndex] : null;

  const exportCsv = () => {
    if (!sorted.length) return;
    const escape = (value: string) => `"${String(value || '').replace(/"/g, '""')}"`;
    const header = ['cognome', 'nome', 'ruolo', 'reparto', 'email', 'cellulare', 'interno'].join(',');
    const lines = sorted.map((row) =>
      [
        row.lastName || '',
        row.firstName || '',
        row.role || '',
        row.dept1 || '',
        row.email || '',
        row.mobile || '',
        row.ext1 || ''
      ]
        .map(escape)
        .join(',')
    );
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeClient = String(client?.shortName || client?.name || 'client').replace(/[^\w-]+/g, '_');
    a.download = `deskly_rubrica_${safeClient}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    if (!sorted.length) return;
    exportClientDirectoryToPdf({
      clientName: client?.shortName || client?.name || '',
      groupBy: exportGroupBy,
      rows: sorted.map((r) => ({
        lastName: r.lastName || '',
        firstName: r.firstName || '',
        role: r.role || '',
        dept: r.dept1 || '',
        email: r.email || '',
        mobile: r.mobile || '',
        ext: r.ext1 || ''
      }))
    });
  };

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
              <Dialog.Panel className="w-full max-w-6xl modal-panel">
                <div className="modal-header items-center">
                  <div className="min-w-0">
                    <Dialog.Title className="modal-title flex items-center gap-2">
                      <Users size={18} className="text-slate-600" />
                      {t({ it: 'Rubrica utenti', en: 'User directory' })}
                    </Dialog.Title>
                    <Dialog.Description className="modal-description">
                      {client ? <span className="font-semibold text-slate-700">{client.shortName || client.name}</span> : null}
                    </Dialog.Description>
                  </div>
                  <button onClick={onClose} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="relative min-w-[220px] flex-1">
                    <Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
                    <input
                      ref={inputRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({ it: 'Cerca per nome, reparto, email, cellulare…', en: 'Search by name, dept, email, mobile…' })}
                      autoFocus
                    />
                  </div>
                  <div className="text-xs text-slate-500">
                    {loading && !filtered.length
                      ? t({ it: 'Caricamento…', en: 'Loading…' })
                      : filtered.length
                      ? t({ it: `${filtered.length} contatti`, en: `${filtered.length} contacts` })
                      : t({ it: 'Nessun contatto', en: 'No contacts' })}
                  </div>
                  <div className="text-xs text-slate-400">
                    {t({ it: 'Frecce: naviga · Cmd+M: mail', en: 'Arrows: navigate · Cmd+M: mail' })}
                  </div>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <select
                      value={exportGroupBy}
                      onChange={(e) => setExportGroupBy(e.target.value as 'dept' | 'surname')}
                      className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="dept">{t({ it: 'PDF per reparto', en: 'PDF by dept' })}</option>
                      <option value="surname">{t({ it: 'PDF per cognome', en: 'PDF by surname' })}</option>
                    </select>
                    <button
                      onClick={exportPdf}
                      disabled={!sorted.length}
                      className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {t({ it: 'Esporta PDF', en: 'Export PDF' })}
                    </button>
                    <button
                      onClick={exportCsv}
                      disabled={!sorted.length}
                      className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {t({ it: 'Esporta CSV', en: 'Export CSV' })}
                    </button>
                  </div>
                </div>

                <div className="mt-4 max-h-[60vh] overflow-auto rounded-xl border border-slate-200 bg-white">
                  <table className="min-w-[1080px] w-full text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">
                          <button onClick={() => onSort('lastName')} className="inline-flex items-center gap-1">
                            {t({ it: 'Cognome', en: 'Surname' })}
                            {sortKey === 'lastName' ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronsUpDown size={12} />}
                          </button>
                        </th>
                        <th className="px-3 py-2">
                          <button onClick={() => onSort('firstName')} className="inline-flex items-center gap-1">
                            {t({ it: 'Nome', en: 'Name' })}
                            {sortKey === 'firstName' ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronsUpDown size={12} />}
                          </button>
                        </th>
                        <th className="px-3 py-2">
                          <button onClick={() => onSort('role')} className="inline-flex items-center gap-1">
                            {t({ it: 'Ruolo', en: 'Role' })}
                            {sortKey === 'role' ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronsUpDown size={12} />}
                          </button>
                        </th>
                        <th className="px-3 py-2">
                          <button onClick={() => onSort('dept')} className="inline-flex items-center gap-1">
                            {t({ it: 'Reparto', en: 'Department' })}
                            {sortKey === 'dept' ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronsUpDown size={12} />}
                          </button>
                        </th>
                        <th className="px-3 py-2">
                          <button onClick={() => onSort('email')} className="inline-flex items-center gap-1">
                            {t({ it: 'Email', en: 'Email' })}
                            {sortKey === 'email' ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronsUpDown size={12} />}
                          </button>
                        </th>
                        <th className="px-3 py-2">
                          <button onClick={() => onSort('mobile')} className="inline-flex items-center gap-1">
                            {t({ it: 'Cellulare', en: 'Mobile' })}
                            {sortKey === 'mobile' ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronsUpDown size={12} />}
                          </button>
                        </th>
                        <th className="px-3 py-2">
                          <button onClick={() => onSort('ext')} className="inline-flex items-center gap-1">
                            {t({ it: 'Interno', en: 'Extension' })}
                            {sortKey === 'ext' ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronsUpDown size={12} />}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sorted.length ? (
                        sorted.map((row, idx) => {
                          const firstName = String(row.firstName || '').trim();
                          const lastName = String(row.lastName || '').trim();
                          const role = row.role || '—';
                          const dept = row.dept1 || '—';
                          const isSelected = selectedRow?.externalId === row.externalId;
                          return (
                            <tr
                              key={row.externalId}
                              className={`cursor-pointer ${isSelected ? 'bg-sky-50' : 'hover:bg-slate-50/70'}`}
                              onClick={() => {
                                setSelectedIndex(idx);
                                inputRef.current?.blur();
                              }}
                            >
                              <td className="px-3 py-2 text-slate-700">{lastName || '—'}</td>
                              <td className="px-3 py-2 text-slate-700">{firstName || '—'}</td>
                              <td className="px-3 py-2 text-slate-700">{role}</td>
                              <td className="px-3 py-2 text-slate-700">{dept}</td>
                              <td className="px-3 py-2">
                                {row.email ? (
                                  <a
                                    href={`mailto:${row.email}`}
                                    className="inline-flex items-center gap-2 text-sky-700 hover:underline"
                                    title={t({ it: 'Scrivi email', en: 'Send email' })}
                                  >
                                    <Mail size={14} />
                                    <span className="truncate">{row.email}</span>
                                  </a>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-slate-700">{row.mobile || '—'}</td>
                              <td className="px-3 py-2 text-slate-700">{row.ext1 || '—'}</td>
                            </tr>
                          );
                        })
                      ) : loading ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500">
                            {t({ it: 'Caricamento rubrica…', en: 'Loading directory…' })}
                          </td>
                        </tr>
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500">
                            {t({ it: 'Nessun contatto trovato.', en: 'No contacts found.' })}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={onClose}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
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

export default ClientDirectoryModal;
