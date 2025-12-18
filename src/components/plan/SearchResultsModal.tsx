import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { MapObject, Room } from '../../store/types';
import { useDataStore } from '../../store/useDataStore';
import Icon from '../ui/Icon';
import { useLang, useT } from '../../i18n/useT';

interface Props {
  open: boolean;
  term: string;
  objectResults: MapObject[];
  roomResults: Room[];
  onClose: () => void;
  onSelectObject: (objectId: string) => void;
  onSelectRoom: (roomId: string) => void;
}

const SearchResultsModal = ({ open, term, objectResults, roomResults, onClose, onSelectObject, onSelectRoom }: Props) => {
  const defs = useDataStore((s) => s.objectTypes);
  const lang = useLang();
  const t = useT();
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
                  <Dialog.Title className="text-lg font-semibold text-ink">
                    {t({ it: 'Risultati ricerca', en: 'Search results' })}
                  </Dialog.Title>
                  <Dialog.Description className="mt-1 text-sm text-slate-600">
                    {t({
                      it: `Seleziona un risultato per evidenziare “${term}”.`,
                      en: `Select a result to highlight “${term}”.`
                    })}
                  </Dialog.Description>
                </div>
                <button onClick={onClose} className="text-slate-500 hover:text-ink">
                  <X size={18} />
                </button>
              </div>
              <div className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto">
                {roomResults.length ? (
                  <div className="pb-2">
                    <div className="px-1 pb-2 text-xs font-semibold uppercase text-slate-500">
                      {t({ it: 'Stanze', en: 'Rooms' })}
                    </div>
                    <div className="space-y-2">
                      {roomResults.map((room) => (
                        <button
                          key={room.id}
                          onClick={() => {
                            onSelectRoom(room.id);
                            onClose();
                          }}
                          className="flex w-full items-start gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left hover:bg-slate-50"
                        >
                          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-primary">
                            <span className="text-sm font-bold">R</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-ink">{room.name}</div>
                            <div className="truncate text-xs text-slate-500">
                              {t({ it: 'Stanza', en: 'Room' })}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {objectResults.length ? (
                  <div>
                    <div className="px-1 pb-2 text-xs font-semibold uppercase text-slate-500">
                      {t({ it: 'Oggetti', en: 'Objects' })}
                    </div>
                    <div className="space-y-2">
                      {objectResults.map((obj) => (
                        <button
                          key={obj.id}
                          onClick={() => {
                            onSelectObject(obj.id);
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
                  </div>
                ) : null}
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
