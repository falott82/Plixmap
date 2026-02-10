import { Toaster } from 'sonner';
import { useUIStore } from '../../store/useUIStore';

const ToastStack = () => {
  const clientChatOpen = useUIStore((s) => s.clientChatOpen);
  const clientChatDockHeight = useUIStore((s) => (s as any).clientChatDockHeight || 0);
  // Place toasts just above the chat dock top edge when the dock is open.
  // Chat is anchored at ~bottom-4, so add a small buffer.
  const offsetBottom = clientChatOpen ? Math.max(16, 16 + Math.round(clientChatDockHeight) + 10) : 16;
  return (
    <Toaster
      position="bottom-right"
      expand
      closeButton
      richColors
      offset={{ bottom: offsetBottom, right: 16 }}
      toastOptions={{ duration: 2000 }}
    />
  );
};

export default ToastStack;
