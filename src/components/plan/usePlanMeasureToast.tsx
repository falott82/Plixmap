/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import { toast } from 'sonner';

// Scale/measure toast helpers (dismiss scale/measure toasts, format a length label, show the
// live measurement toast) extracted from usePlanView. The toast-id refs stay owned by the host
// (used by other tool flows) and are passed in. Bodies moved verbatim (dep arrays preserved).
export const usePlanMeasureToast = (deps: any) => {
  const { scaleToastIdRef, measureToastIdRef, metersPerPixel, lang, formatNumber, computePolylineLength } = deps;

  const dismissScaleToast = useCallback(() => {
    if (scaleToastIdRef.current == null) return;
    toast.dismiss(scaleToastIdRef.current);
    scaleToastIdRef.current = null;
  }, [scaleToastIdRef]);

  const dismissMeasureToast = useCallback(() => {
    if (measureToastIdRef.current == null) return;
    toast.dismiss(measureToastIdRef.current);
    measureToastIdRef.current = null;
  }, [measureToastIdRef]);

  const formatMeasureLengthLabel = useCallback(
    (lengthPx: number) => {
      if (metersPerPixel) {
        const unit = lang === 'it' ? 'ml' : 'm';
        return `${formatNumber(lengthPx * metersPerPixel)} ${unit}`;
      }
      return `${formatNumber(lengthPx)} px`;
    },
    [formatNumber, lang, metersPerPixel]
  );

  const showMeasureToast = useCallback(
    (points: { x: number; y: number }[], options?: { closed?: boolean; finished?: boolean }) => {
      const closed = !!options?.closed;
      const finished = !!options?.finished;
      let totalPx = computePolylineLength(points);
      if (closed && points.length > 2) {
        const first = points[0];
        const last = points[points.length - 1];
        totalPx += Math.hypot(first.x - last.x, first.y - last.y);
      }
      const sideCount = Math.max(0, points.length - 1) + (closed && points.length > 2 ? 1 : 0);
      const totalLabel = formatMeasureLengthLabel(totalPx);
      const message =
        lang === 'it' ? (
          <span>
            Misurazione attiva: default orizz./vert., <strong>Shift</strong> linea libera, <strong>Backspace</strong> annulla ultimo punto,{' '}
            <strong>Invio</strong> termina, <strong>Q</strong> converte in quote.
            <br />
            <strong>
              Lati: {sideCount} | Totale: {totalLabel}
            </strong>
            {finished ? (
              <>
                <br />
                Misurazione conclusa. Premi <strong>Q</strong> per convertirla in quote.
              </>
            ) : null}
          </span>
        ) : (
          <span>
            Measurement active: default horizontal/vertical, <strong>Shift</strong> free line, <strong>Backspace</strong> removes last point,{' '}
            <strong>Enter</strong> finishes, <strong>Q</strong> converts to quotes.
            <br />
            <strong>
              Sides: {sideCount} | Total: {totalLabel}
            </strong>
            {finished ? (
              <>
                <br />
                Measurement finished. Press <strong>Q</strong> to convert it into quotes.
              </>
            ) : null}
          </span>
        );
      const toastId = toast.info(message, { duration: Infinity, id: measureToastIdRef.current || undefined });
      measureToastIdRef.current = toastId;
    },
    [computePolylineLength, formatMeasureLengthLabel, lang, measureToastIdRef]
  );

  return { dismissScaleToast, dismissMeasureToast, formatMeasureLengthLabel, showMeasureToast };
};
