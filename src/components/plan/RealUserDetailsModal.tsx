import { Fragment, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Mail, Phone, User, X } from 'lucide-react';
import { useT } from '../../i18n/useT';

type RealUserDetails = {
  externalUserId?: string;
  firstName?: string;
  lastName?: string;
  externalEmail?: string;
  externalRole?: string;
  externalDept1?: string;
  externalDept2?: string;
  externalDept3?: string;
  externalExt1?: string;
  externalExt2?: string;
  externalExt3?: string;
  externalIsExternal?: boolean;
};

interface Props {
  open: boolean;
  userName: string;
  details: RealUserDetails | null;
  onClose: () => void;
}

const RealUserDetailsModal = ({ open, userName, details, onClose }: Props) => {
  const t = useT();

  const rows = useMemo(() => {
    if (!details) return [];
    const dept = [details.externalDept1, details.externalDept2, details.externalDept3].filter(Boolean).join(' / ');
    const exts = [details.externalExt1, details.externalExt2, details.externalExt3].filter(Boolean).join(' · ');
    return [
      { label: t({ it: 'ID', en: 'ID' }), value: details.externalUserId },
      { label: t({ it: 'Nome', en: 'Name' }), value: [details.firstName, details.lastName].filter(Boolean).join(' ').trim() || userName },
      { label: t({ it: 'Email', en: 'Email' }), value: details.externalEmail, icon: details.externalEmail ? <Mail size={14} className="text-slate-500" /> : null },
      { label: t({ it: 'Ruolo', en: 'Role' }), value: details.externalRole },
      { label: t({ it: 'Reparto', en: 'Department' }), value: dept || undefined },
      { label: t({ it: 'Interni', en: 'Extensions' }), value: exts || undefined, icon: exts ? <Phone size={14} className="text-slate-500" /> : null },
      {
        label: t({ it: 'Tipo', en: 'Type' }),
        value:
          typeof details.externalIsExternal === 'boolean'
            ? details.externalIsExternal
              ? t({ it: 'Esterno', en: 'External' })
              : t({ it: 'Interno', en: 'Internal' })
            : undefined
      }
    ].filter((r) => String(r.value || '').trim());
  }, [details, t, userName]);

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[70]" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center px-4 py-8">
            <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-lg modal-panel">
                <div className="modal-header">
                  <div>
                    <Dialog.Title className="modal-title">{t({ it: 'Dettagli utente', en: 'User details' })}</Dialog.Title>
                    <Dialog.Description className="modal-description">
                      {t({
                        it: 'Informazioni importate dalla WebAPI.',
                        en: 'Information imported from the WebAPI.'
                      })}
                    </Dialog.Description>
                  </div>
                  <button onClick={onClose} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <User size={16} className="text-slate-600" />
                    <span className="truncate">{userName}</span>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                  {rows.length ? (
                    rows.map((r) => (
                      <div key={r.label} className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 text-sm first:border-t-0">
                        <div className="text-xs font-semibold uppercase text-slate-500">{r.label}</div>
                        <div className="flex min-w-0 items-center gap-2 text-right font-medium text-slate-800">
                          {r.icon}
                          <span className="truncate">{String(r.value)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-sm text-slate-600">{t({ it: 'Nessun dettaglio disponibile.', en: 'No details available.' })}</div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default RealUserDetailsModal;
