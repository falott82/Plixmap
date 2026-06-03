import type { Client, FloorPlan, RackItem, RackLink } from '../../store/types';
import type { RoomLayoutExportModalState, RoomLayoutExportRow } from './RoomLayoutExportModal';

// Pure computations extracted from usePlanView hooks. Bodies are verbatim; the closed-over
// values are passed in via `deps`, mirroring each hook's original dependency array so the
// hook wrappers and their deps stay unchanged.

export type RackOverlayLinksDeps = {
  renderPlan: FloorPlan | undefined;
};

export const computeRackOverlayLinks = (deps: RackOverlayLinksDeps) => {
  const { renderPlan } = deps;
  if (!renderPlan) return [] as any[];
  const rackItems = ((renderPlan as any).rackItems || []) as RackItem[];
  const rackLinks = ((renderPlan as any).rackLinks || []) as RackLink[];
  if (!rackItems.length || !rackLinks.length) return [] as any[];
  const itemsById = new Map(rackItems.map((item) => [item.id, item]));
  const rackObjectsById = new Map(
    (renderPlan.objects || []).filter((obj) => obj.type === 'rack').map((obj) => [obj.id, obj])
  );
  const grouped = new Map<
    string,
    { rackA: string; rackB: string; ethernet: { link: RackLink; fromItem: RackItem; toItem: RackItem }[]; fiber: { link: RackLink; fromItem: RackItem; toItem: RackItem }[] }
  >();
  for (const link of rackLinks) {
    const fromItem = itemsById.get(link.fromItemId);
    const toItem = itemsById.get(link.toItemId);
    if (!fromItem || !toItem) continue;
    if (fromItem.rackId === toItem.rackId) continue;
    const fromObj = rackObjectsById.get(fromItem.rackId);
    const toObj = rackObjectsById.get(toItem.rackId);
    if (!fromObj || !toObj) continue;
    const pair = [fromItem.rackId, toItem.rackId].sort();
    const key = pair.join('|');
    const kind = link.kind === 'fiber' ? 'fiber' : 'ethernet';
    const entry = grouped.get(key) || { rackA: pair[0], rackB: pair[1], ethernet: [], fiber: [] };
    entry[kind].push({ link, fromItem, toItem });
    grouped.set(key, entry);
  }
  const out: any[] = [];
  const spacing = 8;
  const baseWidth = 2 * 0.6;
  grouped.forEach((entry, key) => {
    const hasEthernet = entry.ethernet.length > 0;
    const hasFiber = entry.fiber.length > 0;
    const offsetDelta = hasEthernet && hasFiber ? spacing / 2 : 0;
    if (hasEthernet) {
      const rep = entry.ethernet
        .slice()
        .sort((a, b) => Number(a.link.createdAt || 0) - Number(b.link.createdAt || 0))[0];
      if (rep) {
        out.push({
          id: `racklink:${key}:ethernet`,
          fromId: entry.rackA,
          toId: entry.rackB,
          kind: 'cable',
          dashed: true,
          route: 'vh',
          width: baseWidth,
          selectedWidthDelta: 0.6,
          color: '#3b82f6',
          offset: hasFiber ? -offsetDelta : 0,
          rackLinkId: rep.link.id,
          rackFromItemId: rep.link.fromItemId,
          rackToItemId: rep.link.toItemId,
          rackKind: 'ethernet',
          rackFromRackId: rep.fromItem.rackId,
          rackToRackId: rep.toItem.rackId
        });
      }
    }
    if (hasFiber) {
      const rep = entry.fiber
        .slice()
        .sort((a, b) => Number(a.link.createdAt || 0) - Number(b.link.createdAt || 0))[0];
      if (rep) {
        out.push({
          id: `racklink:${key}:fiber`,
          fromId: entry.rackA,
          toId: entry.rackB,
          kind: 'cable',
          dashed: true,
          route: 'vh',
          width: baseWidth,
          selectedWidthDelta: 0.6,
          color: '#a855f7',
          offset: hasEthernet ? offsetDelta : 0,
          rackLinkId: rep.link.id,
          rackFromItemId: rep.link.fromItemId,
          rackToItemId: rep.link.toItemId,
          rackKind: 'fiber',
          rackFromRackId: rep.fromItem.rackId,
          rackToRackId: rep.toItem.rackId
        });
      }
    }
  });
  return out;
};

export type RoomLayoutExportRowsDeps = {
  allClients: Client[];
  roomLayoutExportModal: RoomLayoutExportModalState | null;
};

export const computeRoomLayoutExportRows = (deps: RoomLayoutExportRowsDeps) => {
  const { allClients, roomLayoutExportModal } = deps;
  if (!roomLayoutExportModal) return [] as RoomLayoutExportRow[];
  const out: RoomLayoutExportRow[] = [];
  const clientEntry = (allClients || []).find((c) => String(c.id) === String(roomLayoutExportModal.clientId));
  if (!clientEntry) return out;
  for (const siteEntry of clientEntry.sites || []) {
    for (const floorPlanEntry of siteEntry.floorPlans || []) {
      for (const roomEntry of (floorPlanEntry as any).rooms || []) {
        if (!roomEntry?.id) continue;
        const flags = {
          meetingRoom: !!(roomEntry as any)?.meetingRoom,
          logical: !!(roomEntry as any)?.logical,
          storageRoom: !!(roomEntry as any)?.storageRoom,
          bathroom: !!(roomEntry as any)?.bathroom,
          technicalRoom: !!(roomEntry as any)?.technicalRoom,
          noWindows: !!(roomEntry as any)?.noWindows
        };
        const codeDefs: Array<[string, boolean]> = [
          ['MR', flags.meetingRoom],
          ['RL', flags.logical],
          ['RP', flags.storageRoom],
          ['BA', flags.bathroom],
          ['LT', flags.technicalRoom],
          ['SF', flags.noWindows]
        ];
        const key = `${String(floorPlanEntry.id)}::${String(roomEntry.id)}`;
        out.push({
          key,
          clientId: String(clientEntry.id),
          siteId: String(siteEntry.id),
          siteName: String(siteEntry.name || ''),
          planId: String(floorPlanEntry.id),
          planName: String(floorPlanEntry.name || ''),
          roomId: String(roomEntry.id),
          roomName: String((roomEntry as any).name || ''),
          capacity: Number.isFinite(Number((roomEntry as any).capacity)) ? Math.max(0, Math.floor(Number((roomEntry as any).capacity))) : 0,
          typeCodes: codeDefs.filter(([, active]) => active).map(([code]) => code).join(' · ') || '—',
          typeFlagsLabel: codeDefs.map(([code, active]) => `${code}:${active ? '1' : '0'}`).join(' '),
          ...flags,
          color: String((roomEntry as any).color || '#64748b'),
          fillOpacity: Number.isFinite(Number((roomEntry as any).fillOpacity))
            ? Math.max(0.05, Math.min(1, Number((roomEntry as any).fillOpacity)))
            : 0.08,
          labelScale: Number.isFinite(Number((roomEntry as any).labelScale))
            ? Math.max(0.2, Math.min(2, Number((roomEntry as any).labelScale)))
            : 1,
          isSource:
            String(floorPlanEntry.id) === String(roomLayoutExportModal.sourcePlanId) &&
            String(roomEntry.id) === String(roomLayoutExportModal.sourceRoomId)
        });
      }
    }
  }
  const dir = roomLayoutExportModal.sortDir === 'desc' ? -1 : 1;
  const sorted = out.slice().sort((a, b) => {
    const key = roomLayoutExportModal.sortKey;
    const cmp =
      key === 'site'
        ? a.siteName.localeCompare(b.siteName, undefined, { sensitivity: 'base' })
        : key === 'plan'
          ? a.planName.localeCompare(b.planName, undefined, { sensitivity: 'base' })
          : key === 'room'
            ? a.roomName.localeCompare(b.roomName, undefined, { sensitivity: 'base' })
            : key === 'capacity'
              ? a.capacity - b.capacity
              : key === 'meetingRoom'
                ? Number(a.meetingRoom) - Number(b.meetingRoom)
                : key === 'logical'
                  ? Number(a.logical) - Number(b.logical)
                  : key === 'storageRoom'
                    ? Number(a.storageRoom) - Number(b.storageRoom)
                    : key === 'bathroom'
                      ? Number(a.bathroom) - Number(b.bathroom)
                      : key === 'technicalRoom'
                        ? Number(a.technicalRoom) - Number(b.technicalRoom)
                        : key === 'noWindows'
                          ? Number(a.noWindows) - Number(b.noWindows)
              : key === 'scale'
                ? a.labelScale - b.labelScale
                : a.fillOpacity - b.fillOpacity;
    if (cmp !== 0) return cmp * dir;
    return (
      a.siteName.localeCompare(b.siteName, undefined, { sensitivity: 'base' }) ||
      a.planName.localeCompare(b.planName, undefined, { sensitivity: 'base' }) ||
      a.roomName.localeCompare(b.roomName, undefined, { sensitivity: 'base' })
    );
  });
  return sorted;
};
