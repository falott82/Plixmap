import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Github, Heart, Mail, X } from 'lucide-react';
import { useT } from '../../i18n/useT';
import { releaseHistory } from '../../version/history';
import { useUIStore } from '../../store/useUIStore';
import { PLIXMAP_PAYPAL_URL, PLIXMAP_REPO_URL, PLIXMAP_WEBSITE_URL } from '../../constants/links';

interface Props {
  variant?: 'sidebar' | 'collapsed';
}

const FooterInfo = ({ variant = 'sidebar' }: Props) => {
  const t = useT();
  const openChangelog = useUIStore((s) => s.openChangelog);
  const latest = releaseHistory[0]?.version || '0.0.0';
  const [donationOpen, setDonationOpen] = useState(false);

  const content =
    variant === 'collapsed' ? (
      <div className="mt-auto flex flex-col items-center gap-2 pb-4">
        <button
          onClick={openChangelog}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-ink"
          title={t({ it: 'Apri changelog', en: 'Open changelog' })}
        >
          v{latest}
        </button>
        <a
          href={PLIXMAP_REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-ink"
          title={t({ it: 'Apri GitHub', en: 'Open GitHub' })}
        >
          <Github size={16} />
        </a>
        <button
          onClick={() => setDonationOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 shadow-sm hover:bg-rose-100"
          title={t({ it: 'Supporta il progetto', en: 'Support the project' })}
        >
          <Heart size={16} className="fill-rose-500 text-rose-500" />
          <span className="sr-only">{t({ it: 'Supporta il progetto', en: 'Support the project' })}</span>
        </button>
        <a
          href="mailto:ottavio.falsini@me.com"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-ink"
          title={t({ it: 'Invia email', en: 'Send email' })}
        >
          <Mail size={16} />
        </a>
      </div>
    ) : (
      <div className="mt-auto border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Ottavio Falsini</span>
              <button
                onClick={openChangelog}
                className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 hover:text-ink"
                title={t({ it: 'Apri changelog', en: 'Open changelog' })}
              >
                v{latest}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <a
              href={PLIXMAP_REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100 hover:text-ink"
              title={t({ it: 'Apri GitHub', en: 'Open GitHub' })}
            >
              <Github size={14} />
              <span className="sr-only">GitHub</span>
            </a>
            <button
              onClick={() => setDonationOpen(true)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-rose-600 hover:bg-rose-50"
              title={t({ it: 'Supporta il progetto', en: 'Support the project' })}
            >
              <Heart size={14} className="fill-rose-500 text-rose-500" />
              <span className="sr-only">{t({ it: 'Supporta il progetto', en: 'Support the project' })}</span>
            </button>
            <a
              href="mailto:ottavio.falsini@me.com"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100 hover:text-ink"
              title={t({ it: 'Invia email', en: 'Send email' })}
            >
              <Mail size={14} />
              <span className="sr-only">Email</span>
            </a>
          </div>
        </div>
      </div>
    );

  return (
    <>
      {content}
      <Transition appear show={donationOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[210]" onClose={() => setDonationOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-[1px]" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto p-4">
            <div className="mx-auto flex min-h-full max-w-2xl items-center justify-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="translate-y-2 scale-95 opacity-0"
                enterTo="translate-y-0 scale-100 opacity-100"
                leave="ease-in duration-150"
                leaveFrom="translate-y-0 scale-100 opacity-100"
                leaveTo="translate-y-2 scale-95 opacity-0"
              >
                <Dialog.Panel className="relative w-full overflow-hidden rounded-3xl border border-rose-200 bg-gradient-to-br from-white via-rose-50 to-red-100 p-6 shadow-2xl">
                  <Heart size={72} className="pointer-events-none absolute -right-6 -top-6 fill-rose-200 text-rose-200" />
                  <Heart size={38} className="pointer-events-none absolute -left-4 top-20 animate-pulse fill-rose-300 text-rose-300" />
                  <Heart size={28} className="pointer-events-none absolute bottom-8 right-10 animate-bounce fill-rose-300 text-rose-300" />
                  <button
                    onClick={() => setDonationOpen(false)}
                    className="absolute right-3 top-3 rounded-lg border border-rose-200 bg-white/80 p-1.5 text-slate-500 hover:bg-white hover:text-ink"
                    title={t({ it: 'Chiudi', en: 'Close' })}
                  >
                    <X size={16} />
                  </button>
                  <div className="flex items-center gap-2 text-rose-700">
                    <Heart size={18} className="fill-rose-500 text-rose-500" />
                    <Dialog.Title className="text-base font-bold">
                      {t({ it: 'Supporta Plixmap', en: 'Support Plixmap' })}
                    </Dialog.Title>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-slate-700">
                    {t({
                      it: 'Questo software è stato realizzato per passione nel tempo libero. Siete liberi di utilizzarlo e modificarlo come preferite.',
                      en: 'This software was created out of passion in my free time. You are free to use and modify it as you prefer.'
                    })}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-700">
                    {t({
                      it: 'Se desiderate sostenere il progetto e il mio lavoro, potete farlo con una donazione tramite PayPal',
                      en: 'If you would like to support the project and my work, you can do so with a PayPal donation'
                    })}{' '}
                    <a
                      href={PLIXMAP_PAYPAL_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-rose-700 underline decoration-rose-400 underline-offset-2 hover:text-rose-800"
                    >
                      {t({ it: 'cliccando qui', en: 'by clicking here' })}
                    </a>
                    .{' '}
                    {t({
                      it: 'Vi ringrazio di cuore per il vostro supporto.',
                      en: 'Thank you from the bottom of my heart for your support.'
                    })}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-700">
                    {t({
                      it: 'Sito ufficiale del progetto:',
                      en: 'Official project website:'
                    })}{' '}
                    <a
                      href={PLIXMAP_WEBSITE_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-rose-700 underline decoration-rose-400 underline-offset-2 hover:text-rose-800"
                    >
                      www.plixmap.com
                    </a>
                  </p>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};

export default FooterInfo;
