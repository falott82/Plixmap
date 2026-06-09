/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import { runApplyRoomLayoutExportToSelection } from './planViewMiscCallbacks';
import type { RoomLayoutExportModalSortKey } from './RoomLayoutExportModal';

// Room-layout-export modal handlers (apply to selection, close, select-all/clear/toggle rows,
// sort) extracted from usePlanView. Event handlers (no effects); bodies moved verbatim. The
// state setter is a hook param, so it's listed in the dep arrays.
export const usePlanRoomLayoutExportHandlers = (deps: any) => {
  const {
    roomLayoutExportModal, roomLayoutExportSource, roomLayoutExportRows, push, t, updateRoom, planId,
    markTouched, setPlanDirty, setRoomLayoutExportModal
  } = deps;

  const applyRoomLayoutExportToSelection = useCallback(() => {
    runApplyRoomLayoutExportToSelection({
      roomLayoutExportModal,
      roomLayoutExportSource,
      roomLayoutExportRows,
      push,
      t,
      updateRoom,
      planId,
      markTouched,
      setPlanDirty,
      setRoomLayoutExportModal
    });
  }, [markTouched, planId, push, roomLayoutExportModal, roomLayoutExportRows, roomLayoutExportSource, setPlanDirty, t, updateRoom, setRoomLayoutExportModal]);

  const closeRoomLayoutExportModal = useCallback(() => {
    setRoomLayoutExportModal(null);
  }, [setRoomLayoutExportModal]);

  const selectAllRoomLayoutExportRows = useCallback(() => {
    setRoomLayoutExportModal((prev: any) =>
      !prev
        ? prev
        : {
            ...prev,
            selectedKeys: roomLayoutExportRows.filter((row: any) => !row.isSource).map((row: any) => row.key)
          }
    );
  }, [roomLayoutExportRows, setRoomLayoutExportModal]);

  const clearRoomLayoutExportSelection = useCallback(() => {
    setRoomLayoutExportModal((prev: any) => (prev ? { ...prev, selectedKeys: [] } : prev));
  }, [setRoomLayoutExportModal]);

  const toggleAllRoomLayoutExportRows = useCallback(
    (checked: boolean) => {
      setRoomLayoutExportModal((prev: any) =>
        !prev
          ? prev
          : {
              ...prev,
              selectedKeys: checked ? roomLayoutExportRows.filter((row: any) => !row.isSource).map((row: any) => row.key) : []
            }
      );
    },
    [roomLayoutExportRows, setRoomLayoutExportModal]
  );

  const toggleRoomLayoutExportRow = useCallback((key: string, checked: boolean) => {
    setRoomLayoutExportModal((prev: any) => {
      if (!prev) return prev;
      const selected = new Set(prev.selectedKeys || []);
      if (checked) selected.add(key);
      else selected.delete(key);
      return { ...prev, selectedKeys: Array.from(selected) };
    });
  }, [setRoomLayoutExportModal]);

  const sortRoomLayoutExportRows = useCallback((key: RoomLayoutExportModalSortKey) => {
    setRoomLayoutExportModal((prev: any) =>
      !prev
        ? prev
        : {
            ...prev,
            sortKey: key,
            sortDir: prev.sortKey === key && prev.sortDir === 'asc' ? 'desc' : 'asc'
          }
    );
  }, [setRoomLayoutExportModal]);

  return {
    applyRoomLayoutExportToSelection,
    closeRoomLayoutExportModal,
    selectAllRoomLayoutExportRows,
    clearRoomLayoutExportSelection,
    toggleAllRoomLayoutExportRows,
    toggleRoomLayoutExportRow,
    sortRoomLayoutExportRows,
  };
};
