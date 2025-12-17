import { Fragment, useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Check, X } from 'lucide-react';
import { PdfExportOptions, PdfOrientation } from '../../utils/pdf';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (options: PdfExportOptions) => void;
}

const PdfExportModal = ({ open, onClose, onConfirm }: Props) => {
  const [orientation, setOrientation] = useState<PdfOrientation>('auto');
  const [includeList, setIncludeList] = useState(true);

  useEffect(() => {
    if (!open) return;
    setOrientation('auto');
    setIncludeList(true);
  }, [open]);

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
                  <Dialog.Title className="text-lg font-semibold text-ink">Esporta PDF</Dialog.Title>
                  <button onClick={onClose} className="text-slate-500 hover:text-ink">
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-700">Orientamento</div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {([
                        { value: 'auto', label: 'Auto' },
                        { value: 'landscape', label: 'Orizz.' },
                        { value: 'portrait', label: 'Vert.' }
                      ] as const).map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setOrientation(opt.value)}
                          className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                            orientation === opt.value
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      Auto sceglie in base alle proporzioni della planimetria.
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={includeList}
                      onChange={(e) => setIncludeList(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-primary"
                    />
                    Includi lista oggetti
                  </label>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={onClose}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={() => {
                      onConfirm({ orientation, includeList });
                      onClose();
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                  >
                    <Check size={16} />
                    Esporta
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

export default PdfExportModal;

