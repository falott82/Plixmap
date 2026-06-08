import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import RoomShapePreview from './RoomShapePreview';

type Translate = (msg: { it: string; en: string }) => string;

export type RoomInfoMeasuresModalProps = {
  measuresModalOpen: boolean;
  open: boolean;
  setMeasuresModalOpen: (value: boolean) => void;
  shapePreview: any;
  measurements: any;
  surfaceSqm: string;
  setSurfaceSqm: (value: string) => void;
  surfaceLocked: boolean;
  t: Translate;
};

/**
 * Room measurements modal opened from the RoomModal info tab: shape preview,
 * computed perimeter/area/sides, and the (optionally scale-locked) surface
 * input. Extracted from RoomModal.tsx.
 */
export const RoomInfoMeasuresModal = ({
  measuresModalOpen,
  open,
  setMeasuresModalOpen,
  shapePreview,
  measurements,
  surfaceSqm,
  setSurfaceSqm,
  surfaceLocked,
  t
}: RoomInfoMeasuresModalProps) => (
      <Transition show={measuresModalOpen && open} as={Fragment}>
        <Dialog as="div" className="relative z-[60]" onClose={() => setMeasuresModalOpen(false)}>
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
                  <div className="modal-header items-center">
                    <Dialog.Title className="modal-title">{t({ it: 'Misure stanza', en: 'Room measurements' })}</Dialog.Title>
                    <button
                      onClick={() => setMeasuresModalOpen(false)}
                      className="icon-button"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="grid gap-3 md:grid-cols-[minmax(0,280px)_1fr]">
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="text-xs font-semibold text-slate-600">
                          {t({ it: 'Forma stanza', en: 'Room shape' })}
                        </div>
                        <div className="mt-2 rounded-lg bg-slate-50 p-2">
                          {shapePreview ? (
                            <RoomShapePreview
                              points={shapePreview.points}
                              segments={shapePreview.segments}
                              width={240}
                              height={160}
                              className="h-40 w-full"
                            />
                          ) : (
                            <div className="flex h-40 items-center justify-center text-xs text-slate-500">
                              {t({ it: 'Anteprima non disponibile', en: 'Preview unavailable' })}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="text-xs font-semibold text-slate-600">
                          {t({ it: 'Misure calcolate', en: 'Computed measurements' })}
                        </div>
                        {!measurements ? (
                          <div className="mt-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                            {t({ it: 'Misure non disponibili per questa stanza.', en: 'Measurements are not available for this room.' })}
                          </div>
                        ) : measurements.scaleMissing ? (
                          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                            {t({ it: 'Imposta una scala planimetria per ottenere le misure in metri.', en: 'Set a floor plan scale to get measurements in meters.' })}
                          </div>
                        ) : (
                          <>
                            {measurements.perimeterLabel ? (
                              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-700">
                                <span>{t({ it: 'Perimetro', en: 'Perimeter' })}</span>
                                <span className="font-mono">{measurements.perimeterLabel}</span>
                              </div>
                            ) : null}
                            {measurements.areaLabel ? (
                              <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-700">
                                <span>{t({ it: 'Area', en: 'Area' })}</span>
                                <span className="font-mono">{measurements.areaLabel}</span>
                              </div>
                            ) : null}
                            {measurements.segments?.length ? (
                              <div className="mt-3">
                                <div className="text-[11px] font-semibold text-slate-500">{t({ it: 'Lati', en: 'Sides' })}</div>
                                <div className="mt-1 max-h-44 space-y-1 overflow-y-auto text-[11px] text-slate-600">
                                  {measurements.segments.map((seg: any) => (
                                    <div key={seg.label} className="flex items-center justify-between gap-2">
                                      <span className="font-mono">{seg.label}</span>
                                      <span className="font-mono">{seg.lengthLabel || '—'}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <label className="block text-sm font-medium text-slate-700">
                        {t({ it: 'Superficie (mq)', en: 'Surface (sqm)' })}
                        <input
                          value={surfaceSqm}
                          onChange={(e) => {
                            if (surfaceLocked) return;
                            setSurfaceSqm(e.target.value);
                          }}
                          inputMode="decimal"
                          type="number"
                          min={0.1}
                          step={0.1}
                          disabled={surfaceLocked}
                          className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2 ${
                            surfaceLocked ? 'border-slate-200 bg-slate-100 text-slate-500' : 'border-slate-200'
                          }`}
                          placeholder={t({ it: 'Es. 24.5', en: 'e.g. 24.5' })}
                        />
                        {surfaceLocked ? (
                          <div className="mt-1 text-xs text-slate-500">
                            {t({
                              it: 'Calcolata automaticamente dalla scala della planimetria.',
                              en: 'Calculated automatically from the floor plan scale.'
                            })}
                          </div>
                        ) : null}
                      </label>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setMeasuresModalOpen(false)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
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
