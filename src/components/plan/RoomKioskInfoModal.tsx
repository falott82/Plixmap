import { Dialog, Transition } from '@headlessui/react';
import { Copy, ExternalLink, X } from 'lucide-react';
import { Fragment } from 'react';

type Translate = (copy: { it: string; en: string }) => string;

type RoomKioskInfoModalState = {
  roomId: string;
  roomName: string;
  clientName: string;
  siteName: string;
  planName: string;
};

type Props = {
  modal: RoomKioskInfoModalState | null;
  link: string;
  qrDataUrl: string;
  t: Translate;
  onClose: () => void;
  onOpenLink: () => void;
  onCopyLink: () => void;
};

const RoomKioskInfoModal = ({ modal, link, qrDataUrl, t, onClose, onOpenLink, onCopyLink }: Props) => (
  <Transition show={!!modal} as={Fragment}>
    <Dialog as="div" className="relative z-[76]" onClose={onClose}>
      <Transition.Child
        as={Fragment}
        enter="ease-out duration-150"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-in duration-100"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm" />
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
            <Dialog.Panel className="w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Kiosk Info', en: 'Kiosk Info' })}</Dialog.Title>
                  <div className="text-xs text-slate-500">
                    {[modal?.clientName, modal?.siteName, modal?.planName].filter(Boolean).join(' • ')}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-700">{modal?.roomName || '-'}</div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                  title={t({ it: 'Chiudi', en: 'Close' })}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-[320px,1fr]">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={t({ it: 'QR code kiosk mode', en: 'Kiosk mode QR code' })}
                      className="mx-auto h-[300px] w-[300px] rounded-lg border border-slate-200 bg-white p-2"
                    />
                  ) : (
                    <div className="flex h-[300px] w-[300px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                      QR
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Link kiosk', en: 'Kiosk link' })}</div>
                    <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-700 break-all">
                      {link || '—'}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={onOpenLink}
                        className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        <ExternalLink size={14} />
                        {t({ it: 'Apri link', en: 'Open link' })}
                      </button>
                      <button
                        type="button"
                        onClick={onCopyLink}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Copy size={14} />
                        {t({ it: 'Copia link', en: 'Copy link' })}
                      </button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    {t({
                      it: 'Scansiona il QR code dal tablet della sala per aprire direttamente la pagina Kiosk mode.',
                      en: 'Scan the QR code from the room tablet to open the Kiosk mode page directly.'
                    })}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t({ it: 'Chiudi', en: 'Close' })}
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </div>
    </Dialog>
  </Transition>
);

export default RoomKioskInfoModal;
