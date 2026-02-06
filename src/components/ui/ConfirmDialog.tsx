import { Fragment, useEffect, useRef, useState } from 'react';
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
  confirmPhrase?: string;
  confirmPhraseLabel?: string;
  confirmPhrasePlaceholder?: string;
  confirmPhraseHint?: string;
}

const ConfirmDialog = ({
  open,
  title,
  description,
  onCancel,
  onConfirm,
  confirmLabel,
  cancelLabel,
  confirmOnEnter = false,
  confirmPhrase,
  confirmPhraseLabel,
  confirmPhrasePlaceholder,
  confirmPhraseHint
}: Props) => {
  const t = useT();
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const phraseRef = useRef<HTMLInputElement | null>(null);
  const [typedPhrase, setTypedPhrase] = useState('');
  const needsPhrase = !!confirmPhrase;
  const normalizedTypedPhrase = typedPhrase.trim();
  const phraseMatches = !needsPhrase || normalizedTypedPhrase === confirmPhrase;
  const okLabel = confirmLabel || t({ it: 'Conferma', en: 'Confirm' });
  const noLabel = cancelLabel === undefined ? t({ it: 'Annulla', en: 'Cancel' }) : cancelLabel;
  const initialFocus = needsPhrase ? phraseRef : cancelLabel === null ? confirmRef : cancelRef;

  useEffect(() => {
    if (!open) return;
    setTypedPhrase('');
    if (!needsPhrase) return;
    window.setTimeout(() => phraseRef.current?.focus(), 0);
  }, [needsPhrase, open]);

  const handleConfirm = () => {
    if (!phraseMatches) return;
    onConfirm();
  };

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
                handleConfirm();
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
              {needsPhrase ? (
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-slate-700">
                    {confirmPhraseLabel || t({ it: 'Conferma digitando la parola', en: 'Confirm by typing the word' })}
                    <span className="ml-1 font-bold text-rose-700">{confirmPhrase}</span>
                  </label>
                  {confirmPhraseHint ? <div className="mt-1 text-xs text-slate-500">{confirmPhraseHint}</div> : null}
                  <input
                    ref={phraseRef}
                    value={typedPhrase}
                    onChange={(e) => setTypedPhrase(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                    placeholder={confirmPhrasePlaceholder || String(confirmPhrase || '')}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
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
                  onClick={handleConfirm}
                  className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!phraseMatches}
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
