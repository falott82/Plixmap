import { useAuthStore } from '../store/useAuthStore';

export type Lang = 'it' | 'en';
type Translation = { it: string; en: string };

const translators = {
  it: (message: Translation) => message.it,
  en: (message: Translation) => message.en
};

export const useLang = (): Lang => {
  const lang = useAuthStore((s) => (s.user as any)?.language) as Lang | undefined;
  if (lang === 'it' || lang === 'en') return lang;
  if (typeof navigator === 'undefined') return 'en';
  const browserLang = String(navigator.languages?.[0] || navigator.language || '').toLowerCase();
  return browserLang.startsWith('it') ? 'it' : 'en';
};

export const useT = () => {
  const lang = useLang();
  return translators[lang];
};
