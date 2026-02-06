import { create } from 'zustand';
import { toast } from 'sonner';

export type ToastTone = 'success' | 'info' | 'danger';

interface ToastState {
  push: (message: string, tone?: ToastTone) => void;
  pushStack: (message: string, tone?: ToastTone, options?: { duration?: number }) => void;
}

const UPDATE_TOAST_MS = 5_000;
const isUpdateToast = (message: string) => /aggiornat|updated/i.test(String(message || ''));

export const useToastStore = create<ToastState>(() => ({
  push: (message, tone = 'info') => {
    const duration = isUpdateToast(message) ? UPDATE_TOAST_MS : undefined;
    if (tone === 'success') {
      if (duration) toast.success(message, { duration });
      else toast.success(message);
      return;
    }
    if (tone === 'danger') {
      if (duration) toast.error(message, { duration });
      else toast.error(message);
      return;
    }
    if (duration) toast.info(message, { duration });
    else toast.info(message);
  },
  pushStack: (message, tone = 'info', options) => {
    const duration = options?.duration ?? (isUpdateToast(message) ? UPDATE_TOAST_MS : undefined);
    if (tone === 'success') {
      toast.success(message, { duration });
      return;
    }
    if (tone === 'danger') {
      toast.error(message, { duration });
      return;
    }
    toast.info(message, { duration });
  }
}));
