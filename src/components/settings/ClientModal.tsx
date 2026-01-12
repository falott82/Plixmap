import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Eye, FileDown, Trash2, Upload, X } from 'lucide-react';
import { nanoid } from 'nanoid';
import { Client } from '../../store/types';
import { formatBytes, readFileAsDataUrl, uploadLimits, uploadMimes, validateFile } from '../../utils/files';
import { useToastStore } from '../../store/useToast';
import { useT } from '../../i18n/useT';

interface Props {
  open: boolean;
  initial?: Client | null;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    shortName?: string;
    address?: string;
    phone?: string;
    email?: string;
    vatId?: string;
    pecEmail?: string;
    description?: string;
    logoUrl?: string;
    attachments?: { id: string; name: string; dataUrl: string }[];
  }) => void;
}

const resizeLogo = async (dataUrl: string, size = 256): Promise<string> => {
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

const ClientModal = ({ open, initial, onClose, onSubmit }: Props) => {
  const t = useT();
  const push = useToastStore((s) => s.push);
  const [name, setName] = useState(''); // ragione sociale estesa
  const [shortName, setShortName] = useState(''); // nome breve (workspace)
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [vatId, setVatId] = useState('');
  const [pecEmail, setPecEmail] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [attachments, setAttachments] = useState<{ id: string; name: string; dataUrl: string }[]>([]);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name || '');
    setShortName(initial?.shortName || '');
    setAddress(initial?.address || '');
    setPhone(initial?.phone || '');
    setEmail(initial?.email || '');
    setVatId(initial?.vatId || '');
    setPecEmail(initial?.pecEmail || '');
    setDescription(initial?.description || '');
    setLogoUrl(initial?.logoUrl);
    setAttachments(initial?.attachments || []);
    window.setTimeout(() => nameRef.current?.focus(), 0);
  }, [initial, open]);

  const shortNameTrimmed = shortName.trim();
  const nameTrimmed = name.trim();
  const shortNameTooLong = shortNameTrimmed.length > 12;
  const canSubmit = useMemo(() => {
    if (!nameTrimmed) return false;
    if (!shortNameTrimmed) return false;
    if (shortNameTooLong) return false;
    return true;
  }, [nameTrimmed, shortNameTooLong, shortNameTrimmed]);

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      shortName: shortName.trim() || undefined,
      address: address.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      vatId: vatId.trim() || undefined,
      pecEmail: pecEmail.trim() || undefined,
      description: description.trim() || undefined,
      logoUrl,
      attachments: attachments.length ? attachments : undefined
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
              <Dialog.Panel className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-card">
                <div className="flex items-center justify-between">
                  <Dialog.Title className="text-lg font-semibold text-ink">
                    {initial ? t({ it: 'Modifica cliente', en: 'Edit client' }) : t({ it: 'Nuovo cliente', en: 'New client' })}
                  </Dialog.Title>
                  <button onClick={onClose} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Nome (breve)', en: 'Short name' })} <span className="text-rose-600">*</span>
                      <div
                        className="text-xs font-normal text-slate-500"
                        title={t({
                          it: 'Verrà mostrato nell’area di lavoro (sidebar e titoli).',
                          en: 'This will be shown in the workspace (sidebar and titles).'
                        })}
                      >
                        {t({ it: 'Verrà mostrato nell’area di lavoro', en: 'Shown in the workspace' })}
                      </div>
                      <input
                        ref={nameRef}
                        value={shortName}
                        onChange={(e) => setShortName(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder={t({ it: 'Es. ACME', en: 'e.g. ACME' })}
                        maxLength={12}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            submit();
                          }
                        }}
                      />
                      {shortNameTooLong ? (
                        <div className="mt-1 text-xs font-semibold text-rose-700">
                          {t({ it: 'Massimo 12 caratteri.', en: 'Max 12 characters.' })}
                        </div>
                      ) : null}
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Ragione sociale estesa', en: 'Full legal name' })}{' '}
                      <span className="text-rose-600">*</span>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder={t({ it: 'Es. ACME Inc.', en: 'e.g. ACME Inc.' })}
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Indirizzo', en: 'Address' })}
                      <input
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder={t({ it: 'Via...', en: 'Street...' })}
                      />
                    </label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="block text-sm font-medium text-slate-700">
                        {t({ it: 'Telefono azienda', en: 'Company phone' })}
                        <input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          placeholder="+39..."
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        {t({ it: 'Email', en: 'Email' })}
                        <input
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          placeholder="info@azienda.it"
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="block text-sm font-medium text-slate-700">
                        {t({ it: 'Partita IVA', en: 'VAT ID' })}
                        <input
                          value={vatId}
                          onChange={(e) => setVatId(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          placeholder="IT..."
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        {t({ it: 'Email PEC', en: 'PEC email' })}
                        <input
                          value={pecEmail}
                          onChange={(e) => setPecEmail(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          placeholder="pec@..."
                        />
                      </label>
                    </div>
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Descrizione', en: 'Description' })}
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        rows={3}
                        placeholder={t({ it: 'Note, contatti, ecc.', en: 'Notes, contacts, etc.' })}
                      />
                    </label>
                    <div className="text-xs text-slate-500">
                      {t({ it: '* I campi con asterisco sono obbligatori.', en: '* Fields marked with an asterisk are required.' })}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm font-semibold text-ink">{t({ it: 'Logo', en: 'Logo' })}</div>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
                          {logoUrl ? (
                            <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="text-xs font-semibold text-slate-400">{t({ it: 'Nessun logo', en: 'No logo' })}</div>
                          )}
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50">
                          <Upload size={16} className="text-slate-500" />
                          {t({ it: 'Carica', en: 'Upload' })}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const validation = validateFile(file, {
                                allowedTypes: uploadMimes.images,
                                maxBytes: uploadLimits.logoImageBytes
                              });
                              if (!validation.ok) {
                                push(
                                  validation.reason === 'size'
                                    ? t({
                                        it: `File troppo grande (max ${formatBytes(uploadLimits.logoImageBytes)}).`,
                                        en: `File too large (max ${formatBytes(uploadLimits.logoImageBytes)}).`
                                      })
                                    : t({
                                        it: 'Formato non supportato. Usa JPG, PNG o WEBP.',
                                        en: 'Unsupported format. Use JPG, PNG, or WEBP.'
                                      }),
                                  'danger'
                                );
                                e.currentTarget.value = '';
                                return;
                              }
                              const dataUrl = await readFileAsDataUrl(file);
                              const resized = await resizeLogo(dataUrl, 256);
                              setLogoUrl(resized);
                              e.currentTarget.value = '';
                            }}
                          />
                        </label>
                        {logoUrl ? (
                          <button
                            onClick={() => setLogoUrl(undefined)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            title={t({ it: 'Rimuovi il logo del cliente', en: 'Remove the client logo' })}
                          >
                            {t({ it: 'Rimuovi', en: 'Remove' })}
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        {t({ it: 'Formati accettati: JPG, PNG, WEBP.', en: 'Accepted formats: JPG, PNG, WEBP.' })}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {t({
                          it: `Max ${formatBytes(uploadLimits.logoImageBytes)}. Il logo viene ridimensionato automaticamente.`,
                          en: `Max ${formatBytes(uploadLimits.logoImageBytes)}. The logo is resized automatically.`
                        })}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-ink">{t({ it: 'Allegati PDF', en: 'PDF attachments' })}</div>
                          <div className="text-xs text-slate-500">
                            {t({ it: 'Carica documenti PDF associati al cliente.', en: 'Upload PDFs associated with this client.' })}
                          </div>
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50">
                          <Upload size={16} className="text-slate-500" />
                          {t({ it: 'Aggiungi', en: 'Add' })}
                          <input
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            multiple
                            onChange={async (e) => {
                              const files = Array.from(e.target.files || []);
                              if (!files.length) return;
                              const next: { id: string; name: string; dataUrl: string }[] = [];
                              for (const f of files) {
                                const validation = validateFile(f, {
                                  allowedTypes: uploadMimes.pdf,
                                  maxBytes: uploadLimits.pdfBytes
                                });
                                if (!validation.ok) {
                                  push(
                                    validation.reason === 'size'
                                      ? t({
                                          it: `PDF troppo grande (max ${formatBytes(uploadLimits.pdfBytes)}).`,
                                          en: `PDF too large (max ${formatBytes(uploadLimits.pdfBytes)}).`
                                        })
                                      : t({ it: 'Formato non supportato. Usa PDF.', en: 'Unsupported format. Use PDF.' }),
                                    'danger'
                                  );
                                  continue;
                                }
                                const dataUrl = await readFileAsDataUrl(f);
                                next.push({ id: nanoid(), name: f.name, dataUrl });
                              }
                              if (next.length) setAttachments((prev) => [...prev, ...next]);
                              e.currentTarget.value = '';
                            }}
                          />
                        </label>
                      </div>
                      <div className="mt-3 space-y-2">
                        {attachments.length ? (
                          attachments.map((a) => (
                            <div key={a.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                              <div className="min-w-0 truncate text-sm font-semibold text-ink">{a.name}</div>
                              <div className="flex items-center gap-2">
                                <a
                                  href={a.dataUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                                  title={t({ it: 'Apri', en: 'Open' })}
                                >
                                  <Eye size={16} />
                                </a>
                                <a
                                  href={a.dataUrl}
                                  download={a.name}
                                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                                  title={t({ it: 'Scarica', en: 'Download' })}
                                >
                                  <FileDown size={16} />
                                </a>
                                <button
                                  onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                  title={t({ it: 'Rimuovi', en: 'Remove' })}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-xl bg-white px-3 py-2 text-sm text-slate-600">
                            {t({ it: 'Nessun allegato.', en: 'No attachments.' })}
                          </div>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        {t({
                          it: `Formati accettati: PDF (max ${formatBytes(uploadLimits.pdfBytes)}).`,
                          en: `Accepted formats: PDF (max ${formatBytes(uploadLimits.pdfBytes)}).`
                        })}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {t({
                          it: 'Nota: i PDF vengono salvati sul server e referenziati nello stato.',
                          en: 'Note: PDFs are stored on the server and referenced from state.'
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={onClose}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    title={t({ it: 'Chiudi senza salvare le modifiche', en: 'Close without saving changes' })}
                  >
                    {t({ it: 'Annulla', en: 'Cancel' })}
                  </button>
                  <button
                    onClick={submit}
                    disabled={!canSubmit}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white enabled:hover:bg-primary/90 disabled:opacity-60"
                    title={t({ it: 'Salva le modifiche del cliente', en: 'Save client changes' })}
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

export default ClientModal;
