import { Heart } from 'lucide-react';
import { useT } from '../../i18n/useT';

const DonationsPanel = () => {
  const t = useT();
  return (
    <div className="relative overflow-hidden rounded-2xl border border-rose-200 bg-gradient-to-br from-white via-rose-50 to-red-100 p-6 shadow-card">
      <Heart size={64} className="pointer-events-none absolute -right-4 -top-4 fill-rose-200 text-rose-200" />
      <Heart size={28} className="pointer-events-none absolute left-3 top-14 animate-pulse fill-rose-300 text-rose-300" />
      <Heart size={24} className="pointer-events-none absolute bottom-3 right-8 animate-bounce fill-rose-300 text-rose-300" />
      <div className="flex items-center gap-2 text-sm font-semibold text-rose-700">
        <Heart size={16} className="fill-rose-500 text-rose-500" />
        {t({ it: 'Supporta Plixmap', en: 'Support Plixmap' })}
      </div>
      <p className="mt-3 text-sm text-slate-700">
        {t({
          it: 'Questo software è stato realizzato per passione nel tempo libero. Siete liberi di utilizzarlo e modificarlo come preferite.',
          en: 'This software was created out of passion in my free time. You are free to use and modify it as you prefer.'
        })}
      </p>
      <p className="mt-3 text-sm text-slate-700">
        {t({
          it: 'Se desiderate sostenere il progetto e il mio lavoro, potete farlo con una donazione tramite PayPal',
          en: 'If you would like to support the project and my work, you can do so with a PayPal donation'
        })}
        {' '}
        <a
          href="https://paypal.me/falott82"
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
    </div>
  );
};

export default DonationsPanel;
