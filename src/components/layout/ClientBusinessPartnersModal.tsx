import { Fragment, useEffect, useMemo, useState } from 'react';
import { Transition } from '@headlessui/react';
import { Building2, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { nanoid } from 'nanoid';
import { BusinessPartner, Client } from '../../store/types';
import { useT } from '../../i18n/useT';
import { useToastStore } from '../../store/useToast';
import { formatBytes, readFileAsDataUrl, uploadLimits, uploadMimes, validateFile } from '../../utils/files';

interface Props {
  open: boolean;
  client?: Client | null;
  onClose: () => void;
  onSave: (businessPartners: BusinessPartner[]) => void;
}

const resizeLogo = async (dataUrl: string, size = 192): Promise<string> => {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  const x = (size - w) / 2;
  const y = (size - h) / 2;
  ctx.drawImage(img, x, y, w, h);
  return canvas.toDataURL('image/png');
};

const normalizeList = (list: BusinessPartner[]) =>
  [...(Array.isArray(list) ? list : [])]
    .map((bp) => ({
      id: String(bp?.id || nanoid()),
      name: String(bp?.name || '').trim(),
      email: String(bp?.email || '').trim() || undefined,
      phone: String(bp?.phone || '').trim() || undefined,
      notes: String(bp?.notes || '').trim() || undefined,
      logoUrl: String(bp?.logoUrl || '').trim() || undefined
    }))
    .filter((bp) => !!bp.name)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

const ClientBusinessPartnersModal = ({ open, client, onClose, onSave }: Props) => {
  const t = useT();
  const push = useToastStore((s) => s.push);
  const [rows, setRows] = useState<BusinessPartner[]>([]);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<{ name: string; email: string; phone: string; notes: string; logoUrl?: string }>({
    name: '',
    email: '',
    phone: '',
    notes: '',
    logoUrl: undefined
  });

  useEffect(() => {
    if (!open) return;
    setRows(normalizeList(((client as any)?.businessPartners || []) as BusinessPartner[]));
    setQuery('');
    setDraft({ name: '', email: '', phone: '', notes: '', logoUrl: undefined });
  }, [client, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose, open]);

  const canSave = useMemo(() => rows.every((bp) => String(bp.name || '').trim().length > 0), [rows]);
  const filteredRows = useMemo(() => {
    const q = String(query || '').trim().toLocaleLowerCase();
    if (!q) return rows;
    return rows.filter((bp) => {
      const name = String(bp.name || '').toLocaleLowerCase();
      const email = String(bp.email || '').toLocaleLowerCase();
      const phone = String(bp.phone || '').toLocaleLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [query, rows]);

  return (
    <Transition show={open} as={Fragment}>
      <div className="relative z-[120]" role="dialog" aria-modal="true" aria-label={t({ it: 'Rubrica Business Partner', en: 'Business partner directory' })}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          />
        </Transition.Child>
        <div
          className="fixed inset-0 overflow-y-auto p-4"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex min-h-full items-center justify-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-150"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-100"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <div
                className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-4 shadow-card"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <h2 className="text-lg font-semibold text-ink">
                      {t({ it: 'Rubrica Business Partner', en: 'Business partner directory' })}
                    </h2>
                    <div className="text-xs text-slate-500">
                      {(client?.shortName || client?.name || '-') +
                        ' • ' +
                        t({ it: 'Partner esterni usati nei meeting', en: 'External partners used in meetings' })}
                    </div>
                  </div>
                  <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink">
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-ink">{t({ it: 'Nuovo Business Partner', en: 'New business partner' })}</div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                      <Building2 size={12} />
                      {rows.length}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <input
                      value={draft.name}
                      onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder={t({ it: 'Nome partner *', en: 'Partner name *' })}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                    <input
                      value={draft.email}
                      onChange={(e) => setDraft((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder={t({ it: 'Email (opzionale)', en: 'Email (optional)' })}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                    <input
                      value={draft.phone}
                      onChange={(e) => setDraft((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder={t({ it: 'Telefono (opzionale)', en: 'Phone (optional)' })}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-slate-50">
                      <Upload size={14} className="text-slate-500" />
                      {t({ it: 'Logo partner', en: 'Partner logo' })}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const validation = validateFile(file, { allowedTypes: uploadMimes.images, maxBytes: uploadLimits.logoImageBytes });
                          if (!validation.ok) {
                            push(t({ it: 'Logo partner non valido.', en: 'Invalid partner logo.' }), 'danger');
                            e.currentTarget.value = '';
                            return;
                          }
                          const dataUrl = await readFileAsDataUrl(file);
                          const resized = await resizeLogo(dataUrl, 192);
                          setDraft((prev) => ({ ...prev, logoUrl: resized }));
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>
                    {draft.logoUrl ? (
                      <button
                        type="button"
                        onClick={() => setDraft((prev) => ({ ...prev, logoUrl: undefined }))}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {t({ it: 'Rimuovi logo draft', en: 'Remove draft logo' })}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        const name = draft.name.trim();
                        if (!name) {
                          push(t({ it: 'Inserisci il nome del partner.', en: 'Enter partner name.' }), 'danger');
                          return;
                        }
                        const normalizedName = name.toLocaleLowerCase();
                        if (rows.some((bp) => String(bp.name || '').trim().toLocaleLowerCase() === normalizedName)) {
                          push(t({ it: 'Business Partner già presente.', en: 'Business partner already exists.' }), 'danger');
                          return;
                        }
                        setRows((prev) =>
                          normalizeList([
                            ...prev,
                            {
                              id: nanoid(),
                              name,
                                email: draft.email.trim() || undefined,
                                phone: draft.phone.trim() || undefined,
                                logoUrl: draft.logoUrl
                              }
                            ] as BusinessPartner[])
                        );
                        setDraft({ name: '', email: '', phone: '', notes: '', logoUrl: undefined });
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      <Plus size={14} />
                      {t({ it: 'Aggiungi partner', en: 'Add partner' })}
                    </button>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {t({
                      it: `Formati logo: JPG/PNG/WEBP (max ${formatBytes(uploadLimits.logoImageBytes)}).`,
                      en: `Logo formats: JPG/PNG/WEBP (max ${formatBytes(uploadLimits.logoImageBytes)}).`
                    })}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="relative">
                    <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t({ it: 'Cerca partner per nome, email o telefono...', en: 'Search partners by name, email or phone...' })}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm"
                    />
                  </div>
                </div>

                <div className="mt-3 max-h-[48vh] space-y-2 overflow-auto pr-1">
                  {filteredRows.length ? (
                    filteredRows.map((bp) => (
                      <div key={bp.id} className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto,1fr,auto] sm:items-center">
                          <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                            {bp.logoUrl ? <img src={bp.logoUrl} alt="" className="h-full w-full object-cover" /> : <Building2 size={16} className="text-slate-400" />}
                          </div>
                          <div className="min-w-0">
                            <input
                              value={bp.name}
                              onChange={(e) => setRows((prev) => prev.map((row) => (row.id === bp.id ? { ...row, name: e.target.value } : row)))}
                              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-semibold"
                            />
                            <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
                              <input
                                value={bp.email || ''}
                                onChange={(e) => setRows((prev) => prev.map((row) => (row.id === bp.id ? { ...row, email: e.target.value || undefined } : row)))}
                                placeholder={t({ it: 'Email', en: 'Email' })}
                                className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                              />
                              <input
                                value={bp.phone || ''}
                                onChange={(e) => setRows((prev) => prev.map((row) => (row.id === bp.id ? { ...row, phone: e.target.value || undefined } : row)))}
                                placeholder={t({ it: 'Telefono', en: 'Phone' })}
                                className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                              <Upload size={12} />
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  const validation = validateFile(file, { allowedTypes: uploadMimes.images, maxBytes: uploadLimits.logoImageBytes });
                                  if (!validation.ok) {
                                    push(t({ it: 'Logo partner non valido.', en: 'Invalid partner logo.' }), 'danger');
                                    e.currentTarget.value = '';
                                    return;
                                  }
                                  const dataUrl = await readFileAsDataUrl(file);
                                  const resized = await resizeLogo(dataUrl, 192);
                                  setRows((prev) => prev.map((row) => (row.id === bp.id ? { ...row, logoUrl: resized } : row)));
                                  e.currentTarget.value = '';
                                }}
                              />
                              {t({ it: 'Logo', en: 'Logo' })}
                            </label>
                            <button
                              type="button"
                              onClick={() => setRows((prev) => prev.filter((row) => row.id !== bp.id))}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                              title={t({ it: 'Rimuovi partner', en: 'Remove partner' })}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                      {query
                        ? t({ it: 'Nessun risultato per la ricerca.', en: 'No results for this search.' })
                        : t({ it: 'Nessun business partner configurato.', en: 'No business partners configured.' })}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button type="button" onClick={onClose} className="btn-secondary">
                    {t({ it: 'Chiudi', en: 'Close' })}
                  </button>
                  <button
                    type="button"
                    disabled={!canSave}
                    onClick={() => onSave(normalizeList(rows))}
                    className="btn-primary disabled:opacity-60"
                  >
                    {t({ it: 'Salva rubrica', en: 'Save directory' })}
                  </button>
                </div>
              </div>
            </Transition.Child>
          </div>
        </div>
      </div>
    </Transition>
  );
};

export default ClientBusinessPartnersModal;
