/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useMemo } from 'react';
import { computeRecommendedObjectScale } from './planViewComputeBits';
import { computeScaleLine } from './planViewComputeBits2';

// Scale + measurement label derivations (scale label/line, recommended object scale, measure
// preview points/length/area + their labels, quote labels) extracted from usePlanView. Pure
// read-only derivations; bodies moved verbatim (dep arrays preserved exactly).
export const usePlanMeasureScale = (deps: any) => {
  const {
    planScale, lang, formatNumber, renderPlan, lastObjectScale, showScaleLine, measurePoints,
    measurePointer, measureFinished, measureClosed, computePolylineLength, computePolygonArea,
    metersPerPixel, quotePoints, quotePointer
  } = deps;

  const scaleLabel = useMemo(() => {
    if (!planScale?.meters) return null;
    const unit = lang === 'it' ? 'ml' : 'm';
    return `${formatNumber(Number(planScale.meters))} ${unit}`;
  }, [formatNumber, lang, planScale?.meters]);
  const recommendedObjectScale = useMemo(
    () => computeRecommendedObjectScale(Number(renderPlan?.width || 0), Number(renderPlan?.height || 0)),
    [renderPlan?.height, renderPlan?.width]
  );
  const defaultObjectScale = useMemo(() => {
    if (lastObjectScale !== 1) return lastObjectScale;
    return Number.isFinite(recommendedObjectScale) ? recommendedObjectScale : 1;
  }, [lastObjectScale, recommendedObjectScale]);
  const scaleLine = useMemo(
    () => computeScaleLine({ showScaleLine, planScale, scaleLabel }),
    [
      planScale?.end,
      planScale?.labelScale,
      planScale?.opacity,
      planScale?.start,
      planScale?.strokeWidth,
      scaleLabel,
      showScaleLine
    ]
  );
  const measurePreviewPoints = useMemo(() => {
    if (!measurePoints.length) return [];
    if (measurePointer && !measureFinished && !measureClosed) {
      return [...measurePoints, measurePointer];
    }
    return measurePoints;
  }, [measureClosed, measureFinished, measurePointer, measurePoints]);
  const measureLengthPx = useMemo(() => {
    if (measurePreviewPoints.length < 2) return 0;
    let length = computePolylineLength(measurePreviewPoints);
    if (measureClosed && measurePreviewPoints.length > 2) {
      const first = measurePreviewPoints[0];
      const last = measurePreviewPoints[measurePreviewPoints.length - 1];
      length += Math.hypot(first.x - last.x, first.y - last.y);
    }
    return length;
  }, [computePolylineLength, measureClosed, measurePreviewPoints]);
  const measureAreaPx = useMemo(() => (measureClosed ? computePolygonArea(measurePoints) : 0), [computePolygonArea, measureClosed, measurePoints]);
  const measureLabel = useMemo(() => {
    if (!measurePreviewPoints.length) return null;
    if (metersPerPixel) {
      const meters = measureLengthPx * metersPerPixel;
      const unit = lang === 'it' ? 'ml' : 'm';
      return `${formatNumber(meters)} ${unit}`;
    }
    return `${formatNumber(measureLengthPx)} px`;
  }, [formatNumber, lang, measureLengthPx, measurePreviewPoints.length, metersPerPixel]);
  const measureAreaLabel = useMemo(() => {
    if (!measureClosed || !metersPerPixel) return null;
    const sqm = measureAreaPx * metersPerPixel * metersPerPixel;
    const unit = lang === 'it' ? 'mq' : 'sqm';
    return `${formatNumber(sqm)} ${unit}`;
  }, [formatNumber, lang, measureAreaPx, measureClosed, metersPerPixel]);
  const formatQuoteLabel = useCallback(
    (points: { x: number; y: number }[]) => {
      if (points.length < 2) return null;
      const lengthPx = computePolylineLength(points);
      if (metersPerPixel) {
        const unit = lang === 'it' ? 'ml' : 'm';
        return `${formatNumber(lengthPx * metersPerPixel)} ${unit}`;
      }
      return `${formatNumber(lengthPx)} px`;
    },
    [computePolylineLength, formatNumber, lang, metersPerPixel]
  );
  const quoteDraftLabel = useMemo(() => {
    if (!quotePoints.length) return null;
    const points = quotePointer ? [...quotePoints, quotePointer] : quotePoints;
    return formatQuoteLabel(points);
  }, [formatQuoteLabel, quotePoints, quotePointer]);

  return {
    scaleLabel,
    recommendedObjectScale,
    defaultObjectScale,
    scaleLine,
    measurePreviewPoints,
    measureLengthPx,
    measureAreaPx,
    measureLabel,
    measureAreaLabel,
    formatQuoteLabel,
    quoteDraftLabel,
  };
};
