/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { SAFETY_CARD_HELP_TOAST_ID } from '../CanvasStage.helpers';

// Safety-card "selected" help toast (shortcut hints) extracted from CanvasStage.
export const useCanvasSafetyCardHelpToast = (deps: {
  t: any;
  readOnly: boolean;
  safetyCard: any;
  safetyCardSelected: boolean;
}) => {
  const { t, readOnly, safetyCard, safetyCardSelected } = deps;

  const showSafetyCardHelpToast = useCallback(() => {
    toast.info(
      <div className="text-left text-slate-900">
        <div className="text-sm font-semibold text-slate-900">
          {t({ it: 'Scheda sicurezza selezionata', en: 'Safety card selected' })}
        </div>
        <div className="mt-1.5 space-y-0.5 text-xs text-slate-700">
          <div>
            <strong className="font-semibold">Drag</strong> {t({ it: 'sposta', en: 'move' })}
          </div>
          <div>
            <strong className="font-semibold">Resize</strong> {t({ it: 'come una stanza', en: 'like a room' })}
          </div>
          <div>
            <strong className="font-semibold">+ / -</strong> {t({ it: 'dimensione testo', en: 'text size' })}
          </div>
          <div>
            <strong className="font-semibold">F / Shift+F</strong> {t({ it: 'font successivo / precedente', en: 'next / previous font' })}
          </div>
          <div>
            <strong className="font-semibold">C</strong> {t({ it: 'colore scheda', en: 'card color' })}
          </div>
          <div>
            <strong className="font-semibold">B</strong> {t({ it: 'sfondo testo', en: 'text background' })}
          </div>
          <div>
            <strong className="font-semibold">{t({ it: 'Click', en: 'Click' })}</strong> {t({ it: 'seleziona la scheda', en: 'selects the card' })}
          </div>
          <div>
            <strong className="font-semibold">{t({ it: 'Doppio click', en: 'Double click' })}</strong> {t({ it: 'apre rubrica emergenze', en: 'opens emergency directory' })}
          </div>
          <div>
            <strong className="font-semibold">{t({ it: 'Tasto destro', en: 'Right click' })}</strong> {t({ it: 'apre il menu scheda sicurezza', en: 'opens the safety card menu' })}
          </div>
          {readOnly ? (
            <div className="pt-0.5 text-[11px] font-semibold text-amber-700">{t({ it: 'Modalita sola lettura: drag/resize disabilitati', en: 'Read-only mode: drag/resize disabled' })}</div>
          ) : null}
        </div>
      </div>,
      { id: SAFETY_CARD_HELP_TOAST_ID, duration: Infinity }
    );
  }, [readOnly, t]);

  useEffect(() => {
    if (!safetyCard?.visible) {
      toast.dismiss(SAFETY_CARD_HELP_TOAST_ID);
      return;
    }
    if (!safetyCardSelected) {
      toast.dismiss(SAFETY_CARD_HELP_TOAST_ID);
      return;
    }
    showSafetyCardHelpToast();
  }, [safetyCard?.visible, safetyCardSelected, showSafetyCardHelpToast]);

  return { showSafetyCardHelpToast };
};
