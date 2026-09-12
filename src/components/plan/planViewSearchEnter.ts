import type { FloorPlan, MapObject, Room } from '../../store/types';
import type { useT } from '../../i18n/useT';
import type { CrossPlanSearchResult } from './CrossPlanSearchModal';

// Body-extraction of usePlanView's handleSearchEnter (plain non-memoized function). The body is
// moved verbatim; closed-over values are passed in via `deps`. No dependency array to preserve.

export type HandleSearchEnterDeps = {
  renderPlan: FloorPlan | undefined;
  setSearchResultsOpen: (v: boolean) => void;
  setSearchResultsTerm: (v: string) => void;
  setSearchResultsObjects: (v: MapObject[]) => void;
  setSearchResultsRooms: (v: Room[]) => void;
  setCrossPlanSearchOpen: (v: boolean) => void;
  setCrossPlanSearchTerm: (v: string) => void;
  clearSelection: () => void;
  setSelectedRoomId: (v: string | undefined) => void;
  setSelectedRoomIds: (v: string[]) => void;
  setHighlightRoom: (v: { roomId: string; until: number } | null) => void;
  isDeskType: (type: string) => boolean;
  searchDebugEnabled: boolean;
  plan: FloorPlan | null | undefined;
  client: unknown;
  getClientSearchIndex: () => Array<{ planId: string; search: string; result: CrossPlanSearchResult }>;
  renderPlanObjectById: Map<string, MapObject>;
  basePlanObjectById: Map<string, MapObject>;
  renderPlanRoomById: Map<string, Room>;
  basePlanRoomById: Map<string, Room>;
  push: (...args: any[]) => void;
  t: ReturnType<typeof useT>;
  setCrossPlanResults: (v: CrossPlanSearchResult[]) => void;
  promptRevealForObject: (obj: MapObject) => boolean;
  setSelectedObject: (id: string) => void;
  triggerHighlight: (id: string) => void;
};

export const runHandleSearchEnter = (term: string, deps: HandleSearchEnterDeps): void => {
  const {
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
  } = deps;
    if (!renderPlan) return;
    if (!term.trim()) {
      setSearchResultsOpen(false);
      setSearchResultsTerm('');
      setSearchResultsObjects([]);
      setSearchResultsRooms([]);
      setCrossPlanSearchOpen(false);
      setCrossPlanSearchTerm('');
      clearSelection();
      setSelectedRoomId(undefined);
      setSelectedRoomIds([]);
      setHighlightRoom(null);
      return;
    }
    const normalized = term.trim().toLowerCase();
    const simpleObjectMatches = (renderPlan.objects || []).filter(
      (o) =>
        !isDeskType(o.type) &&
        (String(o.name || '').toLowerCase().includes(normalized) ||
          String(o.description || '').toLowerCase().includes(normalized))
    );
    const simpleRoomMatches = (renderPlan.rooms || []).filter((r) =>
      String(r.name || '').toLowerCase().includes(normalized)
    );
    if (searchDebugEnabled) {
      console.log('[search-debug] simple', {
        term,
        normalized,
        objects: simpleObjectMatches.map((o) => o.name),
        rooms: simpleRoomMatches.map((r) => r.name)
      });
    }
    if (simpleObjectMatches.length + simpleRoomMatches.length > 1) {
      setSearchResultsTerm(term);
      setSearchResultsObjects(simpleObjectMatches);
      setSearchResultsRooms(simpleRoomMatches);
      setSearchResultsOpen(true);
      if (searchDebugEnabled) {
        console.log('[search-debug] open popover (simple matches)', {
          total: simpleObjectMatches.length + simpleRoomMatches.length
        });
      }
      return;
    }
    const collectMatches = (objects: MapObject[] = [], rooms: Room[] = []) => {
      const objMatches: MapObject[] = [];
      const roomMatches: Room[] = [];
      for (const o of objects) {
        if (isDeskType(o.type)) continue;
        const first = String((o as any).firstName || '').trim();
        const last = String((o as any).lastName || '').trim();
        const email = String((o as any).externalEmail || (o as any).email || '').trim();
        const role = String((o as any).externalRole || '').trim();
        const dept = [o.externalDept1, o.externalDept2, o.externalDept3].filter(Boolean).join(' ');
        const label =
          o.type === 'real_user' && (first || last)
            ? `${first} ${last}`.trim()
            : String(o.name || '').trim();
        const search = `${label} ${o.name || ''} ${o.description || ''} ${first} ${last} ${email} ${role} ${dept}`.toLowerCase();
        if (search.includes(normalized)) objMatches.push(o);
      }
      for (const r of rooms) {
        if (String(r.name || '').toLowerCase().includes(normalized)) roomMatches.push(r);
      }
      return { objMatches, roomMatches };
    };
    const primary = collectMatches(renderPlan.objects || [], renderPlan.rooms || []);
    const fallback =
      plan && plan !== renderPlan ? collectMatches(plan.objects || [], plan.rooms || []) : { objMatches: [], roomMatches: [] };
    const objectMatchesById = new Map<string, MapObject>();
    const roomMatchesById = new Map<string, Room>();
    for (const o of [...primary.objMatches, ...fallback.objMatches]) objectMatchesById.set(o.id, o);
    for (const r of [...primary.roomMatches, ...fallback.roomMatches]) roomMatchesById.set(r.id, r);
    const objectMatches = Array.from(objectMatchesById.values());
    const roomMatches = Array.from(roomMatchesById.values());
    const indexMatches = client
      ? getClientSearchIndex()
          .filter((x) => x.planId === renderPlan.id && x.search.includes(normalized))
          .map((x) => x.result)
      : [];
    const indexObjectIds = Array.from(new Set(indexMatches.filter((m) => m.kind === 'object').map((m) => (m as any).objectId).filter(Boolean)));
    const indexRoomIds = Array.from(new Set(indexMatches.filter((m) => m.kind === 'room').map((m) => (m as any).roomId).filter(Boolean)));
    const findObjectById = (id: string) =>
      renderPlanObjectById.get(id) || basePlanObjectById.get(id);
    const findRoomById = (id: string) =>
      renderPlanRoomById.get(id) || basePlanRoomById.get(id);
    const indexObjects = indexObjectIds
      .map((id) => findObjectById(id))
      .filter((obj): obj is MapObject => !!obj && !isDeskType(obj.type));
    const indexRooms = indexRoomIds.map((id) => findRoomById(id)).filter(Boolean) as Room[];
    const mergedObjects = objectMatches.length ? objectMatches : indexObjects;
    const mergedRooms = roomMatches.length ? roomMatches : indexRooms;
    const totalMatches = mergedObjects.length + mergedRooms.length;
    if (searchDebugEnabled) {
      console.log('[search-debug] merged', {
        term,
        objects: mergedObjects.map((o) => o.name),
        rooms: mergedRooms.map((r) => r.name),
        total: totalMatches
      });
    }

    if (!totalMatches) {
      const crossResults: CrossPlanSearchResult[] = client
        ? getClientSearchIndex().filter((x) => x.search.includes(normalized)).map((x) => x.result)
        : [];
      if (!crossResults.length) {
        push(t({ it: 'Nessun risultato trovato', en: 'No results found' }), 'info');
        return;
      }
      setCrossPlanSearchTerm(term);
      setCrossPlanResults(crossResults);
      setCrossPlanSearchOpen(true);
      return;
    }
    if (totalMatches === 1) {
      const onlyObject = mergedObjects.length === 1 ? mergedObjects[0] : null;
      const onlyRoom = !onlyObject && mergedRooms.length === 1 ? mergedRooms[0] : null;
      const isExactObjectMatch =
        !!onlyObject && String(onlyObject.name || '').trim().toLowerCase() === normalized;
      const isExactRoomMatch =
        !!onlyRoom && String(onlyRoom.name || '').trim().toLowerCase() === normalized;
      if (isExactObjectMatch && onlyObject) {
        if (promptRevealForObject(onlyObject)) return;
        setSelectedObject(onlyObject.id);
        triggerHighlight(onlyObject.id);
        if (searchDebugEnabled) {
          console.log('[search-debug] exact object match', onlyObject.name);
        }
        return;
      }
      if (isExactRoomMatch && onlyRoom) {
        clearSelection();
        setSelectedRoomId(onlyRoom.id);
        setSelectedRoomIds([onlyRoom.id]);
        setHighlightRoom({ roomId: onlyRoom.id, until: Date.now() + 3200 });
        if (searchDebugEnabled) {
          console.log('[search-debug] exact room match', onlyRoom.name);
        }
        return;
      }
    }
    // Multiple matches: let the user pick which one to focus
    setSearchResultsTerm(term);
    setSearchResultsObjects(mergedObjects);
    setSearchResultsRooms(mergedRooms);
    setSearchResultsOpen(true);
    if (searchDebugEnabled) {
      console.log('[search-debug] open popover (merged matches)', { total: totalMatches });
    }
};
