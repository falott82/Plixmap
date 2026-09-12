import { X } from 'lucide-react';
import { ALL_ITEMS_LAYER_ID } from '../../store/data';

import { usePlanView } from './usePlanView';

type LayersPopoverPanelProps = Pick<ReturnType<typeof usePlanView>, 'allItemsLabel' | 'allItemsSelected' | 'effectiveVisibleLayerIds' | 'getLayerNote' | 'hideAllLayers' | 'lang' | 'layerIds' | 'layersPopoverOpen' | 'layersPopoverRef' | 'normalizeLayerSelection' | 'orderedPlanLayers' | 'planId' | 'setHideAllLayers' | 'setLayersPopoverOpen' | 'setLayersQuickMenu' | 'setVisibleLayerIds' | 't' | 'totalLayerCount' | 'visibleLayerCount'>;

const LayersPopoverPanel = (props: LayersPopoverPanelProps) => {
  const {
    allItemsLabel,
    allItemsSelected,
    effectiveVisibleLayerIds,
    getLayerNote,
    hideAllLayers,
    lang,
    layerIds,
    layersPopoverOpen,
    layersPopoverRef,
    normalizeLayerSelection,
    orderedPlanLayers,
    planId,
    setHideAllLayers,
    setLayersPopoverOpen,
    setLayersQuickMenu,
    setVisibleLayerIds,
    t,
    totalLayerCount,
    visibleLayerCount,
  } = props;
  return (
              <div ref={layersPopoverRef} className="relative">
	                <button
	                  onClick={() => setLayersPopoverOpen((v) => !v)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setLayersQuickMenu({ x: e.clientX, y: e.clientY });
                    setLayersPopoverOpen(false);
                  }}
	                  className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
	                  title={t({ it: 'Layers visibili', en: 'Visible layers' })}
	                >
	                  {t({ it: `${visibleLayerCount}/${totalLayerCount} livelli`, en: `${visibleLayerCount}/${totalLayerCount} layers` })}
                </button>
                {layersPopoverOpen ? (
                  <div className="absolute left-0 z-50 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 text-xs shadow-card">
                    <div className="flex items-center justify-between px-2 pb-2">
                      <div className="font-semibold text-ink">{t({ it: 'Layers mostrati', en: 'Visible layers' })}</div>
                      <button
                        onClick={() => setLayersPopoverOpen(false)}
                        className="text-slate-400 hover:text-ink"
                        title={t({ it: 'Chiudi', en: 'Close' })}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {hideAllLayers ? (
                      <div className="mx-2 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                        {t({ it: 'Livelli nascosti', en: 'Layers hidden' })}
                      </div>
                    ) : null}
                    <div className="mt-2 flex items-center gap-2 px-2">
                      <button
                        onClick={() => {
                          setHideAllLayers(planId, false);
                          setVisibleLayerIds(planId, layerIds);
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {t({ it: 'Tutti', en: 'All' })}
                      </button>
                      <button
                        onClick={() => {
                          setHideAllLayers(planId, false);
                          setVisibleLayerIds(planId, []);
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {t({ it: 'Nessuno', en: 'None' })}
                      </button>
                    </div>
                    <div className="mt-2 max-h-56 space-y-1 overflow-y-auto px-2 pb-1">
                        {orderedPlanLayers.map((layer: any) => {
                          const layerId = String(layer.id);
                          const label =
                            layerId === ALL_ITEMS_LAYER_ID
                              ? allItemsLabel
                              : (layer?.name?.[lang] as string) || (layer?.name?.it as string) || layerId;
                          const checked = hideAllLayers
                            ? false
                            : layerId === ALL_ITEMS_LAYER_ID
                              ? allItemsSelected
                              : allItemsSelected || effectiveVisibleLayerIds.includes(layerId);
                          const note = getLayerNote(layer);
                          return (
                          <label
                            key={layerId}
                            className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] text-slate-700 hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary"
                              checked={checked}
                              onChange={() => {
                                const base = hideAllLayers ? [] : effectiveVisibleLayerIds;
                                setHideAllLayers(planId, false);
                                if (layerId === ALL_ITEMS_LAYER_ID) {
                                  setVisibleLayerIds(planId, checked ? [] : layerIds);
                                  return;
                                }
                                const next = checked ? base.filter((id) => id !== layerId) : [...base, layerId];
                                setVisibleLayerIds(planId, normalizeLayerSelection(next));
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate font-semibold">{label}</span>
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ background: layerId === ALL_ITEMS_LAYER_ID ? '#000' : layer.color || '#94a3b8' }}
                                />
                              </div>
                              {note ? <div className="mt-1 text-[10px] text-slate-500">{note}</div> : null}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
  );
};

export default LayersPopoverPanel;
