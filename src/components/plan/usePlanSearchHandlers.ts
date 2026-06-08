import { useCallback } from 'react';
import { computeGetClientSearchIndex } from './planViewSearchScheduleTools';
import { runHandleSearchEnter } from './planViewSearchEnter';

// Search handlers extracted from usePlanView (client search index getter +
// search-enter dispatcher). Bodies are verbatim; shared deps injected once.
export const usePlanSearchHandlers = (deps: any) => {
  const {
    client,
    dataVersion,
    clientSearchIndexRef,
    renderPlan,
    plan,
    isDeskType,
    searchDebugEnabled,
    renderPlanObjectById,
    basePlanObjectById,
    renderPlanRoomById,
    basePlanRoomById,
    push,
    t,
    clearSelection,
    promptRevealForObject,
    triggerHighlight,
    setSearchResultsOpen,
    setSearchResultsTerm,
    setSearchResultsObjects,
    setSearchResultsRooms,
    setCrossPlanSearchOpen,
    setCrossPlanSearchTerm,
    setSelectedRoomId,
    setSelectedRoomIds,
    setHighlightRoom,
    setCrossPlanResults,
    setSelectedObject
  } = deps;

  const getClientSearchIndex = useCallback(() => {
    return computeGetClientSearchIndex({
      client,
      dataVersion,
      clientSearchIndexRef
    });
  }, [client, dataVersion, clientSearchIndexRef]);

  const handleSearchEnter = (term: string) => {
    runHandleSearchEnter(term, {
      renderPlan,
      setSearchResultsOpen,
      setSearchResultsTerm,
      setSearchResultsObjects,
      setSearchResultsRooms,
      setCrossPlanSearchOpen,
      setCrossPlanSearchTerm,
      clearSelection,
      setSelectedRoomId,
      setSelectedRoomIds,
      setHighlightRoom,
      isDeskType,
      searchDebugEnabled,
      plan,
      client,
      getClientSearchIndex,
      renderPlanObjectById,
      basePlanObjectById,
      renderPlanRoomById,
      basePlanRoomById,
      push,
      t,
      setCrossPlanResults,
      promptRevealForObject,
      setSelectedObject,
      triggerHighlight
    });
  };

  return { getClientSearchIndex, handleSearchEnter };
};
