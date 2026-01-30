import { useAuthStore } from '../store/useAuthStore';

export type Lang = 'it' | 'en';

export const useLang = (): Lang => {
  const lang = useAuthStore((s) => (s.user as any)?.language) as Lang | undefined;
  if (lang === 'it' || lang === 'en') return lang;
  if (typeof navigator === 'undefined') return 'en';
  const browserLang = String(navigator.languages?.[0] || navigator.language || '').toLowerCase();
  return browserLang.startsWith('it') ? 'it' : 'en';
};

export const useT = () => {
  const lang = useLang();
  return (m: { it: string; en: string }) => (lang === 'en' ? m.en : m.it);
};
