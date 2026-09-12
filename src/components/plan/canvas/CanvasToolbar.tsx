/* eslint-disable @typescript-eslint/no-explicit-any */
import { Eye, Hand, MonitorPlay } from 'lucide-react';

// Floating pan/zoom/views/presentation toolbar (plain DOM overlay) extracted from CanvasStage.
export const CanvasToolbar = (props: any) => {
  const {
    t,
    panToolActive,
    onTogglePanTool,
    handleZoomIn,
    handleZoomOut,
    onToggleViewsMenu,
    hasDefaultView,
    onGoDefaultView,
    onTogglePresentation,
    presentationMode
  } = props;
  return (
      <div className="absolute right-4 top-4 flex flex-col gap-2 rounded-xl border border-slate-200/70 bg-white/95 p-2 shadow-card backdrop-blur">
        <button
          title={t({ it: 'Modalità pan', en: 'Pan tool' })}
          aria-pressed={panToolActive}
          onClick={() => onTogglePanTool?.()}
          className={`flex h-8 w-8 items-center justify-center rounded-lg border text-ink hover:bg-slate-50 ${
            panToolActive ? 'border-primary text-primary' : 'border-slate-200'
          }`}
        >
          <Hand size={16} />
        </button>
        <button
          title={t({ it: 'Aumenta zoom', en: 'Zoom in' })}
          onClick={handleZoomIn}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-lg font-semibold text-ink hover:bg-slate-50"
        >
          +
        </button>
        <button
          title={t({ it: 'Riduci zoom', en: 'Zoom out' })}
          onClick={handleZoomOut}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-lg font-semibold text-ink hover:bg-slate-50"
        >
          -
        </button>
          {onToggleViewsMenu ? (
            <button
              title={t({ it: 'Viste salvate', en: 'Saved views' })}
              onClick={() => onToggleViewsMenu?.()}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-ink hover:bg-slate-50"
            >
              <Eye size={16} />
            </button>
          ) : null}
        <button
          title={
              hasDefaultView
                ? t({ it: 'Vai alla vista predefinita', en: 'Go to default view' })
                : t({ it: 'Imposta prima una vista di default', en: 'Set a default view first' })
            }
          onClick={() => {
              if (!hasDefaultView) return;
              onGoDefaultView?.();
            }}
            disabled={!hasDefaultView}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-xs font-semibold text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          VD
        </button>
        {onTogglePresentation ? (
          <button
            title={
              presentationMode
                ? t({ it: 'Esci da presentazione (Esc)', en: 'Exit presentation (Esc)' })
                : t({ it: 'Presentazione (P)', en: 'Presentation (P)' })
            }
            aria-pressed={presentationMode}
            onClick={() => onTogglePresentation?.()}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-slate-50 ${
              presentationMode ? 'border-primary text-primary' : 'border-slate-200 text-ink'
            }`}
          >
            <MonitorPlay size={16} />
          </button>
        ) : null}
      </div>
  );
};
