import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { IconName, MapObjectType } from '../../store/types';
import Icon from '../ui/Icon';
import { useT } from '../../i18n/useT';
import { useCustomFieldsStore } from '../../store/useCustomFieldsStore';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { name: string; description?: string; layerIds?: string[]; customValues?: Record<string, any> }) => void;
  initialName?: string;
  initialDescription?: string;
  layers?: { id: string; label: string; color?: string }[];
  initialLayerIds?: string[];
  typeLabel?: string;
  type?: MapObjectType;
  icon?: IconName;
  objectId?: string;
  readOnly?: boolean;
}

const ObjectModal = ({
  open,
  onClose,
  onSubmit,
  initialName = '',
  initialDescription = '',
  layers = [],
  initialLayerIds = [],
  typeLabel,
  type,
  icon,
  objectId,
  readOnly = false
}: Props) => {
  const t = useT();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [layerIds, setLayerIds] = useState<string[]>(initialLayerIds);
  const [customValues, setCustomValues] = useState<Record<string, any>>({});
  const nameRef = useRef<HTMLInputElement | null>(null);
  const { hydrated, getFieldsForType, loadObjectValues } = useCustomFieldsStore();

  useEffect(() => {
    if (open) {
      setName(initialName);
      setDescription(initialDescription);
      setLayerIds(initialLayerIds);
      setCustomValues({});
      window.setTimeout(() => nameRef.current?.focus(), 0);
    }
  }, [open, initialDescription, initialLayerIds, initialName]);

  const customFields = useMemo(() => (type ? getFieldsForType(type) : []), [getFieldsForType, type]);

  useEffect(() => {
    if (!open) return;
    if (!hydrated) return;
    if (!objectId || !type) return;
    if (!customFields.length) return;
    loadObjectValues(objectId)
      .then((values) => setCustomValues(values || {}))
      .catch(() => setCustomValues({}));
  }, [customFields.length, hydrated, loadObjectValues, objectId, open, type]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      layerIds: layerIds.length ? layerIds : undefined,
      customValues: customFields.length ? customValues : undefined
    });
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
              <Dialog.Panel className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card">
                <div className="flex items-center justify-between">
                  <Dialog.Title className="text-lg font-semibold text-ink">
                    {initialName ? t({ it: 'Modifica oggetto', en: 'Edit object' }) : t({ it: 'Nuovo oggetto', en: 'New object' })}
                  </Dialog.Title>
                  <button onClick={onClose} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>
                {typeLabel ? (
                  <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                    {icon ? <Icon name={icon} className="text-primary" /> : type ? <Icon type={type} className="text-primary" /> : null}
                    {typeLabel}
                  </div>
                ) : null}
                <div className="mt-4 space-y-3">
                  <label className="block text-sm font-medium text-slate-700">
                    {t({ it: 'Nome', en: 'Name' })} <span className="text-rose-600">*</span>
                    <input
                      ref={nameRef}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSave();
                        }
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({ it: 'Es. Stampante HR', en: 'e.g. HR Printer' })}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    {t({ it: 'Descrizione', en: 'Description' })}
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({ it: 'Facoltativa', en: 'Optional' })}
                      rows={3}
                    />
                  </label>
                  {layers.length ? (
                    <div>
                      <div className="text-sm font-medium text-slate-700">{t({ it: 'Livelli', en: 'Layers' })}</div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {layers.map((l) => {
                          const on = layerIds.includes(l.id);
                          return (
                            <button
                              key={l.id}
                              type="button"
                              onClick={() =>
                                setLayerIds((prev) => (prev.includes(l.id) ? prev.filter((x) => x !== l.id) : [...prev, l.id]))
                              }
                              className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold ${
                                on ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                              }`}
                              title={l.label}
                            >
                              <span className="truncate">{l.label}</span>
                              <span className="ml-2 h-2 w-2 rounded-full" style={{ background: l.color || (on ? '#2563eb' : '#cbd5e1') }} />
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        {t({
                          it: 'Seleziona uno o più livelli: serve per filtrare e organizzare gli oggetti.',
                          en: 'Select one or more layers to filter and organize objects.'
                        })}
                      </div>
                    </div>
                  ) : null}

                  {customFields.length ? (
                    <div>
                      <div className="text-sm font-medium text-slate-700">{t({ it: 'Campi personalizzati', en: 'Custom fields' })}</div>
                      <div className="mt-2 space-y-2">
                        {customFields.map((f) => (
                          <label key={f.id} className="block text-sm font-medium text-slate-700">
                            <span className="flex items-center justify-between">
                              <span className="truncate">{f.label}</span>
                              <span className="ml-2 text-[11px] font-mono text-slate-400">{f.fieldKey}</span>
                            </span>
                            {f.valueType === 'boolean' ? (
                              <div className="mt-1 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                                <span className="text-sm text-slate-600">{t({ it: 'Valore', en: 'Value' })}</span>
                                <input
                                  type="checkbox"
                                  disabled={readOnly}
                                  checked={!!customValues[f.fieldKey]}
                                  onChange={(e) => setCustomValues((prev) => ({ ...prev, [f.fieldKey]: e.target.checked }))}
                                />
                              </div>
                            ) : f.valueType === 'number' ? (
                              <input
                                value={customValues[f.fieldKey] ?? ''}
                                disabled={readOnly}
                                onChange={(e) => setCustomValues((prev) => ({ ...prev, [f.fieldKey]: e.target.value }))}
                                inputMode="decimal"
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                placeholder={t({ it: 'Numero', en: 'Number' })}
                              />
                            ) : (
                              <input
                                value={customValues[f.fieldKey] ?? ''}
                                disabled={readOnly}
                                onChange={(e) => setCustomValues((prev) => ({ ...prev, [f.fieldKey]: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                placeholder={t({ it: 'Testo', en: 'Text' })}
                              />
                            )}
                          </label>
                        ))}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        {t({ it: 'Questi campi sono per-utente e non vengono condivisi.', en: 'These fields are per-user and not shared.' })}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    onClick={onClose}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {t({ it: 'Annulla', en: 'Cancel' })}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={readOnly}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold text-white ${readOnly ? 'bg-slate-300 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'}`}
                  >
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

export default ObjectModal;
