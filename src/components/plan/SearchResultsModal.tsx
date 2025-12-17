import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { MapObject } from '../../store/types';
import { useDataStore } from '../../store/useDataStore';
import Icon from '../ui/Icon';
import { useLang } from '../../i18n/useT';

interface Props {
  open: boolean;
  term: string;
  results: MapObject[];
  onClose: () => void;
  onSelect: (objectId: string) => void;
}

const SearchResultsModal = ({ open, term, results, onClose, onSelect }: Props) => {
  const defs = useDataStore((s) => s.objectTypes);
  const lang = useLang();
  const byId = new Map(defs.map((d) => [d.id, d]));
  const labelOf = (id: string) => byId.get(id)?.name?.[lang] || byId.get(id)?.name?.it || id;
  const iconOf = (id: string) => byId.get(id)?.icon;

  return (
    <Transition show={open} as={Fragment}>
    <Dialog as="div" className="relative z-50" onClose={onClose}>
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
            <Dialog.Panel className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <Dialog.Title className="text-lg font-semibold text-ink">Risultati ricerca</Dialog.Title>
                  <Dialog.Description className="mt-1 text-sm text-slate-600">
                    Seleziona un risultato per centrare la mappa su “{term}”.
                  </Dialog.Description>
                </div>
                <button onClick={onClose} className="text-slate-500 hover:text-ink">
                  <X size={18} />
                </button>
              </div>
              <div className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto">
                {results.map((obj) => (
                  <button
                    key={obj.id}
                    onClick={() => {
                      onSelect(obj.id);
                      onClose();
                    }}
                    className="flex w-full items-start gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left hover:bg-slate-50"
                  >
                    <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-primary">
                      <Icon name={iconOf(obj.type)} size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ink">{obj.name}</div>
                      <div className="truncate text-xs text-slate-500">{labelOf(obj.type)}</div>
                      {obj.description ? (
                        <div className="mt-1 line-clamp-2 text-xs text-slate-600">{obj.description}</div>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </div>
    </Dialog>
  </Transition>
  );
};

export default SearchResultsModal;
