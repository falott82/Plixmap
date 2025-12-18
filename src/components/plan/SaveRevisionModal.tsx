import { Fragment, useEffect, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Check, Info, X } from 'lucide-react';
import { useT } from '../../i18n/useT';

interface Props {
  open: boolean;
  hasExisting: boolean;
  latestRevMajor: number;
  latestRevMinor: number;
  reason?: { it: string; en: string } | null;
  onDiscard?: () => void;
  onClose: () => void;
  onConfirm: (payload: { bump: 'major' | 'minor'; note?: string }) => void;
}

const SaveRevisionModal = ({ open, hasExisting, latestRevMajor, latestRevMinor, reason, onDiscard, onClose, onConfirm }: Props) => {
  const t = useT();
  const [bump, setBump] = useState<'major' | 'minor'>('minor');
  const [note, setNote] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement | null>(null);

  const next = !hasExisting
    ? { major: 1, minor: 0 }
    : bump === 'major'
      ? { major: latestRevMajor + 1, minor: 0 }
      : { major: latestRevMajor, minor: latestRevMinor + 1 };

  useEffect(() => {
    if (!open) return;
    setBump('minor');
    setNote('');
    setHelpOpen(false);
  }, [open]);

  useEffect(() => {
    if (!helpOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!helpRef.current) return;
      if (!helpRef.current.contains(e.target as any)) setHelpOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [helpOpen]);

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
                  <Dialog.Title className="text-lg font-semibold text-ink">
                    {t({ it: 'Salva revisione', en: 'Save revision' })}
                  </Dialog.Title>
                  <button onClick={onClose} className="text-slate-500 hover:text-ink">
                    <X size={18} />
                  </button>
                </div>

                {reason ? (
                  <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {t(reason)}
                  </div>
                ) : null}

                <Dialog.Description className="mt-2 text-sm text-slate-600">
                  {t({ it: 'Verrà generata la revisione', en: 'This will create revision' })}{' '}
                  <span className="font-semibold text-ink">Rev: {next.major}.{next.minor}</span>.
                </Dialog.Description>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-slate-700">{t({ it: 'Tipo', en: 'Type' })}</div>
                    <div ref={helpRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setHelpOpen((v) => !v)}
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        title={t({ it: 'Differenza major/minor', en: 'Major vs minor' })}
                      >
                        <Info size={14} />
                      </button>
                      {helpOpen ? (
                        <div className="absolute left-0 z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-card">
                          <div className="font-semibold text-ink">{t({ it: 'Major vs Minor', en: 'Major vs Minor' })}</div>
                          <div className="mt-2 space-y-2 text-sm text-slate-600">
                            <div>
                              <span className="font-semibold text-slate-800">
                                {t({ it: 'Minor', en: 'Minor' })}
                              </span>
                              :{' '}
                              {t({
                                it: 'modifiche minori (es. aggiunta/rimozione oggetti, spostamenti, cambio stanza).',
                                en: 'small changes (e.g. add/remove objects, small moves, change room).'
                              })}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-800">
                                {t({ it: 'Major', en: 'Major' })}
                              </span>
                              :{' '}
                              {t({
                                it: 'cambiamenti importanti (es. grossi spostamenti o riorganizzazione significativa della planimetria).',
                                en: 'significant changes (e.g. large moves or major reorganization of the floor plan).'
                              })}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setHelpOpen(false)}
                            className="mt-3 text-xs font-semibold text-primary hover:underline"
                          >
                            {t({ it: 'Chiudi', en: 'Close' })}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setBump('minor')}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                        bump === 'minor'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {t({ it: 'Minor (x.1)', en: 'Minor (x.1)' })}
                    </button>
                    <button
                      onClick={() => setBump('major')}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                        bump === 'major'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {t({ it: 'Major (1.x)', en: 'Major (1.x)' })}
                    </button>
                  </div>
                  <label className="block text-sm font-medium text-slate-700">
                    {t({ it: 'Nota (opzionale)', en: 'Note (optional)' })}
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({ it: 'Es. Aggiunti 2 utenti e spostata stampante', en: 'e.g. Added 2 users and moved the printer' })}
                      rows={3}
                    />
                  </label>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  {onDiscard ? (
                    <button
                      onClick={onDiscard}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      {t({ it: 'Cambia senza salvare', en: 'Switch without saving' })}
                    </button>
                  ) : null}
                  <button
                    onClick={onClose}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {t({ it: 'Annulla', en: 'Cancel' })}
                  </button>
                  <button
                    onClick={() => {
                      onConfirm({ bump, note: note.trim() || undefined });
                      onClose();
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
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

export default SaveRevisionModal;
