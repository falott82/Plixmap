import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Check, X } from 'lucide-react';
import { IconName, ObjectTypeDefinition } from '../../store/types';
import Icon from '../ui/Icon';
import { useT } from '../../i18n/useT';

const iconOptions: { name: IconName; label: { it: string; en: string } }[] = [
  { name: 'user', label: { it: 'Utente', en: 'User' } },
  { name: 'printer', label: { it: 'Stampante', en: 'Printer' } },
  { name: 'server', label: { it: 'Server/Rack', en: 'Server/Rack' } },
  { name: 'wifi', label: { it: 'Wi‑Fi', en: 'Wi‑Fi' } },
  { name: 'radio', label: { it: 'Radio/Antenna', en: 'Radio/Antenna' } },
  { name: 'tv', label: { it: 'Televisore', en: 'TV' } },
  { name: 'desktop', label: { it: 'PC fisso', en: 'Desktop' } },
  { name: 'laptop', label: { it: 'Portatile', en: 'Laptop' } },
  { name: 'camera', label: { it: 'Telecamera', en: 'Camera' } },
  { name: 'router', label: { it: 'Router', en: 'Router' } },
  { name: 'switch', label: { it: 'Switch', en: 'Switch' } },
  { name: 'phone', label: { it: 'Telefono', en: 'Phone' } },
  { name: 'tablet', label: { it: 'Tablet', en: 'Tablet' } },
  { name: 'database', label: { it: 'Database', en: 'Database' } },
  { name: 'shield', label: { it: 'Sicurezza', en: 'Security' } },
  { name: 'key', label: { it: 'Chiave', en: 'Key' } },
  { name: 'cctv', label: { it: 'CCTV', en: 'CCTV' } }
];

interface Props {
  open: boolean;
  initial?: ObjectTypeDefinition | null;
  onClose: () => void;
  onSubmit: (payload: { id: string; nameIt: string; nameEn: string; icon: IconName }) => void;
}

const normalizeId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '');

const ObjectTypeModal = ({ open, initial, onClose, onSubmit }: Props) => {
  const t = useT();
  const isEdit = !!initial;
  const idRef = useRef<HTMLInputElement | null>(null);
  const nameItRef = useRef<HTMLInputElement | null>(null);

  const [id, setId] = useState('');
  const [nameIt, setNameIt] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [icon, setIcon] = useState<IconName>('user');
  const [iconQuery, setIconQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    setId(initial?.id || '');
    setNameIt(initial?.name?.it || '');
    setNameEn(initial?.name?.en || '');
    setIcon(initial?.icon || 'user');
    setIconQuery('');
    window.setTimeout(() => (isEdit ? nameItRef.current?.focus() : idRef.current?.focus()), 0);
  }, [initial, isEdit, open]);

  const filteredIcons = useMemo(() => {
    const q = iconQuery.trim().toLowerCase();
    if (!q) return iconOptions;
    return iconOptions.filter((o) => `${o.name} ${o.label.it} ${o.label.en}`.toLowerCase().includes(q));
  }, [iconQuery]);

  const handleSave = () => {
    const nextId = isEdit ? (initial?.id || '') : normalizeId(id);
    if (!nextId) return;
    const it = nameIt.trim() || nextId;
    const en = nameEn.trim() || it;
    onSubmit({ id: nextId, nameIt: it, nameEn: en, icon });
    onClose();
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
                  <Dialog.Title className="text-lg font-semibold text-ink">
                    {isEdit ? t({ it: 'Modifica tipo oggetto', en: 'Edit object type' }) : t({ it: 'Nuovo tipo oggetto', en: 'New object type' })}
                  </Dialog.Title>
                  <button onClick={onClose} className="text-slate-500 hover:text-ink">
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">
                    ID
                    <input
                      ref={idRef}
                      value={id}
                      disabled={isEdit}
                      onChange={(e) => setId(isEdit ? e.target.value : normalizeId(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2 disabled:bg-slate-50"
                      placeholder="es: access-point"
                    />
                    <div className="mt-1 text-xs text-slate-500">
                      {t({ it: 'Usato internamente (stabile). Solo lettere/numeri, “-” e “_”.', en: 'Internal stable key. Letters/numbers, “-” and “_” only.' })}
                    </div>
                  </label>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Anteprima', en: 'Preview' })}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-primary shadow-sm">
                        <Icon name={icon} />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-ink">{nameIt.trim() || id || '—'}</div>
                        <div className="truncate text-xs text-slate-500">{nameEn.trim() || '—'}</div>
                      </div>
                    </div>
                  </div>

                  <label className="block text-sm font-medium text-slate-700">
                    {t({ it: 'Nome (IT)', en: 'Name (IT)' })}
                    <input
                      ref={nameItRef}
                      value={nameIt}
                      onChange={(e) => setNameIt(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({ it: 'es: Antenna Wi‑Fi', en: 'e.g. Wi‑Fi antenna' })}
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    {t({ it: 'Nome (EN)', en: 'Name (EN)' })}
                    <input
                      value={nameEn}
                      onChange={(e) => setNameEn(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({ it: 'es: Wi‑Fi antenna', en: 'e.g. Wi‑Fi antenna' })}
                    />
                  </label>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-700">{t({ it: 'Icona', en: 'Icon' })}</div>
                    <input
                      value={iconQuery}
                      onChange={(e) => setIconQuery(e.target.value)}
                      className="w-56 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({ it: 'Cerca icona…', en: 'Search icon…' })}
                    />
                  </div>
                  <div className="mt-3 grid max-h-56 grid-cols-4 gap-2 overflow-auto rounded-2xl border border-slate-200 bg-white p-2 md:grid-cols-6">
                    {filteredIcons.map((opt) => {
                      const active = opt.name === icon;
                      return (
                        <button
                          key={opt.name}
                          onClick={() => setIcon(opt.name)}
                          className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-semibold transition ${
                            active ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                          title={t(opt.label)}
                        >
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-primary shadow-sm">
                            <Icon name={opt.name} />
                          </span>
                          <span className="leading-tight">{t(opt.label)}</span>
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
                    onClick={handleSave}
                    disabled={!id.trim() && !isEdit}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Check size={16} />
                    {t({ it: 'Salva', en: 'Save' })}
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

export default ObjectTypeModal;

