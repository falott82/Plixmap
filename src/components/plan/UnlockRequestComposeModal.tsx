import { Fragment, useEffect, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { MessageSquare, Send, Unlock, X } from 'lucide-react';
import { useT } from '../../i18n/useT';
import UserAvatar from '../ui/UserAvatar';

export type UnlockRequestLock = {
  planId: string;
  clientName?: string;
  siteName?: string;
  planName?: string;
};

type TargetUser = {
  userId: string;
  username: string;
  avatarUrl?: string;
};

type Props = {
  open: boolean;
  target: TargetUser | null;
  locks: UnlockRequestLock[];
  onClose: () => void;
  onSend: (payload: { targetUserId: string; planId: string; message: string; grantMinutes: number }) => void;
};

const formatLockLabel = (l: UnlockRequestLock) => {
  const parts = [l.clientName, l.siteName, l.planName].filter((x) => x && String(x).trim().length);
  return parts.length ? parts.join(' / ') : l.planId;
};

const UnlockRequestComposeModal = ({ open, target, locks, onClose, onSend }: Props) => {
  const t = useT();
  const [planId, setPlanId] = useState('');
  const [message, setMessage] = useState('');
  const [grantMinutes, setGrantMinutes] = useState(10);

  useEffect(() => {
    if (!open) return;
    setMessage('');
    setPlanId(String(locks?.[0]?.planId || ''));
    setGrantMinutes(10);
  }, [open, locks]);

  const options = useMemo(
    () =>
      (locks || [])
        .filter((l) => l?.planId)
        .map((l) => ({ value: String(l.planId), label: formatLockLabel(l) })),
    [locks]
  );

  const canSend = !!target?.userId && !!planId;

  return (
    <Transition show={open} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={() => {
          onClose();
        }}
      >
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
              <Dialog.Panel className="w-full max-w-lg modal-panel">
                <div className="modal-header items-center">
                  <div className="min-w-0">
                    <Dialog.Title className="flex items-center gap-2 text-lg font-semibold text-ink">
                      <Unlock size={18} className="text-primary" />
                      {t({ it: 'Richiedi unlock', en: 'Request unlock' })}
                    </Dialog.Title>
                    <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                      <UserAvatar src={target?.avatarUrl} username={target?.username} size={22} />
                      <span className="truncate">
                        {t({ it: 'A', en: 'To' })}: <span className="font-semibold text-ink">{target?.username || 'user'}</span>
                      </span>
                    </div>
                  </div>
                  <button onClick={onClose} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>

                {options.length > 1 ? (
                  <div className="mt-4">
                    <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Planimetria', en: 'Floor plan' })}</div>
                    <select
                      value={planId}
                      onChange={(e) => setPlanId(String(e.target.value || ''))}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                    >
                      {options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                      <MessageSquare size={14} />
                      {t({ it: 'Messaggio (opzionale)', en: 'Message (optional)' })}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-400">{message.length}/1000</div>
                  </div>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(String(e.target.value || '').slice(0, 1000))}
                    placeholder={t({
                      it: 'Esempio: "Mi serve sbloccare la planimetria per fare una modifica urgente."',
                      en: 'Example: "I need to unlock the floor plan to apply an urgent change."'
                    })}
                    rows={4}
                    className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                  />
                  <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                    <div className="font-semibold">{t({ it: 'Questo testo verrà mostrato all’utente.', en: 'This text will be shown to the user.' })}</div>
                    <div className="mt-1 whitespace-pre-wrap text-sky-900/90">{message || '—'}</div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Tempo per prendere il lock', en: 'Time to take the lock' })}</div>
                    <div className="text-[11px] font-semibold text-slate-600">
                      {t({
                        it: `${grantMinutes} min`,
                        en: `${grantMinutes} min`
                      })}
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={60}
                    step={0.5}
                    value={grantMinutes}
                    onChange={(e) => setGrantMinutes(Number(e.target.value))}
                    className="mt-2 w-full"
                  />
                  <div className="mt-1 text-xs text-slate-500">
                    {t({
                      it: 'Dopo che l’utente concede l’unlock, avrai questo tempo per entrare nella planimetria e prendere il lock.',
                      en: 'After the user grants the unlock, you will have this time to open the floor plan and acquire the lock.'
                    })}
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      if (!target?.userId || !planId) return;
                      onSend({ targetUserId: target.userId, planId, message, grantMinutes });
                    }}
                    disabled={!canSend}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                    title={t({ it: 'Invia richiesta', en: 'Send request' })}
                  >
                    <Send size={16} />
                    {t({ it: 'Invia', en: 'Send' })}
                  </button>
                  <button
                    onClick={onClose}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    title={t({ it: 'Annulla', en: 'Cancel' })}
                  >
                    {t({ it: 'Annulla', en: 'Cancel' })}
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

export default UnlockRequestComposeModal;
