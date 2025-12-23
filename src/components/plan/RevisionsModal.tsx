import { Fragment, useEffect, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { History, Trash, X, Diff, Eraser, RotateCcw } from 'lucide-react';
import { FloorPlanRevision } from '../../store/types';
import { useDataStore } from '../../store/useDataStore';
import ConfirmDialog from '../ui/ConfirmDialog';
import Icon from '../ui/Icon';
import { useT } from '../../i18n/useT';

interface Props {
  open: boolean;
  revisions: FloorPlanRevision[];
  selectedRevisionId: string | null;
  breadcrumb?: string;
  onClose: () => void;
  onSelect: (revisionId: string) => void;
  onBackToPresent: () => void;
  onDelete: (revisionId: string) => void;
  onClearAll: () => void;
  onRestore?: (revisionId: string) => void;
  canRestore?: boolean;
}

const formatDate = (ts: number) => {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
};

const RevisionsModal = ({
  open,
  revisions,
  selectedRevisionId,
  breadcrumb,
  onClose,
  onSelect,
  onBackToPresent,
  onDelete,
  onClearAll,
  onRestore,
  canRestore = false
}: Props) => {
  const t = useT();
  const defs = useDataStore((s) => s.objectTypes);
  const [term, setTerm] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [diffOpenId, setDiffOpenId] = useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [comparePickOpen, setComparePickOpen] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const byId = useMemo(() => new Map(defs.map((d) => [d.id, d])), [defs]);
  const iconOf = (id: string) => byId.get(id)?.icon;

  useEffect(() => {
    if (!open) return;
    setTerm('');
    setComparePickOpen(false);
    setCompareOpen(false);
    setCompareIds([]);
  }, [open]);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return revisions;
    return revisions.filter((r) => {
      const by = (r as any)?.createdBy ? `${(r as any).createdBy.firstName || ''} ${(r as any).createdBy.lastName || ''} @${(r as any).createdBy.username || ''}` : '';
      const hay = `${r.name} ${r.description || ''} ${formatDate(r.createdAt)} ${by}`.toLowerCase();
      return hay.includes(q);
    });
  }, [revisions, term]);

  const formatAuthor = (r: FloorPlanRevision) => {
    const by: any = (r as any).createdBy;
    if (!by) return '';
    const full = `${String(by.firstName || '').trim()} ${String(by.lastName || '').trim()}`.trim();
    const user = String(by.username || '').trim();
    if (full && user) return `${full} (@${user})`;
    if (user) return `@${user}`;
    return full;
  };

  const diffs = useMemo(() => {
    const list = revisions;
    const map = new Map<
      string,
      { added: FloorPlanRevision['objects']; removed: FloorPlanRevision['objects'] }
    >();
    for (let i = 0; i < list.length; i++) {
      const cur = list[i];
      const prev = list[i + 1];
      const curIds = new Map(cur.objects.map((o) => [o.id, o]));
      const prevIds = new Map((prev?.objects || []).map((o) => [o.id, o]));
      const added: any[] = [];
      const removed: any[] = [];
      curIds.forEach((obj, id) => {
        if (!prevIds.has(id)) added.push(obj);
      });
      prevIds.forEach((obj, id) => {
        if (!curIds.has(id)) removed.push(obj);
      });
      map.set(cur.id, { added, removed });
    }
    return map;
  }, [revisions]);

  const formatRev = (r: FloorPlanRevision) => {
    if (typeof r.revMajor === 'number' && typeof r.revMinor === 'number') return `${r.revMajor}.${r.revMinor}`;
    const anyR: any = r as any;
    if (typeof anyR.version === 'number') return `1.${Math.max(0, anyR.version - 1)}`;
    return '1.0';
  };

  const compareSelection = useMemo(() => {
    if (compareIds.length !== 2) return null;
    const a = revisions.find((r) => r.id === compareIds[0]);
    const b = revisions.find((r) => r.id === compareIds[1]);
    if (!a || !b) return null;
    const newer = a.createdAt >= b.createdAt ? a : b;
    const older = newer.id === a.id ? b : a;
    return { newer, older };
  }, [compareIds, revisions]);

  const RevisionPreview = ({ rev }: { rev: FloorPlanRevision }) => {
    const w = Number(rev.width || 0);
    const h = Number(rev.height || 0);
    const aspect = w > 0 && h > 0 ? `${w}/${h}` : '16/9';
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="relative w-full bg-slate-50" style={{ aspectRatio: aspect }}>
          <img src={rev.imageUrl} alt="" className="absolute inset-0 h-full w-full object-contain" draggable={false} />
          {(rev.objects || []).map((o) => {
            const left = w > 0 ? (o.x / w) * 100 : 0;
            const top = h > 0 ? (o.y / h) * 100 : 0;
            const scale = Math.max(0.6, Math.min(2.2, Number(o.scale ?? 1)));
            return (
              <div
                key={o.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${left}%`, top: `${top}%` }}
              >
                <div className="pointer-events-none flex flex-col items-center">
                  <div className="text-[10px] font-semibold text-ink">{o.name}</div>
                  <div
                    className="mt-1 flex h-7 w-7 items-center justify-center rounded-xl border border-slate-200 bg-white text-primary shadow-sm"
                    style={{ transform: `scale(${scale})` }}
                  >
                    <Icon name={iconOf(o.type)} size={14} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
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
              <Dialog.Panel className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-card">
                <div className="flex items-center justify-between">
                  <Dialog.Title className="flex items-center gap-2 text-lg font-semibold text-ink">
                    <History size={18} className="text-primary" />
                    {t({ it: 'Time machine', en: 'Time machine' })}
                  </Dialog.Title>
                  <button onClick={onClose} className="text-slate-500 hover:text-ink">
                    <X size={18} />
                  </button>
                </div>
                {breadcrumb ? <div className="mt-1 text-xs text-slate-500">{breadcrumb}</div> : null}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <input
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    className="w-full flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                    placeholder={t({ it: 'Cerca nelle revisioni…', en: 'Search revisions…' })}
                  />
                  <button
                    onClick={() => {
                      onBackToPresent();
                      onClose();
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {t({ it: 'Torna al presente', en: 'Back to present' })}
                  </button>
                  <button
                    onClick={() => {
                      setComparePickOpen(true);
                      setCompareIds([]);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    title={t({ it: 'Confronta due revisioni', en: 'Compare two revisions' })}
                  >
                    <Diff size={16} />
                    {t({ it: 'Confronta', en: 'Compare' })}
                  </button>
                  <button
                    onClick={() => setConfirmClearAll(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                    title={t({ it: 'Elimina tutte le revisioni', en: 'Delete all revisions' })}
                  >
                    <Eraser size={16} />
                    {t({ it: 'Elimina tutte', en: 'Delete all' })}
                  </button>
                </div>

                <div className="mt-4 max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                  {!filtered.length ? (
                    <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                      {t({ it: 'Nessuna revisione trovata.', en: 'No revisions found.' })}
                    </div>
                  ) : (
                    filtered.map((r) => (
                      <div
                        key={r.id}
                        className={`w-full rounded-2xl border bg-white px-4 py-3 text-left transition hover:bg-slate-50 ${
                          selectedRevisionId === r.id ? 'border-primary bg-primary/5' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <button
                              onClick={() => {
                                onSelect(r.id);
                                onClose();
                              }}
                              className="w-full text-left"
                            >
                              <div className="truncate text-sm font-semibold text-ink">
                                {t({ it: 'Rev', en: 'Rev' })}: {formatRev(r)} · {r.name}
                              </div>
                              <div className="mt-0.5 text-xs text-slate-500">{formatDate(r.createdAt)}</div>
                              {formatAuthor(r) ? (
                                <div className="mt-0.5 text-xs text-slate-500">
                                  {t({ it: 'Da', en: 'By' })}: {formatAuthor(r)}
                                </div>
                              ) : null}
                              {r.description ? (
                                <div className="mt-1 line-clamp-2 text-sm text-slate-600">{r.description}</div>
                              ) : null}
                            </button>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <div className="text-right text-xs font-semibold text-slate-600">
                              {r.objects.length} {t({ it: 'ogg.', en: 'obj.' })}
                            </div>
                            {onRestore && canRestore ? (
                              <button
                                title={t({ it: 'Ripristina come attuale', en: 'Restore as current' })}
                                onClick={() => setConfirmRestoreId(r.id)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                              >
                                <RotateCcw size={14} />
                              </button>
                            ) : null}
                            <button
                              title={t({ it: 'Variazioni (aggiunti/rimossi)', en: 'Changes (added/removed)' })}
                              onClick={() => setDiffOpenId((prev) => (prev === r.id ? null : r.id))}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            >
                              <Diff size={14} />
                            </button>
                            <button
                              title={t({ it: 'Elimina revisione', en: 'Delete revision' })}
                              onClick={() => setConfirmDeleteId(r.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        </div>
                        {diffOpenId === r.id ? (
                          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            {(() => {
                              const d = diffs.get(r.id);
                              if (!d || (!d.added.length && !d.removed.length)) {
                                return (
                                  <div className="text-sm text-slate-600">
                                    {t({ it: 'Nessuna variazione rilevata.', en: 'No changes detected.' })}
                                  </div>
                                );
                              }
                              return (
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <div className="text-xs font-semibold uppercase text-slate-500">
                                      {t({ it: 'Aggiunti', en: 'Added' })}
                                    </div>
                                    <div className="mt-2 space-y-1">
                                      {d.added.length ? (
                                        d.added.slice(0, 8).map((o) => (
                                          <div key={o.id} className="flex items-center gap-2 text-sm text-slate-700">
                                            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-primary">
                                              <Icon name={iconOf(o.type)} />
                                            </span>
                                            <span className="truncate">{o.name}</span>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-sm text-slate-500">—</div>
                                      )}
                                      {d.added.length > 8 ? (
                                        <div className="text-xs text-slate-500">
                                          +{d.added.length - 8} {t({ it: 'altri…', en: 'more…' })}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-semibold uppercase text-slate-500">
                                      {t({ it: 'Rimossi', en: 'Removed' })}
                                    </div>
                                    <div className="mt-2 space-y-1">
                                      {d.removed.length ? (
                                        d.removed.slice(0, 8).map((o) => (
                                          <div key={o.id} className="flex items-center gap-2 text-sm text-slate-700">
                                            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-primary">
                                              <Icon name={iconOf(o.type)} />
                                            </span>
                                            <span className="truncate">{o.name}</span>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-sm text-slate-500">—</div>
                                      )}
                                      {d.removed.length > 8 ? (
                                        <div className="text-xs text-slate-500">
                                          +{d.removed.length - 8} {t({ it: 'altri…', en: 'more…' })}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-4 text-xs text-slate-500">
                  {t({
                    it: 'Le revisioni sono in sola lettura. Per creare una nuova revisione usa il tasto “Salva revisione” nella planimetria corrente.',
                    en: 'Revisions are read-only. To create a new revision, use “Save revision” in the current floor plan.'
                  })}
                </div>

                <ConfirmDialog
                  open={!!confirmDeleteId}
                  title={t({ it: 'Eliminare la revisione?', en: 'Delete this revision?' })}
                  description={
                    confirmDeleteId
                      ? t({
                          it: `Eliminare la revisione "${revisions.find((r) => r.id === confirmDeleteId)?.name || 'revisione'}"?`,
                          en: `Delete revision "${revisions.find((r) => r.id === confirmDeleteId)?.name || 'revision'}"?`
                        })
                      : undefined
                  }
                  onCancel={() => setConfirmDeleteId(null)}
                  onConfirm={() => {
                    if (!confirmDeleteId) return;
                    onDelete(confirmDeleteId);
                    setConfirmDeleteId(null);
                  }}
                  confirmLabel={t({ it: 'Elimina', en: 'Delete' })}
                  cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
                />

                <ConfirmDialog
                  open={confirmClearAll}
                  title={t({ it: 'Eliminare tutte le revisioni?', en: 'Delete all revisions?' })}
                  description={t({
                    it: 'Tutte le revisioni verranno eliminate. Operazione non annullabile.',
                    en: 'All revisions will be deleted. This cannot be undone.'
                  })}
                  onCancel={() => setConfirmClearAll(false)}
                  onConfirm={() => {
                    onClearAll();
                    setConfirmClearAll(false);
                  }}
                  confirmLabel={t({ it: 'Elimina tutte', en: 'Delete all' })}
                  cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
                />

                <ConfirmDialog
                  open={!!confirmRestoreId}
                  title={t({ it: 'Ripristinare questa revisione?', en: 'Restore this revision?' })}
                  description={t({
                    it: 'Procedendo, questa revisione diventerà lo stato attuale della planimetria (immagine, oggetti, stanze e viste).',
                    en: 'If you continue, this revision will become the current state of the floor plan (image, objects, rooms, and views).'
                  })}
                  onCancel={() => setConfirmRestoreId(null)}
                  onConfirm={() => {
                    if (!confirmRestoreId) return;
                    onRestore?.(confirmRestoreId);
                    setConfirmRestoreId(null);
                    onClose();
                  }}
                  confirmLabel={t({ it: 'Ripristina', en: 'Restore' })}
                  cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
                />

                <Transition show={comparePickOpen} as={Fragment}>
                  <Dialog as="div" className="relative z-[60]" onClose={() => setComparePickOpen(false)}>
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
                          <Dialog.Panel className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-card">
                            <div className="flex items-center justify-between">
                              <Dialog.Title className="flex items-center gap-2 text-lg font-semibold text-ink">
                                <Diff size={18} className="text-primary" />
                                {t({ it: 'Confronta revisioni', en: 'Compare revisions' })}
                              </Dialog.Title>
                              <button onClick={() => setComparePickOpen(false)} className="text-slate-500 hover:text-ink">
                                <X size={18} />
                              </button>
                            </div>
                            <div className="mt-1 text-sm text-slate-600">
                              {t({ it: 'Seleziona due revisioni (massimo 2).', en: 'Select two revisions (max 2).' })}
                            </div>

                            <div className="mt-4 max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                              {revisions.map((r) => {
                                const checked = compareIds.includes(r.id);
                                return (
                                  <button
                                    key={r.id}
                                    onClick={() => {
                                      setCompareIds((prev) => {
                                        if (prev.includes(r.id)) return prev.filter((id) => id !== r.id);
                                        if (prev.length >= 2) return prev;
                                        return [...prev, r.id];
                                      });
                                    }}
                                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                                      checked ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white'
                                    }`}
                                  >
                                    <div
                                      className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                                        checked ? 'border-primary bg-primary text-white' : 'border-slate-300 bg-white'
                                      }`}
                                    >
                                      {checked ? '✓' : ''}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate font-semibold text-ink">
                                        {t({ it: 'Rev', en: 'Rev' })}: {formatRev(r)} · {r.name}
                                      </div>
                                      <div className="mt-0.5 text-xs text-slate-500">{formatDate(r.createdAt)}</div>
                                    </div>
                                    <div className="text-xs font-semibold text-slate-600">
                                      {r.objects.length} {t({ it: 'ogg.', en: 'obj.' })}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>

                            <div className="mt-4 flex items-center justify-end gap-2">
                              <button
                                onClick={() => setCompareIds([])}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                {t({ it: 'Pulisci', en: 'Clear' })}
                              </button>
                              <button
                                disabled={compareIds.length !== 2}
                                onClick={() => {
                                  if (compareIds.length !== 2) return;
                                  setComparePickOpen(false);
                                  setCompareOpen(true);
                                }}
                                className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                              >
                                {t({ it: 'Confronta', en: 'Compare' })}
                              </button>
                            </div>
                          </Dialog.Panel>
                        </Transition.Child>
                      </div>
                    </div>
                  </Dialog>
                </Transition>

                {compareOpen && compareSelection ? (
                  <Transition show as={Fragment}>
                    <Dialog as="div" className="relative z-[60]" onClose={() => setCompareOpen(false)}>
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
                            <Dialog.Panel className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-card">
                              <div className="flex items-center justify-between">
                                <Dialog.Title className="flex items-center gap-2 text-lg font-semibold text-ink">
                                  <Diff size={18} className="text-primary" />
                                  {t({ it: 'Confronto revisioni', en: 'Revision compare' })}
                                </Dialog.Title>
                                <button onClick={() => setCompareOpen(false)} className="text-slate-500 hover:text-ink">
                                  <X size={18} />
                                </button>
                              </div>
                              <div className="mt-4 grid gap-4">
                                <div>
                                  <div className="text-sm font-semibold text-ink">
                                    {breadcrumb ? `${breadcrumb} · ` : ''}
                                    {t({ it: 'Nuova', en: 'Newer' })} (A) · {formatDate(compareSelection.newer.createdAt)}
                                  </div>
                                  <div className="mt-2">
                                    <RevisionPreview rev={compareSelection.newer} />
                                  </div>
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-ink">
                                    {breadcrumb ? `${breadcrumb} · ` : ''}
                                    {t({ it: 'Vecchia', en: 'Older' })} (B) · {formatDate(compareSelection.older.createdAt)}
                                  </div>
                                  <div className="mt-2">
                                    <RevisionPreview rev={compareSelection.older} />
                                  </div>
                                </div>
                              </div>
                            </Dialog.Panel>
                          </Transition.Child>
                        </div>
                      </div>
                    </Dialog>
                  </Transition>
                ) : null}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default RevisionsModal;
