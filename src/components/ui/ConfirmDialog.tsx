import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { useT } from '../../i18n/useT';

interface Props {
  open: boolean;
  title: string;
  description?: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string | null;
}

const ConfirmDialog = ({
  open,
  title,
  description,
  onCancel,
  onConfirm,
  confirmLabel,
  cancelLabel
}: Props) => {
  const t = useT();
  const okLabel = confirmLabel || t({ it: 'Conferma', en: 'Confirm' });
  const noLabel = cancelLabel === undefined ? t({ it: 'Annulla', en: 'Cancel' }) : cancelLabel;
  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onCancel}>
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
        <div className="flex min-h-full items-center justify-center p-4 text-center">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-card transition-all">
              <div className="flex items-center justify-between">
                <Dialog.Title className="text-lg font-semibold text-ink">{title}</Dialog.Title>
                <button
                  onClick={onCancel}
                  className="text-slate-400 hover:text-ink"
                  title={t({ it: 'Chiudi', en: 'Close' })}
                >
                  <X size={18} />
                </button>
              </div>
              {description ? (
                <Dialog.Description className="mt-2 text-sm text-slate-600">
                  {description}
                </Dialog.Description>
              ) : null}
              <div className="mt-6 flex justify-end gap-2">
                {cancelLabel === null ? null : (
                  <button
                    onClick={onCancel}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {noLabel}
                  </button>
                )}
                <button
                  onClick={onConfirm}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                >
                  {okLabel}
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

export default ConfirmDialog;
