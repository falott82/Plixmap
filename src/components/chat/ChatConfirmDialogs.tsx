/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';

// Meeting-rejection reason dialog extracted from ClientChatDock.
export const ChatReviewRejectDialog = (props: any) => {
  const { confirmReviewReject, setConfirmReviewReject, submitMeetingReject, t } = props;
  return (
      <Transition show={!!confirmReviewReject} as={Fragment}>
        <Dialog as="div" className="relative z-[225]" onClose={() => setConfirmReviewReject(null)}>
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-card">
                <Dialog.Title className="text-base font-semibold text-slate-100">
                  {t({ it: 'Motivazione rifiuto meeting', en: 'Meeting rejection reason' })}
                </Dialog.Title>
                <div className="mt-2 text-sm text-slate-300">
                  {t({ it: 'Inserisci una motivazione (obbligatoria).', en: 'Insert a reason (required).' })}
                </div>
                <textarea
                  value={String(confirmReviewReject?.reason || '')}
                  onChange={(e) => setConfirmReviewReject((prev: any) => (prev ? { ...prev, reason: e.target.value } : prev))}
                  rows={4}
                  className="mt-3 w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-primary/40 focus:ring-2"
                  placeholder={t({ it: 'Motivazione rifiuto', en: 'Rejection reason' })}
                />
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button type="button" onClick={() => setConfirmReviewReject(null)} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">
                    {t({ it: 'Annulla', en: 'Cancel' })}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void submitMeetingReject();
                    }}
                    disabled={!String(confirmReviewReject?.reason || '').trim()}
                    className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t({ it: 'Rifiuta meeting', en: 'Reject meeting' })}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
  );
};

// Delete-message (me / everyone) dialog extracted from ClientChatDock.
export const ChatDeleteMessageDialog = (props: any) => {
  const { confirmDeleteMessageMode, setConfirmDeleteMessageMode, confirmRemoveMessage, t } = props;
  return (
      <Transition show={!!confirmDeleteMessageMode} as={Fragment}>
        <Dialog as="div" className="relative z-[225]" onClose={() => setConfirmDeleteMessageMode(null)}>
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-card">
                <Dialog.Title className="text-base font-semibold text-slate-100">
                  {t({ it: 'Elimina messaggio', en: 'Delete message' })}
                </Dialog.Title>
                <div className="mt-2 text-sm text-slate-300">
                  {confirmDeleteMessageMode?.allowAll
                    ? t({
                        it: 'Scegli se eliminare il messaggio solo per te o per tutti i partecipanti.',
                        en: 'Choose whether to delete the message only for you or for all participants.'
                      })
                    : t({
                        it: 'Elimina per tutti non disponibile dopo 30 minuti. Puoi eliminarlo solo per te.',
                        en: 'Delete for everyone is not available after 30 minutes. You can only delete it for yourself.'
                      })}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                  <button type="button" onClick={() => setConfirmDeleteMessageMode(null)} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">
                    {t({ it: 'Annulla', en: 'Cancel' })}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void confirmRemoveMessage('me');
                    }}
                    className="rounded-xl border border-cyan-400/40 bg-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/30"
                  >
                    {t({ it: 'Elimina per me', en: 'Delete for me' })}
                  </button>
                  {confirmDeleteMessageMode?.allowAll ? (
                    <button
                      type="button"
                      onClick={() => {
                        void confirmRemoveMessage('all');
                      }}
                      className="rounded-xl border border-rose-400/40 bg-rose-500/20 px-3 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-500/30"
                    >
                      {t({ it: 'Elimina per tutti', en: 'Delete for everyone' })}
                    </button>
                  ) : null}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
  );
};
