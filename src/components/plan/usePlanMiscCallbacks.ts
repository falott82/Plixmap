/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useMemo } from 'react';
import { computeAlignSelection, computeSaveRevisionReason } from './planViewMiscTools';
import { computeSubmenuStyle } from './planViewComputeBits';

// Small leftover delegating callbacks/memos from usePlanView (align selection, save-revision reason,
// context submenu style, map submenu toggle). Bodies + dep arrays moved verbatim.
export const usePlanMiscCallbacks = (deps: any) => {
  const {
    getObjectBoundsForAlign, isReadOnly, isWallType, markTouched, moveObject, renderPlan, selectedObjects,
    updateObject, pendingClientMeetingsPreset, pendingMeetingManagerPreset, pendingPostSaveAction,
    pendingNavigateRef, contextMenu, contextMenuRef, setMapSubmenu
  } = deps;

  const alignSelection = useCallback(
    (mode: 'horizontal' | 'vertical', referenceId?: string) =>
      computeAlignSelection(mode, referenceId, {
        getObjectBoundsForAlign, isReadOnly, isWallType, markTouched, moveObject, renderPlan,
        selectedObjects,
        updateObject
      }),
    [getObjectBoundsForAlign, isReadOnly, isWallType, markTouched, moveObject, renderPlan, selectedObjects, updateObject]
  );

  const saveRevisionReason = useMemo(() => {
    return computeSaveRevisionReason({
      pendingClientMeetingsPreset, pendingMeetingManagerPreset, pendingPostSaveAction,
      pendingNavigateRef
    });
  }, [pendingClientMeetingsPreset, pendingMeetingManagerPreset, pendingPostSaveAction]);

  const getSubmenuStyle = useCallback(
    (submenuWidth: number) => computeSubmenuStyle(submenuWidth, { contextMenu, contextMenuRef }),
    [contextMenu]
  );

  const toggleMapSubmenu = useCallback((section: any) => {
    setMapSubmenu((prev: any) => (prev === section ? null : section));
  }, [setMapSubmenu]);

  return { alignSelection, saveRevisionReason, getSubmenuStyle, toggleMapSubmenu };
};
