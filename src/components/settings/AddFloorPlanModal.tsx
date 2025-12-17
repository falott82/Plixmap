import { Fragment, useEffect, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Upload, X } from 'lucide-react';
import { readFileAsDataUrl } from '../../utils/files';

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
  const existing = useMemo(() => new Set(existingNames.map(normalize)), [existingNames]);
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    setName('');
    setImageUrl('');
    setSize(null);
    setError('');
  }, [open]);

  const onPickFile = async (fileList: FileList | null) => {
    if (!fileList || !fileList[0]) return;
    const dataUrl = await readFileAsDataUrl(fileList[0]);
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

  const canSubmit = !!name.trim() && !!imageUrl && !error;

  useEffect(() => {
    if (!open) return;
    const n = normalize(name);
    if (!n) {
      setError('');
      return;
    }
    if (existing.has(n)) {
      setError('Esiste già una planimetria con questo nome.');
      return;
    }
    setError('');
  }, [existing, name, open]);

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
                  <Dialog.Title className="text-lg font-semibold text-ink">Aggiungi planimetria</Dialog.Title>
                  <button onClick={onClose} className="text-slate-500 hover:text-ink">
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  <label className="block text-sm font-medium text-slate-700">
                    Nome
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder="Es. Piano Terra"
                    />
                  </label>
                  {error ? <div className="text-sm font-semibold text-rose-600">{error}</div> : null}

                  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm hover:border-primary">
                    <div className="flex items-center gap-2">
                      <Upload size={18} className="text-primary" />
                      <div className="text-slate-700">
                        {imageUrl
                          ? `Immagine caricata${size ? ` (${size.width}×${size.height})` : ''}`
                          : 'Carica immagine (JPG/PNG)'}
                      </div>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickFile(e.target.files)} />
                    <span className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white">Scegli</span>
                  </label>

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
                  >
                    Annulla
                  </button>
                  <button
                    disabled={!canSubmit}
                    onClick={() => {
                      if (!canSubmit) return;
                      onSubmit({ name: name.trim(), imageUrl, width: size?.width, height: size?.height });
                      onClose();
                    }}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white enabled:hover:bg-primary/90 disabled:opacity-50"
                  >
                    Aggiungi
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

