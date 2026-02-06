import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ChevronDown, ChevronUp, Crosshair, ExternalLink, FileDown, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useT, useLang } from '../../i18n/useT';
import { Client } from '../../store/types';
import { useDataStore } from '../../store/useDataStore';
import { useUIStore } from '../../store/useUIStore';
import { useToastStore } from '../../store/useToast';
import { normalizeUrl } from '../../utils/urls';
import { exportClientIpMapToPdf } from '../../utils/pdf';

interface Props {
  open: boolean;
  client?: Client;
  onClose: () => void;
}

type SortKey = 'ip' | 'name' | 'type' | 'site' | 'plan';

type IpEntry = {
  ip: string;
  objectId: string;
  name: string;
  typeId: string;
  typeLabel: string;
  url?: string;
  siteId: string;
  siteName: string;
  planId: string;
  planName: string;
};

const ClientIpMapModal = ({ open, client, onClose }: Props) => {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const push = useToastStore((s) => s.push);
  const requestSaveAndNavigate = useUIStore((s) => s.requestSaveAndNavigate);
  const dirtyByPlan = useUIStore((s) => s.dirtyByPlan);
  const selectedPlanId = useUIStore((s) => s.selectedPlanId);
  const objectTypeDefs = useDataStore((s) => s.objectTypes || []);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('ip');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSortKey('ip');
    setSortDir('asc');
    setSelectedIndex(0);
    setCollapsedGroups({});
  }, [client?.id, open]);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const objectTypeById = useMemo(() => {
    const map = new Map<string, any>();
    for (const def of objectTypeDefs || []) map.set(def.id, def);
    return map;
  }, [objectTypeDefs]);

  const getTypeLabel = useCallback(
    (typeId: string) => {
      const def = objectTypeById.get(typeId);
      return (def?.name?.[lang] as string) || (def?.name?.it as string) || typeId;
    },
    [lang, objectTypeById]
  );

  const entries = useMemo<IpEntry[]>(() => {
    if (!client) return [];
    const out: IpEntry[] = [];
    for (const site of client.sites || []) {
      for (const plan of site.floorPlans || []) {
        for (const obj of plan.objects || []) {
          const ip = String((obj as any)?.ip || '').trim();
          if (!ip) continue;
          const typeLabel = getTypeLabel(obj.type);
          const name = String(obj.name || typeLabel).trim() || typeLabel;
          out.push({
            ip,
            objectId: obj.id,
            name,
            typeId: obj.type,
            typeLabel,
            url: String((obj as any)?.url || '').trim() || undefined,
            siteId: site.id,
            siteName: site.name,
            planId: plan.id,
            planName: plan.name
          });
        }
      }
    }
    return out;
  }, [client, getTypeLabel]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((entry) => {
      const hay = `${entry.ip} ${entry.name} ${entry.typeLabel} ${entry.url || ''} ${entry.siteName} ${entry.planName}`.toLowerCase();
      return hay.includes(q);
    });
  }, [entries, query]);

  const groupedEntries = useMemo(() => {
    const getPrefix24 = (ip: string) => {
      const parts = String(ip || '').trim().split('.');
      if (parts.length < 3) return null;
      const nums = parts.slice(0, 3).map((p) => Number(p));
      if (nums.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return null;
      return `${nums[0]}.${nums[1]}.${nums[2]}`;
    };
    const groups = new Map<string, { key: string; label: string; items: IpEntry[] }>();
    for (const entry of filteredEntries) {
      const prefix = getPrefix24(entry.ip);
      const key = prefix || 'other';
      const label = prefix || t({ it: 'Altro', en: 'Other' });
      if (!groups.has(key)) groups.set(key, { key, label, items: [] });
      groups.get(key)!.items.push(entry);
    }

    const dirFactor = sortDir === 'asc' ? 1 : -1;
    const getField = (entry: IpEntry) => {
      switch (sortKey) {
        case 'name':
          return entry.name;
        case 'type':
          return entry.typeLabel;
        case 'site':
          return entry.siteName;
        case 'plan':
          return entry.planName;
        case 'ip':
        default:
          return entry.ip;
      }
    };

    const orderedGroups = Array.from(groups.values()).sort((a, b) => {
      if (a.key === 'other') return 1;
      if (b.key === 'other') return -1;
      const cmp = a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });
      return sortKey === 'ip' ? cmp * dirFactor : cmp;
    });

    for (const group of orderedGroups) {
      group.items.sort((a, b) => getField(a).localeCompare(getField(b), undefined, { numeric: true, sensitivity: 'base' }) * dirFactor);
    }
    return orderedGroups;
  }, [filteredEntries, sortDir, sortKey, t]);

  const flatEntries = useMemo(
    () => groupedEntries.flatMap((group) => (collapsedGroups[group.key] ? [] : group.items)),
    [collapsedGroups, groupedEntries]
  );

  const totalDevices = filteredEntries.length;
  const totalGroups = groupedEntries.length;

  useEffect(() => {
    if (!open) return;
    if (!flatEntries.length) {
      setSelectedIndex(-1);
      return;
    }
    setSelectedIndex((prev) => {
      if (prev < 0) return 0;
      return Math.min(prev, flatEntries.length - 1);
    });
  }, [flatEntries.length, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (!flatEntries.length) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || (target as any)?.isContentEditable;
      const key = e.key.toLowerCase();
      if (key === 'arrowdown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(flatEntries.length - 1, Math.max(0, prev) + 1));
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
        setSelectedIndex(flatEntries.length - 1);
        return;
      }
      if (key === 'u' && !isTyping) {
        const selected = flatEntries[Math.max(0, selectedIndex)];
        const normalized = normalizeUrl(selected?.url || '');
        if (!normalized) {
          push(t({ it: 'Nessun URL disponibile.', en: 'No URL available.' }), 'info');
          return;
        }
        e.preventDefault();
        window.open(normalized, '_blank', 'noopener,noreferrer');
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [flatEntries, open, push, selectedIndex, t]);

  const selectedEntry = selectedIndex >= 0 ? flatEntries[selectedIndex] : null;
  const indexById = useMemo(() => new Map(flatEntries.map((entry, index) => [entry.objectId, index])), [flatEntries]);
  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSort = (key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      return key;
    });
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDir === 'asc' ? <ChevronUp size={12} className="text-slate-500" /> : <ChevronDown size={12} className="text-slate-500" />;
  };

  const handleNavigate = (planId: string, objectId: string) => {
    const url = `/plan/${planId}?focusObject=${encodeURIComponent(objectId)}`;
    if (selectedPlanId && selectedPlanId !== planId && dirtyByPlan[selectedPlanId]) {
      requestSaveAndNavigate?.(url);
    } else {
      navigate(url);
    }
    onClose();
  };

  const handleExport = () => {
    if (!filteredEntries.length) {
      push(t({ it: 'Nessun dispositivo con IP da esportare.', en: 'No IP devices to export.' }), 'info');
      return;
    }
    exportClientIpMapToPdf({
      clientName: client?.shortName || client?.name || t({ it: 'Cliente', en: 'Client' }),
      entries: filteredEntries.map((entry) => ({
        ip: entry.ip,
        name: entry.name,
        type: entry.typeLabel,
        url: entry.url,
        site: entry.siteName,
        plan: entry.planName
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
                    <Dialog.Title className="modal-title">{t({ it: 'IP Map', en: 'IP Map' })}</Dialog.Title>
                    <Dialog.Description className="modal-description">
                      {client ? <span className="font-semibold text-slate-700">{client.shortName || client.name}</span> : null}
                    </Dialog.Description>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExport}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                    >
                      <FileDown size={16} />
                      PDF
                    </button>
                    <button onClick={onClose} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="relative min-w-[220px] flex-1">
                    <Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
                    <input
                      ref={inputRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({ it: 'Cerca per IP, nome, tipo, sede, planimetria...', en: 'Search by IP, name, type, site, floor plan...' })}
                      autoFocus
                    />
                  </div>
                  <div className="text-xs text-slate-500">
                    {totalDevices
                      ? t({
                          it: `${totalDevices} dispositivi · ${totalGroups} reti /24`,
                          en: `${totalDevices} devices · ${totalGroups} /24 networks`
                        })
                      : t({ it: 'Nessun dispositivo con IP', en: 'No IP devices' })}
                  </div>
                  <div className="text-xs text-slate-400">{t({ it: 'Frecce: naviga · U: apri URL', en: 'Arrows: navigate · U: open URL' })}</div>
                </div>

                <div className="mt-4 max-h-[60vh] overflow-auto rounded-xl border border-slate-200 bg-white">
                  <table className="min-w-[960px] w-full text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">
                          <button type="button" onClick={() => handleSort('ip')} className="flex items-center gap-1">
                            {t({ it: 'IP', en: 'IP' })}
                            {sortIcon('ip')}
                          </button>
                        </th>
                        <th className="px-3 py-2">
                          <button type="button" onClick={() => handleSort('name')} className="flex items-center gap-1">
                            {t({ it: 'Nome', en: 'Name' })}
                            {sortIcon('name')}
                          </button>
                        </th>
                        <th className="px-3 py-2">
                          <button type="button" onClick={() => handleSort('type')} className="flex items-center gap-1">
                            {t({ it: 'Tipo', en: 'Type' })}
                            {sortIcon('type')}
                          </button>
                        </th>
                        <th className="px-3 py-2">
                          <button type="button" onClick={() => handleSort('site')} className="flex items-center gap-1">
                            {t({ it: 'Sede', en: 'Site' })}
                            {sortIcon('site')}
                          </button>
                        </th>
                        <th className="px-3 py-2">
                          <button type="button" onClick={() => handleSort('plan')} className="flex items-center gap-1">
                            {t({ it: 'Planimetria', en: 'Floor plan' })}
                            {sortIcon('plan')}
                          </button>
                        </th>
                        <th className="px-3 py-2">{t({ it: 'URL', en: 'URL' })}</th>
                        <th className="px-3 py-2">{t({ it: 'Vai', en: 'Go' })}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {groupedEntries.length ? (
                        groupedEntries.map((group) => {
                          const collapsed = !!collapsedGroups[group.key];
                          return (
                            <Fragment key={group.key}>
                              <tr className="bg-slate-50/70">
                                <td colSpan={7} className="px-3 py-2 text-xs font-semibold text-slate-600">
                                  <button
                                    type="button"
                                    onClick={() => toggleGroup(group.key)}
                                    className="inline-flex items-center gap-2 text-left"
                                    title={collapsed ? t({ it: 'Espandi', en: 'Expand' }) : t({ it: 'Compatta', en: 'Collapse' })}
                                  >
                                    <ChevronDown size={14} className={`transition ${collapsed ? '-rotate-90' : ''}`} />
                                    <span className="text-slate-900">{group.label}</span>
                                    <span className="text-slate-500">· {t({ it: `${group.items.length} dispositivi`, en: `${group.items.length} devices` })}</span>
                                  </button>
                                </td>
                              </tr>
                              {collapsed
                                ? null
                                : group.items.map((entry) => {
                              const normalized = normalizeUrl(entry.url || '');
                              const index = indexById.get(entry.objectId) ?? -1;
                              const isSelected = selectedEntry?.objectId === entry.objectId;
                              return (
                                <tr
                                  key={entry.objectId}
                                  className={`cursor-pointer ${isSelected ? 'bg-sky-50' : 'hover:bg-slate-50/70'}`}
                                  onClick={() => {
                                    if (index >= 0) setSelectedIndex(index);
                                    inputRef.current?.blur();
                                  }}
                                >
                                  <td className="px-3 py-2 font-semibold text-slate-700">{entry.ip}</td>
                                  <td className="px-3 py-2 text-slate-900">{entry.name}</td>
                                  <td className="px-3 py-2 text-slate-700">{entry.typeLabel}</td>
                                  <td className="px-3 py-2 text-slate-700">{entry.siteName}</td>
                                  <td className="px-3 py-2 text-slate-700">{entry.planName}</td>
                                  <td className="px-3 py-2">
                                    <button
                                      type="button"
                                      disabled={!normalized}
                                      onClick={() => normalized && window.open(normalized, '_blank', 'noopener,noreferrer')}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                      title={t({ it: 'Apri URL', en: 'Open URL' })}
                                    >
                                      <ExternalLink size={14} />
                                    </button>
                                  </td>
                                  <td className="px-3 py-2">
                                    <button
                                      type="button"
                                      onClick={() => handleNavigate(entry.planId, entry.objectId)}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                      title={t({ it: 'Apri e centra dispositivo', en: 'Open and focus device' })}
                                    >
                                      <Crosshair size={14} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                            </Fragment>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500">
                            {t({ it: 'Nessun dispositivo con IP per questo cliente.', en: 'No IP devices for this client.' })}
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

export default ClientIpMapModal;
