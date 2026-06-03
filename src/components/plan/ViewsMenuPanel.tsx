import { Eye, Trash, X, Star, Save } from 'lucide-react';

import { usePlanView } from './usePlanView';

type ViewsMenuPanelProps = Pick<ReturnType<typeof usePlanView>, 'applyView' | 'basePlan' | 'handleOverwriteView' | 'orderedViews' | 'push' | 'selectedViewId' | 'setChooseDefaultModal' | 'setConfirmDeleteViewId' | 'setConfirmSetDefaultViewId' | 'setSelectedViewId' | 'setViewModalOpen' | 'setViewsMenuOpen' | 't'>;

const ViewsMenuPanel = (props: ViewsMenuPanelProps) => {
  const {
    applyView,
    basePlan,
    handleOverwriteView,
    orderedViews,
    push,
    selectedViewId,
    setChooseDefaultModal,
    setConfirmDeleteViewId,
    setConfirmSetDefaultViewId,
    setSelectedViewId,
    setViewModalOpen,
    setViewsMenuOpen,
    t,
  } = props;
  return (
              <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-2 shadow-card">
                <div className="flex items-center justify-between px-2 pb-2">
                  <div className="text-sm font-semibold text-ink">{t({ it: 'Viste salvate', en: 'Saved views' })}</div>
                  <button
                    onClick={() => setViewsMenuOpen(false)}
                    className="text-slate-400 hover:text-ink"
                    title={t({ it: 'Chiudi', en: 'Close' })}
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="space-y-1">
	                  <button
	                    onClick={() => {
	                      setSelectedViewId('__last__');
	                      setViewsMenuOpen(false);
	                      push(t({ it: 'Vista: ultima posizione', en: 'View: last position' }), 'info');
	                    }}
	                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50 ${
	                      selectedViewId === '__last__' ? 'bg-slate-100 font-semibold' : ''
	                    }`}
	                    title={t({ it: 'Ultima posizione', en: 'Last position' })}
	                  >
                    <Eye size={16} className="text-slate-500" />
                    {t({ it: 'Ultima posizione', en: 'Last position' })}
                  </button>
                  {orderedViews.map((view) => (
	                    <div key={view.id} className="flex items-start gap-2 rounded-lg border border-slate-100 px-2 py-2 hover:bg-slate-50">
	                      <button
	                        onClick={() => {
	                          applyView(view);
	                          setViewsMenuOpen(false);
	                        }}
	                        className={`flex min-w-0 flex-1 items-start gap-2 text-left text-sm ${
	                          selectedViewId === view.id ? 'font-semibold' : ''
	                        }`}
	                        title={view.name}
	                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-ink">{view.name}</div>
	                          {view.description ? (
	                            <div className="truncate text-xs text-slate-500">{view.description}</div>
	                          ) : null}
                        </div>
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          title={t({ it: view.isDefault ? 'Vista di default' : 'Rendi default', en: view.isDefault ? 'Default view' : 'Make default' })}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!view.isDefault) setConfirmSetDefaultViewId(view.id);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-white"
                        >
                          <Star size={14} className={view.isDefault ? 'text-amber-500' : 'text-slate-400'} />
                        </button>
                        <button
                          title={t({ it: 'Sovrascrivi con vista attuale', en: 'Overwrite with current view' })}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOverwriteView(view);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                        >
                          <Save size={14} />
                        </button>
                        <button
                          title={t({ it: 'Elimina vista', en: 'Delete view' })}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (view.isDefault && (basePlan.views || []).length > 1) {
                              setChooseDefaultModal({ deletingViewId: view.id });
                              return;
                            }
                            setConfirmDeleteViewId(view.id);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 border-t border-slate-100 pt-2">
	                  <button
	                    onClick={() => {
	                      setViewsMenuOpen(false);
	                      setViewModalOpen(true);
	                    }}
	                    className="w-full btn-primary"
	                    title={t({ it: 'Salva nuova vista', en: 'Save new view' })}
	                  >
                    {t({ it: 'Salva nuova vista', en: 'Save new view' })}
                  </button>
                </div>
              </div>
  );
};

export default ViewsMenuPanel;
