import { Fragment, useEffect, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Upload, X } from 'lucide-react';
import { formatBytes, readFileAsDataUrl, uploadLimits, uploadMimes, validateFile } from '../../utils/files';
import { useT } from '../../i18n/useT';

interface Payload {
  name: string;
  imageUrl: string;
  width?: number;
  height?: number;
}

interface Props {
  open: boolean;
  existingNames: string[];
  onClose: () => void;
  onSubmit: (payload: Payload) => void;
}

const normalize = (value: string) => value.trim().toLowerCase();

const AddFloorPlanModal = ({ open, existingNames, onClose, onSubmit }: Props) => {
  const t = useT();
  const existing = useMemo(() => new Set(existingNames.map(normalize)), [existingNames]);
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [error, setError] = useState<string>('');
  const [fileError, setFileError] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    setName('');
    setImageUrl('');
    setSize(null);
    setError('');
    setFileError('');
  }, [open]);

  const onPickFile = async (fileList: FileList | null) => {
    if (!fileList || !fileList[0]) return;
    const file = fileList[0];
    const validation = validateFile(file, {
      allowedTypes: uploadMimes.images,
      maxBytes: uploadLimits.planImageBytes
    });
    if (!validation.ok) {
      setFileError(
        validation.reason === 'size'
          ? t({
              it: `File troppo grande (max ${formatBytes(uploadLimits.planImageBytes)}).`,
              en: `File too large (max ${formatBytes(uploadLimits.planImageBytes)}).`
            })
          : t({
              it: 'Formato non supportato. Usa JPG, PNG o WEBP.',
              en: 'Unsupported format. Use JPG, PNG, or WEBP.'
            })
      );
      setImageUrl('');
      setSize(null);
      return;
    }
    setFileError('');
    const dataUrl = await readFileAsDataUrl(file);
    setImageUrl(dataUrl);
    setSize(null);
    try {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      setSize({ width: img.naturalWidth, height: img.naturalHeight });
    } catch {
      // ignore
    }
  };

  const canSubmit = !!name.trim() && !!imageUrl && !error && !fileError;

  useEffect(() => {
    if (!open) return;
    const n = normalize(name);
    if (!n) {
      setError('');
      return;
    }
    if (existing.has(n)) {
      setError(t({ it: 'Esiste già una planimetria con questo nome.', en: 'A floor plan with this name already exists.' }));
      return;
    }
    setError('');
  }, [existing, name, open, t]);

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
              <Dialog.Panel className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-card">
                <div className="flex items-center justify-between">
                  <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Aggiungi planimetria', en: 'Add floor plan' })}</Dialog.Title>
                  <button onClick={onClose} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  <label className="block text-sm font-medium text-slate-700">
                    {t({ it: 'Nome', en: 'Name' })} <span className="text-rose-600">*</span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({ it: 'Es. Piano Terra', en: 'e.g. Ground floor' })}
                    />
                  </label>
                  {error ? <div className="text-sm font-semibold text-rose-600">{error}</div> : null}

                  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm hover:border-primary">
                    <div className="flex items-center gap-2">
                      <Upload size={18} className="text-primary" />
                      <div className="text-slate-700">
                        {imageUrl
                          ? t({
                              it: `Immagine caricata${size ? ` (${size.width}×${size.height})` : ''}`,
                              en: `Image uploaded${size ? ` (${size.width}×${size.height})` : ''}`
                            })
                          : t({ it: 'Carica immagine (JPG/PNG)', en: 'Upload image (JPG/PNG)' })}
                      </div>
                    </div>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => onPickFile(e.target.files)}
                    />
                    <span className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white">
                      {t({ it: 'Scegli', en: 'Choose' })}
                    </span>
                  </label>
                  <div className="text-xs text-slate-500">
                    {t({
                      it: `Formati accettati: JPG, PNG, WEBP (max ${formatBytes(uploadLimits.planImageBytes)}).`,
                      en: `Accepted formats: JPG, PNG, WEBP (max ${formatBytes(uploadLimits.planImageBytes)}).`
                    })}
                  </div>
                  {fileError ? <div className="text-sm font-semibold text-rose-600">{fileError}</div> : null}

                  {imageUrl ? (
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                      <img src={imageUrl} alt="preview" className="h-40 w-full object-contain" />
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={onClose}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    title={t({ it: 'Chiudi senza creare la planimetria', en: 'Close without creating the floor plan' })}
                  >
                    {t({ it: 'Annulla', en: 'Cancel' })}
                  </button>
                  <button
                    disabled={!canSubmit}
                    onClick={() => {
                      if (!canSubmit) return;
                      onSubmit({ name: name.trim(), imageUrl, width: size?.width, height: size?.height });
                      onClose();
                    }}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white enabled:hover:bg-primary/90 disabled:opacity-50"
                    title={t({ it: 'Crea la nuova planimetria', en: 'Create the new floor plan' })}
                  >
                    {t({ it: 'Aggiungi', en: 'Add' })}
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

export default AddFloorPlanModal;
