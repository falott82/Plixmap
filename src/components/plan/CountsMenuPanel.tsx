import { ChevronDown, X } from 'lucide-react';
import Icon from '../ui/Icon';

import { usePlanView } from './usePlanView';

type CountsMenuPanelProps = Pick<ReturnType<typeof usePlanView>, 'counts' | 'expandedType' | 'getTypeIcon' | 'getTypeLabel' | 'objectListMatches' | 'objectListQuery' | 'objectsByType' | 'renderPlan' | 'setCountsOpen' | 'setExpandedType' | 'setObjectListQuery' | 'setSelectedObject' | 'setTypeMenu' | 't' | 'triggerHighlight'>;

const CountsMenuPanel = (props: CountsMenuPanelProps) => {
  const {
    counts,
    expandedType,
    getTypeIcon,
    getTypeLabel,
    objectListMatches,
    objectListQuery,
    objectsByType,
    renderPlan,
    setCountsOpen,
    setExpandedType,
    setObjectListQuery,
    setSelectedObject,
    setTypeMenu,
    t,
    triggerHighlight,
  } = props;
  if (!renderPlan) return null;
  return (
	                <div className="absolute left-0 z-50 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-card">
	                  <div className="flex items-center justify-between px-2 pb-2">
	                    <div className="text-sm font-semibold text-ink">
                        {t({ it: 'Dettaglio oggetti', en: 'Objects' })}
                      </div>
	                    <button onClick={() => setCountsOpen(false)} className="text-slate-400 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
	                      <X size={14} />
	                    </button>
	                  </div>
	                  <div className="px-2 pb-2">
	                    <input
	                      value={objectListQuery}
	                      onChange={(e) => setObjectListQuery(e.target.value)}
	                      placeholder={t({ it: 'Cerca oggetto…', en: 'Search object…' })}
	                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
	                    />
	                  </div>
	                  <div className="space-y-1">
	                    {objectListQuery.trim() ? (
	                      <>
		                        {objectListMatches.map((o) => {
		                          const label = getTypeLabel(o.type);
                              const icon = getTypeIcon(o.type);
		                          return (
			                            <button
			                              key={o.id}
		                              onClick={() => {
		                                setSelectedObject(o.id);
		                                triggerHighlight(o.id);
		                                setCountsOpen(false);
		                              }}
		                              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50"
		                              title={o.name}
			                            >
		                              <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-primary shadow-sm">
		                                <Icon name={icon} />
		                              </span>
		                              <div className="min-w-0 flex-1">
		                                <div className="truncate font-semibold text-ink">{o.name}</div>
		                                <div className="truncate text-xs text-slate-500">{label}</div>
		                              </div>
		                            </button>
		                          );
		                        })}
	                        {!objectListMatches.length ? (
	                          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                              {t({ it: 'Nessun risultato.', en: 'No results.' })}
                            </div>
	                        ) : null}
	                      </>
	                    ) : (
	                      <>
		                        {counts.map((t) => (
		                          <div key={t.id} className="rounded-lg border border-slate-100">
                            <button
                              onClick={() => setExpandedType(expandedType === t.id ? null : t.id)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setTypeMenu({ typeId: t.id, label: t.label, icon: t.icon, x: e.clientX, y: e.clientY });
                              }}
                              className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50"
                              title={t.label}
                            >
		                              <span className="flex items-center gap-2 font-semibold text-ink">
		                                <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-primary">
		                                  <Icon name={t.icon} />
		                                </span>
		                                {t.count}× {t.label}
		                              </span>
		                              <ChevronDown size={16} className="text-slate-400" />
		                            </button>
		                            {expandedType === t.id ? (
		                              <div className="px-2 pb-2 text-sm text-slate-700">
		                                {(objectsByType.get(t.id) || []).map((o) => (
			                                  <button
			                                    key={o.id}
			                                    onClick={() => {
		                                      setSelectedObject(o.id);
		                                      triggerHighlight(o.id);
		                                      setCountsOpen(false);
		                                    }}
			                                    className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-slate-50"
			                                    title={o.name}
			                                  >
		                                    <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-primary">
		                                      <Icon name={getTypeIcon(o.type)} />
		                                    </span>
		                                    <span className="truncate">{o.name}</span>
		                                  </button>
		                                ))}
		                              </div>
		                            ) : null}
		                          </div>
		                        ))}
	                        {!renderPlan.objects.length ? (
	                          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                              {t({ it: 'Nessun oggetto.', en: 'No objects.' })}
                            </div>
	                        ) : null}
	                      </>
	                    )}
	                  </div>
	                </div>
  );
};

export default CountsMenuPanel;
