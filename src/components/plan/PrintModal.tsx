import { Fragment, useEffect, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ChevronDown, ChevronRight, Crop, FileDown, X } from 'lucide-react';
import { useT } from '../../i18n/useT';
import { useDataStore } from '../../store/useDataStore';
import { exportPlansToPdf } from '../../utils/pdf';

type Tree = {
  clientId: string;
  clientName: string;
  sites: { siteId: string; siteName: string; plans: { planId: string; planName: string; hasPrintArea: boolean }[] }[];
};

interface Props {
  open: boolean;
  onClose: () => void;
  mode?: 'single' | 'multi';
  singlePlanId?: string;
}

const PrintModal = ({ open, onClose, mode = 'single', singlePlanId }: Props) => {
  const t = useT();
  const clients = useDataStore((s) => s.clients);
  const objectTypes = useDataStore((s) => s.objectTypes);
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [expandedSites, setExpandedSites] = useState<Record<string, boolean>>({});
  const [selectedPlanIds, setSelectedPlanIds] = useState<Record<string, boolean>>({});
  const [includeIndex, setIncludeIndex] = useState(true);
  const [includeObjects, setIncludeObjects] = useState(true);
  const [includeLinks, setIncludeLinks] = useState(true);
  const [includeRooms, setIncludeRooms] = useState(true);
  const [quality, setQuality] = useState(78); // 40..95
  const [busy, setBusy] = useState(false);

  const objectTypeIcons = useMemo(() => {
    const out: Record<string, any> = {};
    for (const d of objectTypes || []) out[d.id] = d.icon;
    return out;
  }, [objectTypes]);

  const tree: Tree[] = useMemo(() => {
    return (clients || []).map((c) => ({
      clientId: c.id,
      clientName: c.shortName || c.name,
      sites: (c.sites || []).map((s) => ({
        siteId: s.id,
        siteName: s.name,
        plans: (s.floorPlans || []).map((p) => ({
          planId: p.id,
          planName: p.name,
          hasPrintArea: !!(p as any).printArea
        }))
      }))
    }));
  }, [clients]);

  const flatPlans = useMemo(() => {
    const out: { planId: string; breadcrumb: string; hasPrintArea: boolean; plan: any }[] = [];
    for (const c of clients || []) {
      const cn = c.shortName || c.name;
      for (const s of c.sites || []) {
        for (const p of s.floorPlans || []) {
          out.push({
            planId: p.id,
            breadcrumb: `${cn} → ${s.name} → ${p.name}`,
            hasPrintArea: !!(p as any).printArea,
            plan: { ...p, _clientName: cn, _clientLogoUrl: (c as any).logoUrl || '' }
          });
        }
      }
    }
    return out;
  }, [clients]);

  const selected = useMemo(() => {
    if (mode === 'single' && singlePlanId) return flatPlans.filter((p) => p.planId === singlePlanId);
    return flatPlans.filter((p) => !!selectedPlanIds[p.planId]);
  }, [flatPlans, mode, selectedPlanIds, singlePlanId]);

  useEffect(() => {
    if (!open) return;
    if (mode === 'single') return;
    setExpandedClients({});
    setExpandedSites({});
    setSelectedPlanIds({});
  }, [mode, open]);

  const toggleAll = (value: boolean) => {
    if (mode === 'single') return;
    const next: Record<string, boolean> = {};
    for (const p of flatPlans) next[p.planId] = value;
    setSelectedPlanIds(next);
  };

  const qualityPreset = useMemo(() => {
    // Map slider 40..95 to export parameters.
    const q = Math.max(40, Math.min(95, quality));
    const jpegQuality = Math.max(0.6, Math.min(0.95, q / 100));
    const targetLongPx = Math.round(1400 + (q - 40) * 55); // ~1400..~4425
    return { jpegQuality, targetLongPx };
  }, [quality]);

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center px-4 py-8">
            <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Esporta PDF', en: 'Export PDF' })}</Dialog.Title>
                    <Dialog.Description className="mt-1 text-sm text-slate-600">
                      {t({
                        it:
                          mode === 'single'
                            ? 'Esporta la planimetria senza UI. Puoi includere opzionalmente oggetti, collegamenti e stanze.'
                            : 'Seleziona le planimetrie da includere nel PDF. L’export non include UI e può includere opzionalmente oggetti, collegamenti e stanze.',
                        en:
                          mode === 'single'
                            ? 'Exports the floor plan without UI. You can optionally include objects, links and rooms.'
                            : 'Select the floor plans to include in the PDF. The export has no UI and can optionally include objects, links and rooms.'
                      })}
                    </Dialog.Description>
                  </div>
                  <button onClick={onClose} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-ink">
                        {mode === 'single' ? t({ it: 'Planimetria', en: 'Floor plan' }) : t({ it: 'Selezione', en: 'Selection' })}
                      </div>
                      {mode === 'multi' ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleAll(true)}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {t({ it: 'Seleziona tutto', en: 'Select all' })}
                          </button>
                          <button
                            onClick={() => toggleAll(false)}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {t({ it: 'Deseleziona', en: 'Clear' })}
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {mode === 'single' ? (
                      <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50/40 p-4 text-sm text-slate-700">
                        <div className="font-semibold text-ink">{selected[0]?.breadcrumb || '—'}</div>
                        <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500">
                            <Crop size={14} />
                          </span>
                          {selected[0]?.hasPrintArea
                            ? t({ it: 'Area di stampa impostata: verrà esportata solo quell’area.', en: 'Print area set: only that area will be exported.' })
                            : t({ it: 'Area di stampa automatica: verrà adattata alla planimetria.', en: 'Auto print area: export will auto-fit the plan.' })}
                        </div>
                      </div>
                    ) : (
                    <div className="mt-2 max-h-[52vh] overflow-auto rounded-2xl border border-slate-200 bg-slate-50/40 p-2">
                      {tree.map((c) => {
                        const cOpen = !!expandedClients[c.clientId];
                        return (
                          <div key={c.clientId} className="rounded-xl bg-white p-2 shadow-sm">
                            <button
                              onClick={() => setExpandedClients((p) => ({ ...p, [c.clientId]: !cOpen }))}
                              className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold text-ink hover:bg-slate-50"
                            >
                              <span className="flex items-center gap-2">{cOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}{c.clientName}</span>
                            </button>
                            {cOpen ? (
                              <div className="mt-1 space-y-1 pl-2">
                                {c.sites.map((s) => {
                                  const skey = `${c.clientId}:${s.siteId}`;
                                  const sOpen = !!expandedSites[skey];
                                  return (
                                    <div key={s.siteId} className="rounded-lg border border-slate-200 bg-white">
                                      <button
                                        onClick={() => setExpandedSites((p) => ({ ...p, [skey]: !sOpen }))}
                                        className="flex w-full items-center justify-between gap-2 px-2 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                      >
                                        <span className="flex items-center gap-2">{sOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}{s.siteName}</span>
                                      </button>
                                      {sOpen ? (
                                        <div className="divide-y divide-slate-200">
                                          {s.plans.map((p) => (
                                            <label key={p.planId} className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                                              <span className="flex items-center gap-2">
                                                <input
                                                  type="checkbox"
                                                  checked={!!selectedPlanIds[p.planId]}
                                                  onChange={(e) => setSelectedPlanIds((prev) => ({ ...prev, [p.planId]: e.target.checked }))}
                                                />
                                                <span className="truncate font-medium">{p.planName}</span>
                                              </span>
                                              <span
                                                className={`flex h-7 w-7 items-center justify-center rounded-lg border ${
                                                  p.hasPrintArea ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-400'
                                                }`}
                                                title={p.hasPrintArea ? t({ it: 'Area di stampa impostata', en: 'Print area set' }) : t({ it: 'Area di stampa automatica', en: 'Auto print area' })}
                                              >
                                                <Crop size={14} />
                                              </span>
                                            </label>
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    )}
                  </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-sm font-semibold text-ink">{t({ it: 'Opzioni', en: 'Options' })}</div>
                      <label className="mt-3 flex items-center justify-between gap-2 text-sm font-semibold text-slate-700">
                        <span>{t({ it: 'Includi oggetti', en: 'Include objects' })}</span>
                        <input type="checkbox" checked={includeObjects} onChange={(e) => setIncludeObjects(e.target.checked)} />
                      </label>
                      <label className="mt-3 flex items-center justify-between gap-2 text-sm font-semibold text-slate-700">
                        <span>{t({ it: 'Includi collegamenti', en: 'Include links' })}</span>
                        <input type="checkbox" checked={includeLinks} onChange={(e) => setIncludeLinks(e.target.checked)} />
                      </label>
                      <label className="mt-3 flex items-center justify-between gap-2 text-sm font-semibold text-slate-700">
                        <span>{t({ it: 'Includi stanze', en: 'Include rooms' })}</span>
                        <input type="checkbox" checked={includeRooms} onChange={(e) => setIncludeRooms(e.target.checked)} />
                      </label>
                      <label className="mt-3 flex items-center justify-between gap-2 text-sm font-semibold text-slate-700">
                        <span>{t({ it: 'Indice cliccabile', en: 'Clickable index' })}</span>
                        <input type="checkbox" checked={includeIndex} onChange={(e) => setIncludeIndex(e.target.checked)} />
                      </label>

                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-700">{t({ it: 'Qualità PDF', en: 'PDF quality' })}</div>
                        <div className="text-xs font-semibold text-slate-600">{quality}%</div>
                      </div>
                      <input
                        type="range"
                        min={40}
                        max={95}
                        step={1}
                        value={quality}
                        onChange={(e) => setQuality(Number(e.target.value))}
                        className="mt-2 w-full"
                        title={t({ it: 'Qualità maggiore = PDF più pesante', en: 'Higher quality = larger PDF' })}
                      />
                      <div className="mt-1 text-[11px] text-slate-500">
                        {t({
                          it: `JPEG ${Math.round(qualityPreset.jpegQuality * 100)}% · ~${qualityPreset.targetLongPx}px lato lungo`,
                          en: `JPEG ${Math.round(qualityPreset.jpegQuality * 100)}% · ~${qualityPreset.targetLongPx}px long side`
                        })}
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                      <div className="font-semibold text-ink">{t({ it: 'Nota', en: 'Note' })}</div>
                      <div className="mt-1">
                        {t({
                          it: 'Se una planimetria ha un’area di stampa impostata, verrà esportata solo quell’area. Altrimenti l’export adatta automaticamente la stampa.',
                          en: 'If a floor plan has a print area set, only that area is exported. Otherwise the export auto-fits the full plan.'
                        })}
                      </div>
                    </div>

                    <div className="mt-5 flex justify-end gap-2">
                      <button
                        onClick={onClose}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        disabled={busy}
                      >
                        {t({ it: 'Annulla', en: 'Cancel' })}
                      </button>
                      <button
                        disabled={busy || !selected.length}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await exportPlansToPdf(
                              selected.map((s) => ({
                                breadcrumb: s.breadcrumb,
                                clientName: (s.plan as any)._clientName || '',
                                clientLogoUrl: (s.plan as any)._clientLogoUrl || '',
                                plan: s.plan
                              })),
                              {
                                includeIndex,
                                includeObjects,
                                includeLinks,
                                includeRooms,
                                objectTypeIcons,
                                jpegQuality: qualityPreset.jpegQuality,
                                targetLongPx: qualityPreset.targetLongPx
                              }
                            );
                            onClose();
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
                        title={t({ it: 'Crea PDF', en: 'Create PDF' })}
                      >
                        <FileDown size={16} />
                        {t({ it: 'Esporta PDF', en: 'Export PDF' })}
                      </button>
                    </div>

                    {!selected.length ? (
                      <div className="mt-3 text-xs font-semibold text-slate-500">
                        {t({ it: 'Seleziona almeno una planimetria.', en: 'Select at least one floor plan.' })}
                      </div>
                    ) : null}
                    {busy ? (
                      <div className="mt-3 text-xs font-semibold text-slate-600">{t({ it: 'Generazione PDF…', en: 'Generating PDF…' })}</div>
                    ) : null}
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

export default PrintModal;
