import { Fragment, useEffect, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Check, ChevronDown, ChevronRight, Crosshair, ExternalLink, Info, Pencil, Plus, RotateCcw, Save, Search, ShieldAlert, Trash2, X } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { EmergencyContactEntry } from '../../store/types';
import { useT } from '../../i18n/useT';

interface Props {
  open: boolean;
  clientId: string | null;
  readOnly?: boolean;
  safetyCardVisible?: boolean;
  onToggleSafetyCard?: () => void;
  safetyCardToggleDisabled?: boolean;
  onClose: () => void;
}

type ContactDraft = {
  scope: 'global' | 'client' | 'site' | 'plan';
  name: string;
  phone: string;
  notes: string;
  showOnPlanCard: boolean;
  siteId: string;
  floorPlanId: string;
};

const makeEntryId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const parseGoogleMapsCoordinates = (rawValue: string): { lat: number; lng: number } | null => {
  const raw = String(rawValue || '').trim();
  if (!raw) return null;
  const decimal = '[-+]?\\d{1,3}(?:\\.\\d+)?';
  const pair = new RegExp(`(${decimal})\\s*,\\s*(${decimal})`);
  const direct = raw.match(pair);
  const fromPair = direct || raw.match(/[@?&]q=([-+]?\d{1,3}(?:\.\d+)?),\s*([-+]?\d{1,3}(?:\.\d+)?)/);
  if (!fromPair) return null;
  const lat = Number(fromPair[1]);
  const lng = Number(fromPair[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
};
const googleMapsUrlFromCoords = (rawValue: string) => {
  const raw = String(rawValue || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const parsed = parseGoogleMapsCoordinates(raw);
  if (!parsed) return '';
  return `https://www.google.com/maps?q=${encodeURIComponent(`${parsed.lat},${parsed.lng}`)}`;
};

const EmergencyContactsModal = ({
  open,
  clientId,
  readOnly = false,
  safetyCardVisible = false,
  onToggleSafetyCard,
  safetyCardToggleDisabled = false,
  onClose
}: Props) => {
  const t = useT();
  const clients = useDataStore((s) => s.clients);
  const updateClient = useDataStore((s) => s.updateClient);
  const client = useMemo(() => clients.find((entry) => entry.id === clientId) || null, [clientId, clients]);

  const [contacts, setContacts] = useState<EmergencyContactEntry[]>([]);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ContactDraft>({
    scope: 'global',
    name: '',
    phone: '',
    notes: '',
    showOnPlanCard: true,
    siteId: '',
    floorPlanId: ''
  });
  const [editDraft, setEditDraft] = useState<ContactDraft>({
    scope: 'global',
    name: '',
    phone: '',
    notes: '',
    showOnPlanCard: true,
    siteId: '',
    floorPlanId: ''
  });
  const [error, setError] = useState('');
  const [newContactOpen, setNewContactOpen] = useState(true);

  const globalContacts = useMemo(() => {
    const rows = clients
      .flatMap((entry) => entry.emergencyContacts || [])
      .filter((entry) => entry.scope === 'global');
    const seen = new Set<string>();
    const dedup: EmergencyContactEntry[] = [];
    for (const row of rows) {
      const key = `${row.scope}|${row.name}|${row.phone}|${row.notes || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dedup.push({
        id: row.id || makeEntryId(),
        scope: 'global',
        name: String(row.name || ''),
        phone: String(row.phone || ''),
        notes: row.notes ? String(row.notes) : undefined,
        showOnPlanCard: row.showOnPlanCard !== false
      });
    }
    return dedup;
  }, [clients]);

  useEffect(() => {
    if (!open || !client) return;
    const local = (client.emergencyContacts || [])
      .filter((entry) => entry.scope !== 'global')
      .map((entry) => ({
        ...entry,
        id: String(entry.id || makeEntryId()),
        showOnPlanCard: entry.showOnPlanCard !== false
      }));
    setContacts([...globalContacts, ...local]);
    setDraft({
      scope: 'global',
      name: '',
      phone: '',
      notes: '',
      showOnPlanCard: true,
      siteId: client.sites?.[0]?.id || '',
      floorPlanId: client.sites?.[0]?.floorPlans?.[0]?.id || ''
    });
    setEditDraft({
      scope: 'global',
      name: '',
      phone: '',
      notes: '',
      showOnPlanCard: true,
      siteId: client.sites?.[0]?.id || '',
      floorPlanId: client.sites?.[0]?.floorPlans?.[0]?.id || ''
    });
    setEditingId(null);
    setSearch('');
    setError('');
    setNewContactOpen(true);
  }, [client, globalContacts, open]);

  const toDraft = (entry: EmergencyContactEntry): ContactDraft => ({
    scope: (entry.scope || 'client') as ContactDraft['scope'],
    name: String(entry.name || ''),
    phone: String(entry.phone || ''),
    notes: String(entry.notes || ''),
    showOnPlanCard: entry.showOnPlanCard !== false,
    siteId: String(entry.siteId || client?.sites?.[0]?.id || ''),
    floorPlanId: String(entry.floorPlanId || client?.sites?.[0]?.floorPlans?.[0]?.id || '')
  });

  const getPlanOptionsForSite = (siteId: string) => {
    return client?.sites.find((site) => site.id === siteId)?.floorPlans || [];
  };

  const emergencyPoints = useMemo(() => {
    if (!client) return [];
    const out: Array<{ id: string; name: string; siteName: string; planName: string; gps: string; coords: string; mapsUrl: string }> = [];
    for (const site of client.sites || []) {
      for (const plan of site.floorPlans || []) {
        for (const obj of plan.objects || []) {
          if (String(obj.type || '') !== 'safety_assembly_point') continue;
          const gps = String(obj.gpsCoords || '');
          out.push({
            id: String(obj.id || ''),
            name: String(obj.name || obj.type || ''),
            siteName: String(site.name || ''),
            planName: String(plan.name || ''),
            gps,
            coords: `${Math.round(Number(obj.x || 0))}, ${Math.round(Number(obj.y || 0))}`,
            mapsUrl: googleMapsUrlFromCoords(gps)
          });
        }
      }
    }
    return out;
  }, [client]);

  const scopeStyle = (scope: EmergencyContactEntry['scope']) => {
    if (scope === 'global') {
      return {
        badge: 'border-sky-200 bg-sky-100 text-sky-700',
        row: 'bg-sky-50/35'
      };
    }
    if (scope === 'client') {
      return {
        badge: 'border-emerald-200 bg-emerald-100 text-emerald-700',
        row: 'bg-emerald-50/35'
      };
    }
    if (scope === 'site') {
      return {
        badge: 'border-amber-200 bg-amber-100 text-amber-800',
        row: 'bg-amber-50/35'
      };
    }
    return {
      badge: 'border-rose-200 bg-rose-100 text-rose-700',
      row: 'bg-rose-50/35'
    };
  };

  const scopeLabel = (entry: EmergencyContactEntry) => {
    const clientName = client?.shortName || client?.name || '—';
    if (entry.scope === 'global') return t({ it: 'Generale', en: 'Global' });
    if (entry.scope === 'client') return clientName;
    if (entry.scope === 'site') {
      const siteName = client?.sites.find((site) => site.id === entry.siteId)?.name || '—';
      return `${clientName} / ${siteName}`;
    }
    if (entry.scope === 'plan') {
      for (const site of client?.sites || []) {
        const plan = site.floorPlans.find((fp) => fp.id === entry.floorPlanId);
        if (plan) return `${clientName} / ${site.name} / ${plan.name}`;
      }
      return clientName;
    }
    return clientName;
  };
  const scopeRank = (scope: string) => {
    if (scope === 'global') return 0;
    if (scope === 'client') return 1;
    if (scope === 'site') return 2;
    if (scope === 'plan') return 3;
    return 9;
  };

  const filteredContacts = (() => {
    const q = search.trim().toLowerCase();
    const filtered = !q
      ? contacts
      : contacts.filter((entry) => {
          const hay = `${scopeLabel(entry)} ${entry.name || ''} ${entry.phone || ''} ${entry.notes || ''}`.toLowerCase();
          return hay.includes(q);
        });
    return filtered.slice().sort((a, b) => {
      const byScope = scopeRank(String(a.scope || '')) - scopeRank(String(b.scope || ''));
      if (byScope !== 0) return byScope;
      return `${a.name || ''}`.localeCompare(`${b.name || ''}`);
    });
  })();

  const validateDraft = (value: ContactDraft) => {
    if (!value.name.trim() || !value.phone.trim()) {
      setError(t({ it: 'Nome e telefono sono obbligatori.', en: 'Name and phone are required.' }));
      return false;
    }
    if ((value.scope === 'site' || value.scope === 'plan') && !String(value.siteId || '').trim()) {
      setError(t({ it: 'Seleziona una sede.', en: 'Select a site.' }));
      return false;
    }
    if (value.scope === 'plan' && !String(value.floorPlanId || '').trim()) {
      setError(t({ it: 'Seleziona una planimetria.', en: 'Select a floor plan.' }));
      return false;
    }
    setError('');
    return true;
  };

  const addContact = () => {
    if (!validateDraft(draft)) return;
    const next: EmergencyContactEntry = {
      id: makeEntryId(),
      scope: draft.scope,
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      notes: draft.notes.trim() || undefined,
      showOnPlanCard: !!draft.showOnPlanCard,
      siteId: draft.scope === 'site' || draft.scope === 'plan' ? draft.siteId || undefined : undefined,
      floorPlanId: draft.scope === 'plan' ? draft.floorPlanId || undefined : undefined
    };
    setContacts((prev) => [...prev, next]);
    setDraft((prev) => ({ ...prev, name: '', phone: '', notes: '' }));
  };

  const startEdit = (entry: EmergencyContactEntry) => {
    setEditingId(entry.id);
    setEditDraft(toDraft(entry));
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setError('');
  };

  const saveEdit = (id: string) => {
    if (!validateDraft(editDraft)) return;
    setContacts((prev) =>
      prev.map((entry) =>
        entry.id !== id
          ? entry
          : {
              ...entry,
              scope: editDraft.scope,
              name: editDraft.name.trim(),
              phone: editDraft.phone.trim(),
              notes: editDraft.notes.trim() || undefined,
              showOnPlanCard: !!editDraft.showOnPlanCard,
              siteId: editDraft.scope === 'site' || editDraft.scope === 'plan' ? editDraft.siteId || undefined : undefined,
              floorPlanId: editDraft.scope === 'plan' ? editDraft.floorPlanId || undefined : undefined
            }
      )
    );
    setEditingId(null);
    setError('');
  };

  const removeContact = (id: string) => {
    setContacts((prev) => prev.filter((entry) => entry.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const saveContacts = () => {
    if (!client) return;
    const global = contacts.filter((entry) => entry.scope === 'global');
    const selectedNonGlobal = contacts.filter((entry) => entry.scope !== 'global');
    for (const current of clients) {
      const existingNonGlobal = (current.emergencyContacts || []).filter((entry) => entry.scope !== 'global');
      const merged = current.id === client.id ? selectedNonGlobal : existingNonGlobal;
      updateClient(current.id, { emergencyContacts: [...merged, ...global] });
    }
    onClose();
  };

  const renderScopeSelectors = (
    value: ContactDraft,
    setValue: (updater: (prev: ContactDraft) => ContactDraft) => void,
    compact = false
  ) => {
    const planOptions = getPlanOptionsForSite(value.siteId);
    const clientLabel = client?.shortName || client?.name || '—';
    const isGlobal = value.scope === 'global';
    const canPickSite = value.scope === 'site' || value.scope === 'plan';
    const canPickPlan = value.scope === 'plan';
    const scopeLabelClass = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500';
    const fieldClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2';
    const disabledClass = 'w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-400';
    const updateScope = (scope: ContactDraft['scope']) => {
      setValue((prev) => {
        if (scope === prev.scope) return prev;
        const firstSiteId = client?.sites?.[0]?.id || '';
        const nextSiteId = scope === 'global' ? '' : prev.siteId || firstSiteId;
        const nextPlanId = scope === 'plan' ? prev.floorPlanId || getPlanOptionsForSite(nextSiteId)?.[0]?.id || '' : '';
        return {
          ...prev,
          scope,
          siteId: nextSiteId,
          floorPlanId: nextPlanId
        };
      });
    };
    if (compact) {
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className={scopeLabelClass}>{t({ it: 'Ambito', en: 'Scope' })}</label>
            <select value={value.scope} onChange={(e) => updateScope(e.target.value as ContactDraft['scope'])} className={fieldClass}>
              <option value="global">{t({ it: 'Generale', en: 'Global' })}</option>
              <option value="client">{t({ it: 'Cliente', en: 'Client' })}</option>
              <option value="site">{t({ it: 'Sede', en: 'Site' })}</option>
              <option value="plan">{t({ it: 'Planimetria', en: 'Plan' })}</option>
            </select>
          </div>
          {!isGlobal ? (
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-emerald-700">{t({ it: 'Cliente', en: 'Client' })}</label>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{clientLabel}</div>
            </div>
          ) : null}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-amber-700">{t({ it: 'Sede', en: 'Site' })}</label>
            {canPickSite ? (
              <select
                value={value.siteId}
                onChange={(e) => {
                  const nextSiteId = e.target.value;
                  const firstPlan = getPlanOptionsForSite(nextSiteId)?.[0]?.id || '';
                  setValue((prev) => ({ ...prev, siteId: nextSiteId, floorPlanId: prev.scope === 'plan' ? firstPlan : '' }));
                }}
                className={`${fieldClass} border-amber-200 bg-amber-50/40`}
              >
                {(client?.sites || []).map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className={disabledClass}>{t({ it: 'Non richiesta', en: 'Not required' })}</div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-rose-700">{t({ it: 'Planimetria', en: 'Floor plan' })}</label>
            {canPickPlan ? (
              <select value={value.floorPlanId} onChange={(e) => setValue((prev) => ({ ...prev, floorPlanId: e.target.value }))} className={`${fieldClass} border-rose-200 bg-rose-50/40`}>
                {(planOptions || []).map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className={disabledClass}>{t({ it: 'Non richiesta', en: 'Not required' })}</div>
            )}
          </div>
        </div>
      );
    }
    return (
      <div className="sm:col-span-2 lg:col-span-8 rounded-xl border border-slate-200 bg-slate-50 p-2">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={scopeLabelClass}>{t({ it: 'Ambito', en: 'Scope' })}</label>
            <select value={value.scope} onChange={(e) => updateScope(e.target.value as ContactDraft['scope'])} className={fieldClass}>
              <option value="global">{t({ it: 'Generale', en: 'Global' })}</option>
              <option value="client">{t({ it: 'Cliente', en: 'Client' })}</option>
              <option value="site">{t({ it: 'Sede', en: 'Site' })}</option>
              <option value="plan">{t({ it: 'Planimetria', en: 'Plan' })}</option>
            </select>
          </div>
          {!isGlobal ? (
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-emerald-700">{t({ it: 'Cliente', en: 'Client' })}</label>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{clientLabel}</div>
            </div>
          ) : null}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-amber-700">{t({ it: 'Sede', en: 'Site' })}</label>
            {canPickSite ? (
              <select
                value={value.siteId}
                onChange={(e) => {
                  const nextSiteId = e.target.value;
                  const firstPlan = getPlanOptionsForSite(nextSiteId)?.[0]?.id || '';
                  setValue((prev) => ({ ...prev, siteId: nextSiteId, floorPlanId: prev.scope === 'plan' ? firstPlan : '' }));
                }}
                className={`${fieldClass} border-amber-200 bg-amber-50/40`}
              >
                {(client?.sites || []).map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className={disabledClass}>
                {t({ it: 'Non richiesta', en: 'Not required' })}
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-rose-700">{t({ it: 'Planimetria', en: 'Floor plan' })}</label>
            {canPickPlan ? (
              <select value={value.floorPlanId} onChange={(e) => setValue((prev) => ({ ...prev, floorPlanId: e.target.value }))} className={`${fieldClass} border-rose-200 bg-rose-50/40`}>
                {(planOptions || []).map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className={disabledClass}>
                {t({ it: 'Non richiesta', en: 'Not required' })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/35 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center px-4 py-8">
            <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-6xl modal-panel">
                <div className="modal-header items-center">
                  <Dialog.Title className="modal-title">{t({ it: 'Rubrica emergenze', en: 'Emergency directory' })}</Dialog.Title>
                  <button onClick={onClose} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>
                <div className="mt-2 text-xs text-slate-600">
                  {client?.shortName || client?.name || '—'} · {t({ it: 'Numeri utili e punti di raccolta', en: 'Useful numbers and assembly points' })}
                </div>
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  <div className="font-semibold">
                    {t({
                      it: 'Scheda emergenza disattiva di default.',
                      en: 'Safety card is disabled by default.'
                    })}
                  </div>
                  <div className="mt-1">
                    {t({
                      it: 'Per mostrarla/nasconderla: tasto destro sulla planimetria oppure usa il pulsante qui sotto.',
                      en: 'To show/hide it: right-click on the floor plan or use the button below.'
                    })}
                  </div>
                  {onToggleSafetyCard ? (
                    <button
                      type="button"
                      onClick={onToggleSafetyCard}
                      disabled={safetyCardToggleDisabled}
                      className="mt-2 inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                      title={
                        safetyCardVisible
                          ? t({ it: 'Nascondi scheda emergenza', en: 'Hide safety card' })
                          : t({ it: 'Mostra scheda emergenza', en: 'Show safety card' })
                      }
                    >
                      <Crosshair size={13} />
                      {safetyCardVisible
                        ? t({ it: 'Nascondi scheda emergenza', en: 'Hide safety card' })
                        : t({ it: 'Mostra scheda emergenza', en: 'Show safety card' })}
                    </button>
                  ) : null}
                </div>

                {!readOnly ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                    <button
                      type="button"
                      onClick={() => setNewContactOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      <span>{t({ it: 'Nuovo contatto', en: 'New contact' })}</span>
                      {newContactOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    {newContactOpen ? (
                      <div className="mt-2 space-y-2">
                        {renderScopeSelectors(draft, (updater) => setDraft((prev) => updater(prev)))}
                        <div className="flex flex-wrap items-start gap-2">
                          <input
                            value={draft.name}
                            onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                            className="min-w-[280px] flex-[1.2] rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            placeholder={t({ it: 'Nome*', en: 'Name*' })}
                          />
                          <input
                            value={draft.phone}
                            onChange={(e) => setDraft((prev) => ({ ...prev, phone: e.target.value }))}
                            className="min-w-[280px] flex-[1.2] rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            placeholder={t({ it: 'Telefono*', en: 'Phone*' })}
                          />
                          <label
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
                            title={t({
                              it: 'Mostra questo contatto nella scheda sicurezza visibile in planimetria.',
                              en: 'Show this contact in the safety card visible on the floor plan.'
                            })}
                          >
                            <input
                              type="checkbox"
                              checked={draft.showOnPlanCard}
                              onChange={(e) => setDraft((prev) => ({ ...prev, showOnPlanCard: e.target.checked }))}
                            />
                            {t({ it: 'Scheda sicurezza', en: 'Safety card' })}
                            <Info size={12} className="text-slate-400" />
                          </label>
                          <button
                            type="button"
                            onClick={addContact}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-primary bg-primary/10 text-primary hover:bg-primary/20"
                            title={t({ it: 'Aggiungi contatto', en: 'Add contact' })}
                            aria-label={t({ it: 'Aggiungi contatto', en: 'Add contact' })}
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                        <textarea
                          value={draft.notes}
                          onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
                          rows={2}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          placeholder={t({ it: 'Note', en: 'Notes' })}
                        />
                      </div>
                    ) : null}
                    {error ? <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div> : null}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    {t({ it: 'Modalità sola consultazione.', en: 'Read-only mode.' })}
                  </div>
                )}

                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {t({ it: 'Numeri utili', en: 'Useful numbers' })}
                    </div>
                    <label className="flex w-full max-w-xs items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
                      <Search size={13} className="text-slate-400" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t({ it: 'Cerca numero, nome, scope, note...', en: 'Search number, name, scope, notes...' })}
                        className="w-full bg-transparent text-xs outline-none"
                      />
                    </label>
                  </div>
                  <div className="max-h-[36vh] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                        <tr>
                          <th className="px-3 py-2 text-left">{t({ it: 'Scope', en: 'Scope' })}</th>
                          <th className="px-3 py-2 text-left">{t({ it: 'Nome', en: 'Name' })}</th>
                          <th className="px-3 py-2 text-left">{t({ it: 'Telefono', en: 'Phone' })}</th>
                          <th className="px-3 py-2 text-left">{t({ it: 'Note', en: 'Notes' })}</th>
                          <th className="px-3 py-2 text-left">{t({ it: 'Scheda sicurezza', en: 'Safety card' })}</th>
                          {!readOnly ? <th className="px-3 py-2 text-right">{t({ it: 'Azioni', en: 'Actions' })}</th> : null}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredContacts.length ? (
                          filteredContacts.map((entry) => {
                            const editing = editingId === entry.id;
                            const style = scopeStyle(entry.scope);
                            return (
                              <tr key={entry.id} className={`${style.row} hover:brightness-[0.99]`}>
                                <td className="px-3 py-2 align-top text-slate-700">
                                  {editing ? (
                                    <div className="space-y-2">
                                      {renderScopeSelectors(editDraft, (updater) => setEditDraft((prev) => updater(prev)), true)}
                                    </div>
                                  ) : (
                                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${style.badge}`}>
                                      {scopeLabel(entry)}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 align-top">
                                  {editing ? (
                                    <input
                                      value={editDraft.name}
                                      onChange={(e) => setEditDraft((prev) => ({ ...prev, name: e.target.value }))}
                                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none ring-primary/30 focus:ring-2"
                                    />
                                  ) : (
                                    <div className="font-semibold text-ink">{entry.name}</div>
                                  )}
                                </td>
                                <td className="px-3 py-2 align-top">
                                  {editing ? (
                                    <input
                                      value={editDraft.phone}
                                      onChange={(e) => setEditDraft((prev) => ({ ...prev, phone: e.target.value }))}
                                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none ring-primary/30 focus:ring-2"
                                    />
                                  ) : (
                                    <div className="text-slate-700">{entry.phone}</div>
                                  )}
                                </td>
                                <td className="px-3 py-2 align-top text-slate-600">
                                  {editing ? (
                                    <input
                                      value={editDraft.notes}
                                      onChange={(e) => setEditDraft((prev) => ({ ...prev, notes: e.target.value }))}
                                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none ring-primary/30 focus:ring-2"
                                    />
                                  ) : (
                                    entry.notes || '—'
                                  )}
                                </td>
                                <td className="px-3 py-2 align-top">
                                  {editing ? (
                                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                                      <input
                                        type="checkbox"
                                        checked={editDraft.showOnPlanCard}
                                        onChange={(e) => setEditDraft((prev) => ({ ...prev, showOnPlanCard: e.target.checked }))}
                                      />
                                      {t({ it: 'Scheda', en: 'Card' })}
                                    </label>
                                  ) : (
                                    <input
                                      type="checkbox"
                                      checked={entry.showOnPlanCard !== false}
                                      disabled={readOnly}
                                      onChange={(e) =>
                                        setContacts((prev) => prev.map((row) => (row.id === entry.id ? { ...row, showOnPlanCard: e.target.checked } : row)))
                                      }
                                    />
                                  )}
                                </td>
                                {!readOnly ? (
                                  <td className="px-3 py-2 text-right align-top">
                                    <div className="inline-flex items-center gap-1">
                                      {editing ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => saveEdit(entry.id)}
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                            title={t({ it: 'Salva modifica', en: 'Save edit' })}
                                          >
                                            <Check size={14} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={cancelEdit}
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                            title={t({ it: 'Annulla modifica', en: 'Cancel edit' })}
                                          >
                                            <RotateCcw size={14} />
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => startEdit(entry)}
                                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                          title={t({ it: 'Modifica', en: 'Edit' })}
                                        >
                                          <Pencil size={14} />
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => removeContact(entry.id)}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                        title={t({ it: 'Rimuovi', en: 'Remove' })}
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                ) : null}
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={readOnly ? 5 : 6} className="px-3 py-6 text-center text-sm text-slate-500">
                              {search.trim()
                                ? t({ it: 'Nessun risultato per la ricerca.', en: 'No results for this search.' })
                                : t({ it: 'Nessun numero configurato.', en: 'No numbers configured.' })}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                  <div className="flex items-center gap-2 bg-rose-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-rose-700">
                    <ShieldAlert size={14} />
                    {t({ it: 'Punti di raccolta', en: 'Assembly points' })}
                  </div>
                  <div className="max-h-[28vh] overflow-auto divide-y divide-slate-100">
                    {emergencyPoints.length ? (
                      emergencyPoints.map((point) => (
                        <div key={point.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                          <div>
                            <div className="font-semibold text-ink">{point.name}</div>
                            <div className="text-xs text-slate-600">
                              {point.siteName} · {point.planName}
                            </div>
                          </div>
                          <div className="text-right text-xs text-slate-600">
                            {point.mapsUrl ? (
                              <a
                                href={point.mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:text-sky-800 hover:underline"
                                title={t({ it: 'Apri in Google Maps', en: 'Open in Google Maps' })}
                              >
                                <ExternalLink size={12} />
                                {point.gps || point.coords}
                              </a>
                            ) : (
                              <div>{point.gps || point.coords}</div>
                            )}
                            <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                              <Crosshair size={11} /> {t({ it: 'Punto di raccolta', en: 'Assembly point' })}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-5 text-sm text-slate-500">
                        {t({ it: 'Nessun punto di raccolta presente nelle planimetrie.', en: 'No assembly points found on floor plans.' })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <button onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    {t({ it: 'Chiudi', en: 'Close' })}
                  </button>
                  {!readOnly ? (
                    <button onClick={saveContacts} className="inline-flex items-center gap-2 rounded-lg border border-primary bg-primary/10 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/20">
                      <Save size={14} />
                      {t({ it: 'Salva rubrica', en: 'Save directory' })}
                    </button>
                  ) : null}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default EmergencyContactsModal;
