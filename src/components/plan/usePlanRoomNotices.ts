/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import type { FloorPlan } from '../../store/types';
import { polygonsOverlap } from './planViewRoomGeometry';

// Room-overlap detection + throttled overlap/non-occupiable notices + tool-click-history reset,
// extracted from usePlanView. Bodies + dep arrays moved verbatim; consumed by the room-draw / move /
// scale handler hooks.
export const usePlanRoomNotices = (deps: any) => {
  const { getRoomPolygon, plan, t, push, roomOverlapNoticeRef, setOverlapNotice, nonPeopleRoomNoticeRef, toolClickHistoryRef } = deps;

  const hasRoomOverlap = useCallback(
    (nextRoom: any, excludeId?: string) => {
      const nextPoly = getRoomPolygon(nextRoom);
      if (!nextPoly.length) return false;
      const list = ((plan as FloorPlan)?.rooms || []).filter((r: any) => r.id !== excludeId);
      for (const other of list) {
        const otherPoly = getRoomPolygon(other);
        if (!otherPoly.length) continue;
        if (polygonsOverlap(nextPoly, otherPoly)) return true;
      }
      return false;
    },
    [plan, getRoomPolygon]
  );

  const notifyRoomOverlap = useCallback(() => {
    const now = Date.now();
    if (now - roomOverlapNoticeRef.current < 1200) return;
    roomOverlapNoticeRef.current = now;
    const message = t({ it: 'Attenzione: non è possibile sovrapporre due stanze.', en: 'Warning: rooms cannot overlap.' });
    setOverlapNotice(message);
  }, [t, roomOverlapNoticeRef, setOverlapNotice]);

  const notifyNonPeopleRoomBlocked = useCallback(() => {
    const now = Date.now();
    if (now - nonPeopleRoomNoticeRef.current < 1200) return;
    nonPeopleRoomNoticeRef.current = now;
    push(
      t({
        it: 'Questa stanza non è occupabile (ripostiglio/bagno/locale tecnico): spostamento utente non consentito.',
        en: 'This room is non-occupiable (storage/bathroom/technical): user placement is not allowed.'
      }),
      'info'
    );
  }, [push, t, nonPeopleRoomNoticeRef]);

  const resetToolClickHistory = useCallback(() => {
    toolClickHistoryRef.current = [];
  }, [toolClickHistoryRef]);

  return { hasRoomOverlap, notifyRoomOverlap, notifyNonPeopleRoomBlocked, resetToolClickHistory };
};
