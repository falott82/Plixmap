import { Fragment, useRef } from 'react';
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
  confirmOnEnter?: boolean;
}

const ConfirmDialog = ({
  open,
  title,
  description,
  onCancel,
  onConfirm,
  confirmLabel,
  cancelLabel,
  confirmOnEnter = false
}: Props) => {
  const t = useT();
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const okLabel = confirmLabel || t({ it: 'Conferma', en: 'Confirm' });
  const noLabel = cancelLabel === undefined ? t({ it: 'Annulla', en: 'Cancel' }) : cancelLabel;
  const initialFocus = cancelLabel === null ? confirmRef : cancelRef;
  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onCancel} initialFocus={initialFocus}>
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
            <Dialog.Panel
              className="modal-panel w-full max-w-md transform overflow-hidden text-left align-middle transition-all"
              onKeyDown={(e) => {
                if (!confirmOnEnter) return;
                if (e.key !== 'Enter') return;
                e.preventDefault();
                onConfirm();
              }}
            >
              <div className="modal-header">
                <Dialog.Title className="modal-title">{title}</Dialog.Title>
                <button
                  onClick={onCancel}
                  className="icon-button"
                  title={t({ it: 'Chiudi', en: 'Close' })}
                >
                  <X size={18} />
                </button>
              </div>
              {description ? (
                <Dialog.Description className="modal-description">{description}</Dialog.Description>
              ) : null}
              <div className="modal-footer">
                {cancelLabel === null ? null : (
                  <button
                    ref={cancelRef}
                    onClick={onCancel}
                    className="btn-secondary"
                  >
                    {noLabel}
                  </button>
                )}
                <button
                  ref={confirmRef}
                  onClick={onConfirm}
                  className="btn-primary"
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
