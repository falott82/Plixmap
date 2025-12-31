import { X } from 'lucide-react';
import { useToastStore } from '../../store/useToast';

const toneStyles: Record<string, string> = {
  success: 'bg-emerald-500 text-white',
  info: 'bg-slate-900 text-white',
  danger: 'bg-rose-500 text-white'
};

const ToastStack = () => {
  const { toasts, remove } = useToastStore();
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[90] flex max-w-[360px] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 rounded-xl px-4 py-3 shadow-card transition ${toneStyles[toast.tone]}`}
        >
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => remove(toast.id)} className="opacity-70 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastStack;
