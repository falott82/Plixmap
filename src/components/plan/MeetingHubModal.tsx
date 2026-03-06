import { Dialog, Transition } from '@headlessui/react';
import { CalendarClock, User, X } from 'lucide-react';
import { Fragment, type MutableRefObject } from 'react';

type Translate = (copy: { it: string; en: string }) => string;

type Props = {
  open: boolean;
  canManageMeetingScheduling: boolean;
  t: Translate;
  focusRef: MutableRefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onOpenScheduling: () => void;
  onOpenMyMeetings: () => void;
};

const MeetingHubModal = ({ open, canManageMeetingScheduling, t, focusRef, onClose, onOpenScheduling, onOpenMyMeetings }: Props) => (
  <Transition show={open} as={Fragment}>
    <Dialog as="div" className="relative z-[98]" initialFocus={focusRef} onClose={onClose}>
      <Transition.Child
        as={Fragment}
        enter="ease-out duration-150"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-in duration-100"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
      </Transition.Child>
      <div className="fixed inset-0 overflow-y-auto p-4">
        <div className="flex min-h-full items-center justify-center">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Centro meeting', en: 'Meeting center' })}</Dialog.Title>
                  <div className="text-xs text-slate-500">
                    {t({
                      it: 'Scegli la modalità: timeline sale o meeting personali.',
                      en: 'Choose mode: room timeline or personal meetings.'
                    })}
                  </div>
                </div>
                <button
                  ref={focusRef}
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                  title={t({ it: 'Chiudi', en: 'Close' })}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <button
                  type="button"
                  disabled={!canManageMeetingScheduling}
                  onClick={onOpenScheduling}
                  className={`rounded-2xl border px-4 py-5 text-left transition ${
                    canManageMeetingScheduling
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                      : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
                  }`}
                  title={
                    canManageMeetingScheduling
                      ? t({ it: 'Apri la timeline meeting per cliente/sede', en: 'Open meetings timeline for client/site' })
                      : t({ it: 'Permessi insufficienti per la pianificazione', en: 'Insufficient permissions for scheduling' })
                  }
                >
                  <div className="flex items-center gap-2 text-base font-semibold">
                    <CalendarClock size={18} />
                    {t({ it: 'Pianificazione', en: 'Scheduling' })}
                  </div>
                  <div className="mt-1 text-xs opacity-80">
                    {t({
                      it: 'Mostra le meeting room, timeline giornaliera e inserimento nuovo meeting.',
                      en: 'Show meeting rooms, daily timeline and new meeting creation.'
                    })}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={onOpenMyMeetings}
                  className="rounded-2xl border border-sky-300 bg-sky-50 px-4 py-5 text-left text-sky-900 transition hover:bg-sky-100"
                  title={t({ it: 'Mostra i meeting del tuo utente', en: 'Show meetings for your user' })}
                >
                  <div className="flex items-center gap-2 text-base font-semibold">
                    <User size={18} />
                    {t({ it: 'I miei meeting', en: 'My meetings' })}
                  </div>
                  <div className="mt-1 text-xs opacity-80">
                    {t({
                      it: 'Elenco meeting passati, in corso e futuri dove sei coinvolto.',
                      en: 'List of past, ongoing and upcoming meetings where you are involved.'
                    })}
                  </div>
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </div>
    </Dialog>
  </Transition>
);

export default MeetingHubModal;
