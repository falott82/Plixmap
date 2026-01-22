import { Toaster } from 'sonner';

const ToastStack = () => {
  return <Toaster position="bottom-right" expand={false} closeButton richColors toastOptions={{ duration: 2000 }} />;
};

export default ToastStack;
