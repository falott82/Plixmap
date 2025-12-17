import { useAuthStore } from '../store/useAuthStore';

export type Lang = 'it' | 'en';

export const useLang = (): Lang => {
  const lang = useAuthStore((s) => (s.user as any)?.language) as Lang | undefined;
  return lang === 'en' ? 'en' : 'it';
};

export const useT = () => {
  const lang = useLang();
  return (m: { it: string; en: string }) => (lang === 'en' ? m.en : m.it);
};

