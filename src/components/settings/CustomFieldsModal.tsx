import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Plus, Trash2, X } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { useToastStore } from '../../store/useToast';
import { useCustomFieldsStore } from '../../store/useCustomFieldsStore';
import { createCustomField, deleteCustomField, updateCustomField, type CustomFieldValueType } from '../../api/customFields';
import { useLang, useT } from '../../i18n/useT';

interface Props {
  open: boolean;
  initialTypeId?: string;
  lockType?: boolean;
  onClose: () => void;
}

const CustomFieldsModal = ({ open, initialTypeId, lockType = false, onClose }: Props) => {
  const t = useT();
  const lang = useLang();
  const defs = useDataStore((s) => s.objectTypes);
  const { push } = useToastStore();
  const { fields, refresh } = useCustomFieldsStore();

  const [typeId, setTypeId] = useState<string>('');
  const [label, setLabel] = useState('');
  const [valueType, setValueType] = useState<CustomFieldValueType>('string');
  const [busy, setBusy] = useState(false);
  const labelRef = useRef<HTMLInputElement | null>(null);

  const types = useMemo(() => {
    const list = (defs || []).slice();
    list.sort((a, b) => ((a?.name?.[lang] || a.id) as string).localeCompare((b?.name?.[lang] || b.id) as string));
    return list;
  }, [defs, lang]);

  useEffect(() => {
    if (!open) return;
    const firstType = (defs || [])[0]?.id || '';
    setTypeId(initialTypeId || firstType);
    setLabel('');
    setValueType('string');
    window.setTimeout(() => labelRef.current?.focus(), 0);
  }, [defs, initialTypeId, open]);

  const fieldsForType = useMemo(() => fields.filter((f) => f.typeId === typeId), [fields, typeId]);

  const canSubmit = !!typeId && !!label.trim();

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await createCustomField({ typeId, label: label.trim(), valueType });
      await refresh();
      push(t({ it: 'Campo creato', en: 'Field created' }), 'success');
      setLabel('');
      window.setTimeout(() => labelRef.current?.focus(), 0);
    } catch {
      push(t({ it: 'Impossibile creare il campo', en: 'Could not create field' }), 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[60]" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center px-4 py-8">
            <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-3xl modal-panel">
                <div className="modal-header items-center">
                  <Dialog.Title className="modal-title">{t({ it: 'Campi personalizzati', en: 'Custom fields' })}</Dialog.Title>
                  <button onClick={onClose} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>

                <div className="modal-description">
                  {t({
                    it: 'Crea campi per arricchire gli oggetti (es. IP, seriale, note tecniche). Sono per-utente e non modificano i dati degli altri utenti.',
                    en: 'Create fields to enrich objects (e.g. IP, serial, technical notes). They are per-user and do not change other users’ data.'
                  })}
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="text-sm font-semibold text-ink">{t({ it: 'Nuovo campo', en: 'New field' })}</div>
                    <div className="mt-3 grid grid-cols-1 gap-3">
                      {!lockType ? (
                        <label className="text-sm font-medium text-slate-700">
                          {t({ it: 'Tipo oggetto', en: 'Object type' })}
                          <select
                            value={typeId}
                            onChange={(e) => setTypeId(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          >
                            {types.map((d) => (
                              <option key={d.id} value={d.id}>
                                {(d?.name?.[lang] as string) || (d?.name?.it as string) || d.id}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}

                      <label className="text-sm font-medium text-slate-700">
                        {t({ it: 'Etichetta', en: 'Label' })}
                        <input
                          ref={labelRef}
                          value={label}
                          onChange={(e) => setLabel(e.target.value)}
                          placeholder={t({ it: 'es. Indirizzo IP', en: 'e.g. IP address' })}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submit();
                          }}
                        />
                      </label>

                      <label className="text-sm font-medium text-slate-700">
                        {t({ it: 'Tipo campo', en: 'Field type' })}
                        <select
                          value={valueType}
                          onChange={(e) => setValueType(e.target.value as CustomFieldValueType)}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        >
                          <option value="string">{t({ it: 'Testo', en: 'Text' })}</option>
                          <option value="number">{t({ it: 'Numero', en: 'Number' })}</option>
                          <option value="boolean">{t({ it: 'Booleano', en: 'Boolean' })}</option>
                        </select>
                      </label>

                      <button
                        disabled={busy || !canSubmit}
                        onClick={submit}
                        className={`mt-1 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white ${
                          busy || !canSubmit ? 'cursor-not-allowed bg-slate-300' : 'bg-primary hover:bg-primary/90'
                        }`}
                        title={t({ it: 'Aggiungi il campo personalizzato', en: 'Add the custom field' })}
                      >
                        <Plus size={16} /> {t({ it: 'Aggiungi', en: 'Add' })}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-ink">{t({ it: 'Campi per tipo', en: 'Fields for type' })}</div>
                      <div className="text-xs text-slate-500">{t({ it: `${fieldsForType.length} campi`, en: `${fieldsForType.length} fields` })}</div>
                    </div>
                    <div className="mt-3 max-h-[420px] space-y-2 overflow-auto">
                      {fieldsForType.length ? (
                        fieldsForType.map((f) => (
                          <div key={f.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-ink" title={f.fieldKey}>
                                {f.label}
                              </div>
                              <div className="truncate text-xs text-slate-500">{f.valueType}</div>
                            </div>
                            <button
                              onClick={async () => {
                                const next = window.prompt(t({ it: 'Nuova etichetta', en: 'New label' }), f.label);
                                if (!next || !next.trim()) return;
                                try {
                                  await updateCustomField(f.id, { label: next.trim() });
                                  await refresh();
                                  push(t({ it: 'Campo aggiornato', en: 'Field updated' }), 'success');
                                } catch {
                                  push(t({ it: 'Aggiornamento non riuscito', en: 'Update failed' }), 'danger');
                                }
                              }}
                              className="btn-inline"
                              title={t({ it: 'Rinomina il campo', en: 'Rename the field' })}
                            >
                              {t({ it: 'Rinomina', en: 'Rename' })}
                            </button>
                            <button
                              onClick={async () => {
                                if (!window.confirm(t({ it: `Eliminare il campo "${f.label}"?`, en: `Delete field "${f.label}"?` }))) return;
                                try {
                                  await deleteCustomField(f.id);
                                  await refresh();
                                  push(t({ it: 'Campo eliminato', en: 'Field deleted' }), 'info');
                                } catch {
                                  push(t({ it: 'Eliminazione non riuscita', en: 'Delete failed' }), 'danger');
                                }
                              }}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                              title={t({ it: 'Elimina', en: 'Delete' })}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
                          {t({ it: 'Nessun campo per questo tipo.', en: 'No fields for this type.' })}
                        </div>
                      )}
                    </div>
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

export default CustomFieldsModal;
