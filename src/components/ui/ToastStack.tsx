import { Toaster } from 'sonner';

const ToastStack = () => {
  return <Toaster position="bottom-right" expand closeButton richColors toastOptions={{ duration: 2000 }} />;
};

export default ToastStack;
