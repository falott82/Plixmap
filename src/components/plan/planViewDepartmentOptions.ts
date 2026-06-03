import type { Dispatch, SetStateAction } from 'react';
import type { Client, Site } from '../../store/types';
import { listExternalUsers } from '../../api/customImport';
import { fetchMeetingOverview } from '../../api/meetings';
import { currentLocalIsoDay } from '../../utils/localDate';

type MeetingStatus = { hasMeetingToday: boolean; inProgress: boolean; hasFutureToday: boolean };

export type MeetingOverviewDeps = {
  client: Client | undefined;
  site: Site | undefined;
  planId: string;
  setMeetingStatusByRoomId: Dispatch<SetStateAction<Record<string, MeetingStatus>>>;
};

export const runMeetingOverviewEffect = (deps: MeetingOverviewDeps): void | (() => void) => {
  const { client, site, planId, setMeetingStatusByRoomId } = deps;

  let cancelled = false;
  const cid = String(client?.id || '').trim();
  const sid = String(site?.id || '').trim();
  if (!cid || !sid) {
    setMeetingStatusByRoomId({});
    return;
  }
  const load = () => {
    fetchMeetingOverview({ clientId: cid, siteId: sid, floorPlanId: planId, day: currentLocalIsoDay() })
      .then((payload) => {
        if (cancelled) return;
        const nowTs = Date.now();
        const next: Record<string, { hasMeetingToday: boolean; inProgress: boolean; hasFutureToday: boolean }> = {};
        for (const row of payload.rooms || []) {
          const hasFutureToday = Array.isArray(row.bookings)
            ? row.bookings.some((b) => Number(b.startAt) > nowTs)
            : false;
          next[String(row.roomId)] = {
            hasMeetingToday: !!row.hasMeetingToday,
            inProgress: !!row.inProgress,
            hasFutureToday
          };
        }
        setMeetingStatusByRoomId(next);
      })
      .catch(() => {
        if (!cancelled) setMeetingStatusByRoomId({});
      });
  };
  load();
  const timer = window.setInterval(load, 30_000);
  return () => {
    cancelled = true;
    window.clearInterval(timer);
  };
};

export type RoomDepartmentOptionsDeps = {
  client: Client | undefined;
  allClients: Client[] | undefined;
  setRoomDepartmentOptions: Dispatch<SetStateAction<string[]>>;
};

export const runRoomDepartmentOptionsEffect = (deps: RoomDepartmentOptionsDeps): void | (() => void) => {
  const { client, allClients, setRoomDepartmentOptions } = deps;

  let cancelled = false;
  const clientId = String(client?.id || '').trim();
  if (!clientId) {
    setRoomDepartmentOptions([]);
    return;
  }
  const fallbackSet = new Map<string, string>();
  const clientEntry = (allClients || []).find((entry) => entry.id === clientId);
  for (const siteEntry of clientEntry?.sites || []) {
    for (const floor of siteEntry.floorPlans || []) {
      for (const room of floor.rooms || []) {
        for (const tag of (room as any)?.departmentTags || []) {
          const normalized = String(tag || '').trim();
          if (!normalized) continue;
          const folded = normalized.toLocaleLowerCase();
          if (!fallbackSet.has(folded)) fallbackSet.set(folded, normalized);
        }
      }
      for (const obj of floor.objects || []) {
        if (String(obj.type) !== 'real_user') continue;
        for (const dept of [obj.externalDept1, obj.externalDept2, obj.externalDept3]) {
          const normalized = String(dept || '').trim();
          if (!normalized) continue;
          const folded = normalized.toLocaleLowerCase();
          if (!fallbackSet.has(folded)) fallbackSet.set(folded, normalized);
        }
      }
    }
  }
  const applyFallback = () => {
    const fallback = Array.from(fallbackSet.values()).sort((a, b) => a.localeCompare(b));
    if (!cancelled) setRoomDepartmentOptions(fallback);
  };
  void (async () => {
    try {
      const fromImport = new Map<string, string>();
      const pageSize = 1000;
      let offset = 0;
      for (let page = 0; page < 50; page += 1) {
        const res = await listExternalUsers({
          clientId,
          includeHidden: true,
          includeMissing: true,
          limit: pageSize,
          offset
        });
        const rows = Array.isArray(res.rows) ? res.rows : [];
        for (const row of rows) {
          for (const dept of [row.dept1, row.dept2, row.dept3]) {
            const normalized = String(dept || '').trim();
            if (!normalized) continue;
            const folded = normalized.toLocaleLowerCase();
            if (!fromImport.has(folded)) fromImport.set(folded, normalized);
          }
        }
        if (rows.length < pageSize) break;
        offset += rows.length;
        if (cancelled) return;
      }
      for (const [key, value] of fallbackSet.entries()) {
        if (!fromImport.has(key)) fromImport.set(key, value);
      }
      if (!fromImport.size) {
        applyFallback();
        return;
      }
      if (cancelled) return;
      setRoomDepartmentOptions(
        Array.from(fromImport.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      );
    } catch {
      applyFallback();
    }
  })();
  return () => {
    cancelled = true;
  };
};
