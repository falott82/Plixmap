import PayPalIcon from '../ui/PayPalIcon';
import { useT } from '../../i18n/useT';

const DonationsPanel = () => {
  const t = useT();
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      <div className="text-sm font-semibold text-ink">{t({ it: 'Donazioni', en: 'Donations' })}</div>
      <p className="mt-3 text-sm text-slate-600">
        {t({
          it: 'Grazie di cuore a chi supporta Deskly: ogni donazione aiuta a mantenere il progetto e a migliorarne stabilità, performance e nuove funzionalità.',
          en: 'Thank you to everyone supporting Deskly: every donation helps keep the project running and improves stability, performance, and new features.'
        })}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a
          href="https://paypal.me/falott82"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <PayPalIcon size={16} className="text-white" />
          {t({ it: 'Dona con PayPal', en: 'Donate with PayPal' })}
        </a>
      </div>
    </div>
  );
};

export default DonationsPanel;
