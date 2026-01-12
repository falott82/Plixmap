import { Github, Mail } from 'lucide-react';
import { useT } from '../../i18n/useT';
import PayPalIcon from '../ui/PayPalIcon';

interface Props {
  variant?: 'sidebar' | 'collapsed';
}

const FooterInfo = ({ variant = 'sidebar' }: Props) => {
  const t = useT();
  if (variant === 'collapsed') {
    return (
      <div className="mt-auto flex flex-col items-center gap-2 pb-4">
        <a
          href="https://github.com/falott82"
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-ink"
          title={t({ it: 'Apri GitHub', en: 'Open GitHub' })}
        >
          <Github size={16} />
        </a>
        <a
          href="https://paypal.me/falott82"
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-ink"
          title={t({ it: 'Apri PayPal', en: 'Open PayPal' })}
        >
          <PayPalIcon size={16} />
          <span className="sr-only">PayPal</span>
        </a>
        <a
          href="mailto:ottavio.falsini@me.com"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-ink"
          title={t({ it: 'Invia email', en: 'Send email' })}
        >
          <Mail size={16} />
        </a>
      </div>
    );
  }

  return (
    <div className="mt-auto border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-700">Ottavio Falsini</span>
        <div className="flex items-center gap-1.5">
          <a
            href="https://github.com/falott82"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100 hover:text-ink"
            title={t({ it: 'Apri GitHub', en: 'Open GitHub' })}
          >
            <Github size={14} />
            <span className="sr-only">GitHub</span>
          </a>
          <a
            href="https://paypal.me/falott82"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100 hover:text-ink"
            title={t({ it: 'Apri PayPal', en: 'Open PayPal' })}
          >
            <PayPalIcon size={14} />
            <span className="sr-only">PayPal</span>
          </a>
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
};

export default FooterInfo;
