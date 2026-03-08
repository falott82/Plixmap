import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { Fragment } from 'react';
import RoomShapePreview from './RoomShapePreview';

type Translate = (copy: { it: string; en: string }) => string;

type RoomMeasuresData = {
  roomName: string;
  points: { x: number; y: number }[];
  segments: { label: string; lengthPx: number; lengthLabel: string | null }[];
  perimeterLabel: string | null;
  areaLabel: string | null;
  scaleMissing: boolean;
};

type Props = {
  open: boolean;
  data: RoomMeasuresData | null;
  t: Translate;
  onClose: () => void;
};

const RoomMeasuresModal = ({ open, data, t, onClose }: Props) => (
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
            <Dialog.Panel className="w-full max-w-3xl modal-panel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Dialog.Title className="modal-title">{t({ it: 'Misure stanza', en: 'Room measurements' })}</Dialog.Title>
                  <div className="text-xs text-slate-500">
                    {t({ it: 'Stanza', en: 'Room' })}: <span className="font-semibold text-slate-700">{data?.roomName || '-'}</span>
                  </div>
                </div>
                <button onClick={onClose} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                  <X size={18} />
                </button>
              </div>
              {!data ? (
                <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  {t({ it: 'Nessuna informazione disponibile.', en: 'No data available.' })}
                </div>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-[340px,1fr]">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                    <RoomShapePreview points={data.points} segments={data.segments} width={320} height={220} className="h-[220px] w-full" />
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                    {data.scaleMissing ? (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 font-semibold text-amber-700">
                        {t({ it: 'Imposta una scala per misurare.', en: 'Set a scale to measure.' })}
                      </div>
                    ) : null}
                    {data.perimeterLabel ? (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span>{t({ it: 'Perimetro', en: 'Perimeter' })}</span>
                        <span className="font-mono">{data.perimeterLabel}</span>
                      </div>
                    ) : null}
                    {data.areaLabel ? (
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span>{t({ it: 'Area', en: 'Area' })}</span>
                        <span className="font-mono">{data.areaLabel}</span>
                      </div>
                    ) : null}
                    <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {t({ it: 'Lati', en: 'Sides' })}
                    </div>
                    <div className="mt-1 max-h-48 space-y-1 overflow-auto text-[11px]">
                      {(data.segments || []).map((seg) => (
                        <div key={seg.label} className="flex items-center justify-between gap-2">
                          <span className="font-mono">{seg.label}</span>
                          <span className="font-mono">{seg.lengthLabel || '-'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-5 flex justify-end">
                <button onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  {t({ it: 'Chiudi', en: 'Close' })}
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </div>
    </Dialog>
  </Transition>
);

export default RoomMeasuresModal;
