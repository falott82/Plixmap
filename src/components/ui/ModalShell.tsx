import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { Fragment, ReactNode } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  sizeClassName?: string;
  children: ReactNode;
  footer?: ReactNode;
  closeDisabled?: boolean;
};

const ModalShell = ({
  open,
  onClose,
  title,
  description,
  sizeClassName = 'max-w-md',
  children,
  footer,
  closeDisabled = false
}: Props) => {
  return (
    <Transition show={open} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={() => {
          if (closeDisabled) return;
          onClose();
        }}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center px-4 py-8">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-150"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-100"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={`w-full ${sizeClassName} modal-panel`}>
                <div className="modal-header items-center">
                  <div className="min-w-0">
                    <Dialog.Title className="modal-title">{title}</Dialog.Title>
                    {description ? <Dialog.Description className="modal-description">{description}</Dialog.Description> : null}
                  </div>
                  <button
                    onClick={() => {
                      if (closeDisabled) return;
                      onClose();
                    }}
                    className="icon-button"
                    disabled={closeDisabled}
                    aria-disabled={closeDisabled}
                    title="Close"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4">{children}</div>

                {footer ? <div className="modal-footer">{footer}</div> : null}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default ModalShell;

