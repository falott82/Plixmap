/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from 'react';
import { computeModalInitials } from './planViewModalInitials';

// Initial values for the object modal (derived from the active modalState + plan + last-used quote
// styling) extracted from usePlanView. Pure derivation; body + dep array moved verbatim.
export const usePlanModalInitials = (deps: any) => {
  const {
    modalState, renderPlan, renderPlanObjectById, layerIdSet, defaultObjectScale, getTypeLayerIds,
    inferDefaultLayerIds, formatQuoteLabel, lastQuoteLabelScale, lastQuoteLabelBg, lastQuoteLabelPosH,
    lastQuoteDashed, lastQuoteEndpoint, lastQuoteColor, lastQuoteLabelColor
  } = deps;

  return useMemo(
    () =>
      computeModalInitials({
        modalState,
        renderPlan,
        renderPlanObjectById,
        layerIdSet,
        defaultObjectScale,
        getTypeLayerIds,
        inferDefaultLayerIds,
        formatQuoteLabel,
        lastQuoteLabelScale,
        lastQuoteLabelBg,
        lastQuoteLabelPosH,
        lastQuoteDashed,
        lastQuoteEndpoint,
        lastQuoteColor,
        lastQuoteLabelColor
      }),
    [
      defaultObjectScale,
      formatQuoteLabel,
      getTypeLayerIds,
      inferDefaultLayerIds,
      layerIdSet,
      lastQuoteColor,
      lastQuoteDashed,
      lastQuoteEndpoint,
      lastQuoteLabelColor,
      lastQuoteLabelPosH,
      lastQuoteLabelBg,
      lastQuoteLabelScale,
      modalState,
      renderPlan,
      renderPlanObjectById
    ]
  );
};
