import { Fragment } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ChevronLeft, ChevronRight, Download, Maximize2, Minimize2, X } from 'lucide-react';
import {
  Point,
  polygonPath,
  SAFETY_CARD_COLOR_VARIANTS,
  SAFETY_CARD_FONT_VALUES,
  SAFETY_CARD_TEXT_BG_VARIANTS
} from './SafetyPanel.helpers';

type Tr = (m: { it: string; en: string }) => string;

type RoomEntry = { room: { id: string; name?: string }; points: Point[]; center?: Point | null };
type CorridorEntry = { corridor: { id: string; name?: string }; points: Point[]; center?: Point | null };
type DoorAnchorEntry = { corridorId: string; door: { id: string | number }; point: Point };

export type SafetyMapPreview =
  | { kind: 'device'; row: { clientName: string; siteName: string; planName: string; point: Point; name?: string } }
  | {
      kind: 'door';
      row: { clientName: string; siteName: string; planName: string; corridorId?: string; doorId?: string | number; description?: string };
    };

export type SafetySingleMapData = {
  viewBox: string;
  imageUrl?: string | null;
  planWidth: number;
  planHeight: number;
  corridors: CorridorEntry[];
  rooms: RoomEntry[];
  doorAnchors: DoorAnchorEntry[];
};

export type SafetyMultiMapData = {
  viewBox: string;
  plan?: { id: string } | null;
  imageUrl?: string | null;
  planWidth: number;
  planHeight: number;
  corridors: CorridorEntry[];
  rooms: RoomEntry[];
  doorAnchors: DoorAnchorEntry[];
  selectedDoors: { rowId: string; corridorId: string; doorId: string | number; description?: string }[];
  selectedDevices: { rowId: string; point: Point; name?: string }[];
  safetyCard?: {
    layout: { x: number; y: number; w: number; h: number; fontSize?: number; colorIndex?: number; textBgIndex?: number; fontIndex?: number };
    title: string;
    numbersLabel: string;
    numbersText?: string;
    noNumbersText: string;
    pointsLabel: string;
    pointsText?: string;
    noPointsText: string;
  } | null;
};

export type MultiMapOptions = { showRoomNames: boolean; showCorridorNames: boolean; showSafetyCard: boolean };
type PlanOption = { planId: string; label: string; planName: string };

export const SingleMapPreviewModal = (props: {
  t: Tr;
  mapPreview: SafetyMapPreview | null;
  mapData: SafetySingleMapData | null;
  closeSingleMapPreview: () => void;
  exportElementToPdf: (el: HTMLElement | null, filename: string) => void | Promise<void>;
  singleMapExportRef: RefObject<HTMLDivElement | null>;
  singleMapRef: RefObject<HTMLDivElement | null>;
}) => {
  const { t, mapPreview, mapData, closeSingleMapPreview, exportElementToPdf, singleMapExportRef, singleMapRef } = props;
  return (
    <Transition show={!!mapPreview} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={closeSingleMapPreview}>
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/35 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center px-4 py-8">
            <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-6xl modal-panel">
                <div className="modal-header items-center">
                  <Dialog.Title className="modal-title">
                    {mapPreview?.kind === 'device'
                      ? t({ it: 'Mirino dispositivo sicurezza', en: 'Safety device crosshair' })
                      : t({ it: 'Mirino porta emergenza', en: 'Emergency door crosshair' })}
                  </Dialog.Title>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void exportElementToPdf(singleMapExportRef.current, 'safety-crosshair.pdf')}
                      className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                    >
                      <Download size={13} />
                      {t({ it: 'Esporta PDF', en: 'Export PDF' })}
                    </button>
                    <button onClick={closeSingleMapPreview} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                </div>
                {mapPreview ? (
                  <div ref={singleMapExportRef}>
                    <div className="mt-2 text-xs text-slate-600">
                      <span className="font-semibold">{mapPreview.row.clientName}</span> · <span className="font-semibold">{mapPreview.row.siteName}</span> ·{' '}
                      <span className="font-semibold">{mapPreview.row.planName}</span>
                    </div>
                    <div ref={singleMapRef} className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2">
                      <svg viewBox={mapData?.viewBox || '0 0 100 100'} preserveAspectRatio="xMidYMid meet" className="h-[68vh] w-full">
                        {mapData?.imageUrl ? (
                          <image
                            href={mapData.imageUrl}
                            xlinkHref={mapData.imageUrl}
                            x={0}
                            y={0}
                            width={mapData.planWidth}
                            height={mapData.planHeight}
                            preserveAspectRatio="xMidYMid meet"
                            opacity={0.95}
                          />
                        ) : null}
                        {mapData?.corridors.map((entry) => (
                          <path key={`c-${entry.corridor.id}`} d={polygonPath(entry.points)} fill="#e2e8f0" stroke="#64748b" strokeWidth={2} opacity={0.95} />
                        ))}
                        {mapData?.rooms.map((entry) => (
                          <Fragment key={`r-${entry.room.id}`}>
                            <path d={polygonPath(entry.points)} fill="rgba(59,130,246,0.08)" stroke="#3b82f6" strokeWidth={1.6} />
                            {entry.center ? (
                              <text x={entry.center.x} y={entry.center.y} fill="#1e3a8a" fontSize={14} textAnchor="middle" dominantBaseline="middle" style={{ fontWeight: 700 }}>
                                {entry.room.name}
                              </text>
                            ) : null}
                          </Fragment>
                        ))}
                        {mapData?.doorAnchors.map((entry) => {
                          const selectedDoor =
                            mapPreview.kind === 'door' &&
                            entry.corridorId === mapPreview.row.corridorId &&
                            String(entry.door?.id || '') === String(mapPreview.row.doorId || '');
                          const doorRow = mapPreview.kind === 'door' ? mapPreview.row : null;
                          const doorLabel = String(doorRow?.description || doorRow?.doorId || '').trim();
                          return (
                            <Fragment key={`d-${entry.corridorId}-${entry.door.id}`}>
                              <circle
                                cx={entry.point.x}
                                cy={entry.point.y}
                                r={selectedDoor ? 6.5 : 4.5}
                                fill={selectedDoor ? '#f97316' : '#334155'}
                                stroke={selectedDoor ? '#7c2d12' : '#ffffff'}
                                strokeWidth={2}
                              />
                              {selectedDoor && doorLabel ? (
                                <text x={entry.point.x} y={entry.point.y - 10} fill="#7c2d12" fontSize={11} textAnchor="middle" dominantBaseline="ideographic" style={{ fontWeight: 700 }}>
                                  {doorLabel}
                                </text>
                              ) : null}
                            </Fragment>
                          );
                        })}
                        {mapPreview.kind === 'device' ? (
                          <>
                            <circle cx={mapPreview.row.point.x} cy={mapPreview.row.point.y} r={7} fill="#ef4444" stroke="#ffffff" strokeWidth={2.2} />
                            <circle cx={mapPreview.row.point.x} cy={mapPreview.row.point.y} r={13} fill="none" stroke="#ef4444" strokeWidth={1.4} strokeDasharray="4 4" />
                            {mapPreview.row.name ? (
                              <text x={mapPreview.row.point.x} y={mapPreview.row.point.y - 12} fill="#7f1d1d" fontSize={11} textAnchor="middle" dominantBaseline="ideographic" style={{ fontWeight: 700 }}>
                                {mapPreview.row.name}
                              </text>
                            ) : null}
                          </>
                        ) : null}
                      </svg>
                    </div>
                  </div>
                ) : null}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export const MultiMapPreviewModal = (props: {
  t: Tr;
  multiMapPreview: { keys: string[]; planId: string } | null;
  setMultiMapPreview: Dispatch<SetStateAction<{ keys: string[]; planId: string } | null>>;
  multiMapData: SafetyMultiMapData | null;
  multiMapOptions: MultiMapOptions;
  setMultiMapOptions: Dispatch<SetStateAction<MultiMapOptions>>;
  multiMapExporting: boolean;
  multiMapFullscreen: boolean;
  closeMultiMapPreview: () => void;
  exportSelectedMapsToPdf: () => void | Promise<void>;
  toggleMultiMapFullscreen: () => void | Promise<void>;
  multiMapExportRef: RefObject<HTMLDivElement | null>;
  multiMapViewportRef: RefObject<HTMLDivElement | null>;
  multiMapRef: RefObject<HTMLDivElement | null>;
  selectedRows: unknown[];
  selectedPlanOptions: PlanOption[];
  allSelectedForExport: boolean;
  toggleAllExportPlans: (checked: boolean) => void;
  selectedExportPlanIds: string[];
  toggleExportPlanId: (planId: string, checked: boolean) => void;
  goToSelectedPlanOffset: (offset: number) => void;
  canGoPrevPlan: boolean;
  canGoNextPlan: boolean;
}) => {
  const {
    t,
    multiMapPreview,
    setMultiMapPreview,
    multiMapData,
    multiMapOptions,
    setMultiMapOptions,
    multiMapExporting,
    multiMapFullscreen,
    closeMultiMapPreview,
    exportSelectedMapsToPdf,
    toggleMultiMapFullscreen,
    multiMapExportRef,
    multiMapViewportRef,
    multiMapRef,
    selectedRows,
    selectedPlanOptions,
    allSelectedForExport,
    toggleAllExportPlans,
    selectedExportPlanIds,
    toggleExportPlanId,
    goToSelectedPlanOffset,
    canGoPrevPlan,
    canGoNextPlan
  } = props;
  return (
    <Transition show={!!multiMapPreview} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={closeMultiMapPreview}>
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/35 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center px-4 py-8">
            <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-6xl modal-panel">
                <div className="modal-header items-center">
                  <Dialog.Title className="modal-title">{t({ it: 'Mirino oggetti selezionati', en: 'Selected items crosshair' })}</Dialog.Title>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void exportSelectedMapsToPdf()}
                      disabled={multiMapExporting}
                      className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                    >
                      <Download size={13} />
                      {multiMapExporting ? t({ it: 'Export in corso…', en: 'Exporting…' }) : t({ it: 'Esporta PDF', en: 'Export PDF' })}
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleMultiMapFullscreen()}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      title={t({ it: 'Schermo intero (Esc per uscire)', en: 'Fullscreen (Esc to exit)' })}
                    >
                      {multiMapFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                      {multiMapFullscreen ? t({ it: 'Esci full screen', en: 'Exit fullscreen' }) : t({ it: 'Full screen', en: 'Fullscreen' })}
                    </button>
                    <button onClick={closeMultiMapPreview} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                </div>
                {multiMapPreview ? (
                  <div ref={multiMapExportRef}>
                    <div data-pdf-hide="true" className="mt-2 grid gap-2 lg:grid-cols-[1fr_auto] lg:items-center">
                      <div className="text-xs text-slate-600">
                        {t({ it: `${selectedRows.length} oggetti selezionati`, en: `${selectedRows.length} selected items` })}
                      </div>
                      {selectedPlanOptions.length > 1 ? (
                        <select
                          value={multiMapPreview.planId}
                          onChange={(e) => setMultiMapPreview((prev) => (prev ? { ...prev, planId: e.target.value } : prev))}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                        >
                          {selectedPlanOptions.map((entry) => (
                            <option key={entry.planId} value={entry.planId}>
                              {entry.label}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                    {selectedPlanOptions.length > 1 ? (
                      <div data-pdf-hide="true" className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                        <div className="mb-2 font-semibold">{t({ it: 'Export planimetrie', en: 'Export floor plans' })}</div>
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="inline-flex cursor-pointer items-center gap-2">
                            <input type="checkbox" checked={allSelectedForExport} onChange={(e) => toggleAllExportPlans(e.target.checked)} />
                            <span className="font-semibold">{t({ it: 'Tutte', en: 'All' })}</span>
                          </label>
                          {selectedPlanOptions.map((entry) => (
                            <label key={`exp-${entry.planId}`} className="inline-flex cursor-pointer items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedExportPlanIds.includes(entry.planId)}
                                onChange={(e) => toggleExportPlanId(entry.planId, e.target.checked)}
                              />
                              <span>{entry.planName}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div data-pdf-hide="true" className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                      <label className="inline-flex cursor-pointer items-center gap-2">
                        <input type="checkbox" checked={multiMapOptions.showRoomNames} onChange={(e) => setMultiMapOptions((prev) => ({ ...prev, showRoomNames: e.target.checked }))} />
                        {t({ it: 'Nomi stanze', en: 'Room names' })}
                      </label>
                      <label className="inline-flex cursor-pointer items-center gap-2">
                        <input type="checkbox" checked={multiMapOptions.showCorridorNames} onChange={(e) => setMultiMapOptions((prev) => ({ ...prev, showCorridorNames: e.target.checked }))} />
                        {t({ it: 'Nomi corridoi', en: 'Corridor names' })}
                      </label>
                      <label className="inline-flex cursor-pointer items-center gap-2">
                        <input type="checkbox" checked={multiMapOptions.showSafetyCard} onChange={(e) => setMultiMapOptions((prev) => ({ ...prev, showSafetyCard: e.target.checked }))} />
                        {t({ it: 'Scheda sicurezza', en: 'Safety card' })}
                      </label>
                      {selectedPlanOptions.length > 1 ? (
                        <span className="ml-auto text-[11px] font-semibold text-slate-500">
                          {t({ it: 'Frecce tastiera: planimetria precedente/successiva', en: 'Arrow keys: previous/next floor plan' })}
                        </span>
                      ) : null}
                    </div>
                    <div ref={multiMapViewportRef} data-pdf-map-wrap="true" className="mt-4 relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2">
                      <div ref={multiMapRef}>
                        <svg
                          viewBox={multiMapData?.viewBox || '0 0 100 100'}
                          data-export-plan-id={multiMapData?.plan?.id || ''}
                          preserveAspectRatio="xMidYMid meet"
                          className={multiMapFullscreen ? 'h-[calc(100vh-1rem)] w-full' : 'h-[68vh] w-full'}
                        >
                          {multiMapData?.imageUrl ? (
                            <image
                              href={multiMapData.imageUrl}
                              xlinkHref={multiMapData.imageUrl}
                              x={0}
                              y={0}
                              width={multiMapData.planWidth}
                              height={multiMapData.planHeight}
                              preserveAspectRatio="xMidYMid meet"
                              opacity={0.95}
                            />
                          ) : null}
                          {multiMapData?.corridors.map((entry) => (
                            <Fragment key={`mc-${entry.corridor.id}`}>
                              <path d={polygonPath(entry.points)} fill="#e2e8f0" stroke="#64748b" strokeWidth={2} opacity={0.95} />
                              {multiMapOptions.showCorridorNames && entry.center && String(entry.corridor?.name || '').trim() ? (
                                <text x={entry.center.x} y={entry.center.y} fill="#0f172a" fontSize={12} textAnchor="middle" dominantBaseline="middle" style={{ fontWeight: 700 }}>
                                  {entry.corridor.name}
                                </text>
                              ) : null}
                            </Fragment>
                          ))}
                          {multiMapData?.rooms.map((entry) => (
                            <Fragment key={`mr-${entry.room.id}`}>
                              <path d={polygonPath(entry.points)} fill="rgba(59,130,246,0.08)" stroke="#3b82f6" strokeWidth={1.3} />
                              {multiMapOptions.showRoomNames && entry.center && String(entry.room?.name || '').trim() ? (
                                <text x={entry.center.x} y={entry.center.y} fill="#1e3a8a" fontSize={12} textAnchor="middle" dominantBaseline="middle" style={{ fontWeight: 700 }}>
                                  {entry.room.name}
                                </text>
                              ) : null}
                            </Fragment>
                          ))}
                          {multiMapOptions.showSafetyCard && multiMapData?.safetyCard ? (
                            (() => {
                              const layout = multiMapData.safetyCard.layout;
                              const headerHeight = Math.max(18, Number(layout.fontSize || 10) * 1.48);
                              const bodyFontSize = Math.max(8, Number(layout.fontSize || 10));
                              const colorVariant =
                                SAFETY_CARD_COLOR_VARIANTS[
                                  ((Number(layout.colorIndex) % SAFETY_CARD_COLOR_VARIANTS.length) + SAFETY_CARD_COLOR_VARIANTS.length) % SAFETY_CARD_COLOR_VARIANTS.length
                                ];
                              const textBgFill =
                                SAFETY_CARD_TEXT_BG_VARIANTS[
                                  ((Number(layout.textBgIndex) % SAFETY_CARD_TEXT_BG_VARIANTS.length) + SAFETY_CARD_TEXT_BG_VARIANTS.length) % SAFETY_CARD_TEXT_BG_VARIANTS.length
                                ];
                              const fontFamily = SAFETY_CARD_FONT_VALUES.length
                                ? SAFETY_CARD_FONT_VALUES[((Number(layout.fontIndex) % SAFETY_CARD_FONT_VALUES.length) + SAFETY_CARD_FONT_VALUES.length) % SAFETY_CARD_FONT_VALUES.length]
                                : 'Arial, sans-serif';
                              const numbersText = `${multiMapData.safetyCard.numbersLabel}: ${multiMapData.safetyCard.numbersText || multiMapData.safetyCard.noNumbersText}`;
                              const pointsText = `${multiMapData.safetyCard.pointsLabel}: ${multiMapData.safetyCard.pointsText || multiMapData.safetyCard.noPointsText}`;
                              return (
                                <g>
                                  <rect x={layout.x} y={layout.y} width={layout.w} height={layout.h} fill={colorVariant.body} stroke={colorVariant.border} strokeWidth={1.6} rx={0} />
                                  <rect x={layout.x + 1} y={layout.y + 1} width={Math.max(1, layout.w - 2)} height={Math.max(1, headerHeight - 1)} fill={colorVariant.header} rx={0} />
                                  <text
                                    x={layout.x + 10}
                                    y={layout.y + headerHeight / 2 + 1}
                                    fill={colorVariant.title}
                                    fontSize={Math.max(9, bodyFontSize * 0.92)}
                                    fontFamily={fontFamily}
                                    dominantBaseline="middle"
                                    style={{ fontWeight: 700 }}
                                  >
                                    {multiMapData.safetyCard.title}
                                  </text>
                                  {textBgFill !== 'transparent' ? (
                                    <>
                                      <rect x={layout.x + 8} y={layout.y + headerHeight + 1} width={Math.max(24, layout.w - 16)} height={Math.max(10, bodyFontSize * 1.26)} fill={textBgFill} />
                                      <rect
                                        x={layout.x + 8}
                                        y={layout.y + headerHeight + bodyFontSize + 5}
                                        width={Math.max(24, layout.w - 16)}
                                        height={Math.max(10, bodyFontSize * 1.26)}
                                        fill={textBgFill}
                                      />
                                    </>
                                  ) : null}
                                  <text x={layout.x + 10} y={layout.y + headerHeight + bodyFontSize + 2} fill={colorVariant.text} fontSize={bodyFontSize} fontFamily={fontFamily} style={{ fontWeight: 700 }}>
                                    {numbersText}
                                  </text>
                                  <text x={layout.x + 10} y={layout.y + headerHeight + bodyFontSize * 2 + 6} fill={colorVariant.text} fontSize={bodyFontSize} fontFamily={fontFamily} style={{ fontWeight: 700 }}>
                                    {pointsText}
                                  </text>
                                </g>
                              );
                            })()
                          ) : null}
                          {multiMapData?.selectedDoors.map((entry) => {
                            const anchor = multiMapData.doorAnchors.find((item) => item.corridorId === entry.corridorId && String(item.door.id) === String(entry.doorId));
                            if (!anchor) return null;
                            const label = String(entry.description || entry.doorId || '').trim();
                            return (
                              <Fragment key={`md-${entry.rowId}`}>
                                <circle cx={anchor.point.x} cy={anchor.point.y} r={6.5} fill="#f97316" stroke="#7c2d12" strokeWidth={2} />
                                {label ? (
                                  <text x={anchor.point.x} y={anchor.point.y - 10} fill="#7c2d12" fontSize={11} textAnchor="middle" dominantBaseline="ideographic" style={{ fontWeight: 700 }}>
                                    {label}
                                  </text>
                                ) : null}
                              </Fragment>
                            );
                          })}
                          {multiMapData?.selectedDevices.map((entry) => (
                            <Fragment key={`mdev-${entry.rowId}`}>
                              <circle cx={entry.point.x} cy={entry.point.y} r={7} fill="#ef4444" stroke="#ffffff" strokeWidth={2.2} />
                              <circle cx={entry.point.x} cy={entry.point.y} r={13} fill="none" stroke="#ef4444" strokeWidth={1.4} strokeDasharray="4 4" />
                              {entry.name ? (
                                <text x={entry.point.x} y={entry.point.y - 12} fill="#7f1d1d" fontSize={11} textAnchor="middle" dominantBaseline="ideographic" style={{ fontWeight: 700 }}>
                                  {entry.name}
                                </text>
                              ) : null}
                            </Fragment>
                          ))}
                        </svg>
                      </div>
                      {selectedPlanOptions.length > 1 ? (
                        <>
                          <button
                            data-pdf-hide="true"
                            type="button"
                            onClick={() => goToSelectedPlanOffset(-1)}
                            disabled={!canGoPrevPlan}
                            className="absolute bottom-3 left-3 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white/95 text-slate-700 shadow-card hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                            title={t({ it: 'Planimetria precedente (←)', en: 'Previous floor plan (←)' })}
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <button
                            data-pdf-hide="true"
                            type="button"
                            onClick={() => goToSelectedPlanOffset(1)}
                            disabled={!canGoNextPlan}
                            className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white/95 text-slate-700 shadow-card hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                            title={t({ it: 'Planimetria successiva (→)', en: 'Next floor plan (→)' })}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};
