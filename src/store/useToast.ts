import { create } from 'zustand';
import { toast } from 'sonner';

export type ToastTone = 'success' | 'info' | 'danger';

interface ToastState {
  push: (message: string, tone?: ToastTone) => void;
  pushStack: (message: string, tone?: ToastTone, options?: { duration?: number }) => void;
}

export const useToastStore = create<ToastState>(() => ({
  push: (message, tone = 'info') => {
    if (tone === 'success') {
      toast.success(message);
      return;
    }
    if (tone === 'danger') {
      toast.error(message);
      return;
    }
    toast.info(message);
  },
  pushStack: (message, tone = 'info', options) => {
    const duration = options?.duration;
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
