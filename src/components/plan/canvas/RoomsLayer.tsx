import { memo, type ReactNode } from 'react';
import { Circle, Group, Layer, Line, Rect, Transformer } from 'react-konva';
import { FloorPlan, MapObject } from '../../../store/types';

export interface RoomsLayerProps {
  plan: FloorPlan;
  toolMode?: 'scale' | 'wall' | 'measure' | 'quote' | null;
  corridorDoorDraftActive: boolean;
  roomDrawMode?: 'rect' | 'poly' | null;
  corridorDrawMode?: 'poly' | null;
  readOnly?: boolean;
  panToolActive?: boolean;
  pendingType?: unknown;
  selectedRoomId?: string;
  selectedRoomIds?: string[];
  roomStatsById?: Map<string, { items: MapObject[]; userCount: number; otherCount: number; totalCount: number }>;
  meetingRoomStatusById?: Record<string, { hasMeetingToday?: boolean; inProgress?: boolean; hasFutureToday?: boolean }>;
  highlightRoomId?: string;
  highlightRoomUntil?: number;
  roomHighlightNow: number;
  printArea?: { x: number; y: number; width: number; height: number } | null;
  printAreaMode?: boolean;
  showPrintArea?: boolean;
  draftRect: { x: number; y: number; width: number; height: number } | null;
  draftPrintRect: { x: number; y: number; width: number; height: number } | null;
  textDraftRect: { x: number; y: number; width: number; height: number } | null;
  roomRectSnapHint: { x: number; y: number } | null;
  draftPolyPoints: { x: number; y: number }[];
  corridorDraftPolyPoints: { x: number; y: number }[];
  previewDraftPolyLine: number[] | null;
  previewCorridorDraftPolyLine: number[] | null;
  roomNodeRefs: React.MutableRefObject<Record<string, any>>;
  polyLineRefs: React.MutableRefObject<Record<string, any>>;
  polyVertexRefs: React.MutableRefObject<Record<string, Record<number, any>>>;
  selectedRoomNodeRef: React.MutableRefObject<any>;
  roomDragRef: React.MutableRefObject<any>;
  transformerRef: React.MutableRefObject<any>;
  lastContextMenuAtRef: React.MutableRefObject<number>;
  hexToRgba: (hex: string, alpha: number) => string;
  getPolygonLabelBounds: (points: { x: number; y: number }[]) => { x: number; y: number; width: number; height: number };
  getRoomPolygonPoints: (room: any) => { x: number; y: number }[];
  getRoomSpecialType: (room: any) => string | null;
  getLocalizedName: (entity: { name?: string; nameEn?: string }, fallback?: string) => string;
  renderRoomLabels: (options: {
    bounds: { x: number; y: number; width: number; height: number };
    name: string;
    showName: boolean;
    capacityText?: string | null;
    overCapacity?: boolean;
    labelScale?: number;
    labelPosition?: 'top' | 'bottom' | 'left' | 'right';
  }) => ReactNode;
  pointerToWorld: (localX: number, localY: number) => { x: number; y: number };
  isBoxSelecting: () => boolean;
  setDoorHoverCard: React.Dispatch<
    React.SetStateAction<null | { clientX: number; clientY: number; content: ReactNode }>
  >;
  t: (m: { it: string; en: string }) => string;
  onSelectRoom?: (
    roomId?: string,
    options?: { keepContext?: boolean; multi?: boolean; preserveSelection?: boolean; worldX?: number; worldY?: number }
  ) => void;
  onOpenRoomDetails?: (roomId: string) => void;
  onRoomContextMenu?: (payload: { id: string; clientX: number; clientY: number; worldX: number; worldY: number }) => void;
  onMeetingBadgeDblClick?: (payload: {
    id: string;
    clientX: number;
    clientY: number;
    worldX: number;
    worldY: number;
  }) => void;
  onUpdateRoom?: (roomId: string, payload: any) => void;
}

const RoomsLayerImpl = (props: RoomsLayerProps) => {
  const {
    plan,
    toolMode,
    corridorDoorDraftActive,
    roomDrawMode,
    corridorDrawMode,
    readOnly,
    panToolActive,
    pendingType,
    selectedRoomId,
    selectedRoomIds,
    roomStatsById,
    meetingRoomStatusById,
    highlightRoomId,
    highlightRoomUntil,
    roomHighlightNow,
    printArea,
    printAreaMode,
    showPrintArea,
    draftRect,
    draftPrintRect,
    textDraftRect,
    roomRectSnapHint,
    draftPolyPoints,
    corridorDraftPolyPoints,
    previewDraftPolyLine,
    previewCorridorDraftPolyLine,
    roomNodeRefs,
    polyLineRefs,
    polyVertexRefs,
    selectedRoomNodeRef,
    roomDragRef,
    transformerRef,
    lastContextMenuAtRef,
    hexToRgba,
    getPolygonLabelBounds,
    getRoomPolygonPoints,
    getRoomSpecialType,
    getLocalizedName,
    renderRoomLabels,
    pointerToWorld,
    isBoxSelecting,
    setDoorHoverCard,
    t,
    onSelectRoom,
    onOpenRoomDetails,
    onRoomContextMenu,
    onMeetingBadgeDblClick,
    onUpdateRoom
  } = props;
  return (
        <Layer perfectDrawEnabled={false} listening={!toolMode && !corridorDoorDraftActive && !roomDrawMode}>
          {(plan.rooms || []).map((room) => {
            const isSelectedRoom = selectedRoomId === room.id || (selectedRoomIds || []).includes(room.id);
            const kind = (room.kind || (room.points?.length ? 'poly' : 'rect')) as 'rect' | 'poly';
            const baseColor = (room as any).color || '#64748b';
            const roomSpecialType = getRoomSpecialType(room as any);
            const specialPalette =
              roomSpecialType === 'bathroom'
                ? { fill: '#0ea5e9', stroke: '#0284c7' }
                : roomSpecialType === 'technical'
                  ? { fill: '#334155', stroke: '#0f172a' }
                : roomSpecialType === 'storage'
                  ? { fill: '#f59e0b', stroke: '#b45309' }
                    : null;
            const fillBaseColor = specialPalette?.fill || baseColor;
            const strokeBaseColor = specialPalette?.stroke || baseColor;
            const baseFillOpacity = specialPalette ? 0.17 : 0.08;
            const roomFillOpacity = Number.isFinite(Number((room as any)?.fillOpacity))
              ? Math.max(0.05, Math.min(1, Number((room as any).fillOpacity)))
              : baseFillOpacity;
            const stats = roomStatsById?.get(room.id);
            const userCount = stats?.userCount || 0;
            const rawCapacity = Number((room as any).capacity);
            const capacity = Number.isFinite(rawCapacity) ? Math.max(0, Math.floor(rawCapacity)) : 0;
            const capacityText = `${userCount}/${capacity}`;
            const overCapacity = userCount > capacity;
            const meetingStatus = meetingRoomStatusById?.[room.id] || {};
            const showMeetingBadge = !!(room as any)?.meetingRoom;
            const meetingInProgress = !!meetingStatus?.inProgress;
            const meetingHasFutureToday = !!meetingStatus?.hasFutureToday;
            const meetingHasAnyToday = !!meetingStatus?.hasMeetingToday;
            const showName = (room as any).showName !== false;
            const roomName = getLocalizedName(room as any);
            const highlightActive = !!(
              highlightRoomId &&
              highlightRoomUntil &&
              highlightRoomId === room.id &&
              highlightRoomUntil > roomHighlightNow
            );
            const pulse = highlightActive ? 0.6 + 0.4 * Math.sin(roomHighlightNow / 80) : 0;
            const stroke = highlightActive ? '#22d3ee' : isSelectedRoom ? '#2563eb' : strokeBaseColor;
            const strokeWidth = highlightActive ? 2 + 0.8 * pulse : isSelectedRoom ? 2 : 1.1;
            if (kind === 'poly') {
              const pts = room.points || [];
              const labelBounds = getPolygonLabelBounds(pts);
              const flat = pts.flatMap((p) => [p.x, p.y]);
              return (
                <Group
                  key={room.id}
                  ref={(node) => {
                    if (node) roomNodeRefs.current[room.id] = node;
                    else delete roomNodeRefs.current[room.id];
                  }}
                  draggable={!readOnly && !panToolActive}
                  onDragStart={(e) => {
                    roomDragRef.current = {
                      roomId: room.id,
                      kind: 'poly',
                      startX: e.target.x(),
                      startY: e.target.y(),
                      node: e.target,
                      cancelled: false
                    };
                  }}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    if (e.evt?.button !== 0) return;
                    const stage = e.target.getStage();
                    const pos = stage?.getPointerPosition();
                    const world = pos
                      ? pointerToWorld(pos.x, pos.y)
                      : pts[0] || { x: 0, y: 0 };
                    const multi = !!((e.evt as any)?.ctrlKey || (e.evt as any)?.metaKey || (e.evt as any)?.shiftKey);
                    onSelectRoom?.(room.id, { multi, worldX: world.x, worldY: world.y });
                  }}
                  onDblClick={(e) => {
                    e.cancelBubble = true;
                    if (e.evt?.button !== 0) return;
                    if (readOnly) return;
                    onSelectRoom?.(room.id);
                    onOpenRoomDetails?.(room.id);
                  }}
                  onContextMenu={(e) => {
                    e.evt.preventDefault();
                    e.cancelBubble = true;
                    if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                    if (isBoxSelecting()) return;
                    const stage = e.target.getStage();
                    const pos = stage?.getPointerPosition();
                    const fallbackPoint = labelBounds
                      ? { x: Number(labelBounds.x) + Number(labelBounds.width) / 2, y: Number(labelBounds.y) + Number(labelBounds.height) / 2 }
                      : pts[0] || { x: 0, y: 0 };
                    const world = pos ? pointerToWorld(pos.x, pos.y) : fallbackPoint;
                    lastContextMenuAtRef.current = Date.now();
                    const currentSelectedRoomIds = Array.isArray(selectedRoomIds) ? selectedRoomIds : [];
                    const preserveSelection = currentSelectedRoomIds.includes(room.id) && currentSelectedRoomIds.length > 1;
                    if (!preserveSelection) {
                      onSelectRoom?.(room.id, { keepContext: true, preserveSelection: false, worldX: world.x, worldY: world.y });
                    }
                    onRoomContextMenu?.({ id: room.id, clientX: e.evt.clientX, clientY: e.evt.clientY, worldX: world.x, worldY: world.y });
                  }}
                  onDragEnd={(e) => {
                    if (readOnly) return;
                    const active = roomDragRef.current;
                    if (active && active.roomId === room.id) {
                      roomDragRef.current = null;
                      if (active.cancelled) {
                        e.target.position({ x: active.startX, y: active.startY });
                        e.target.getLayer()?.batchDraw?.();
                        return;
                      }
                    }
                    const node = e.target;
                    const dx = node.x();
                    const dy = node.y();
                    node.position({ x: 0, y: 0 });
                    node.getLayer()?.batchDraw?.();
                    if (!dx && !dy) return;
                    onUpdateRoom?.(room.id, { kind: 'poly', points: pts.map((p) => ({ x: p.x + dx, y: p.y + dy })) });
                  }}
                >
                  <Line
                    ref={(node) => {
                      if (node) polyLineRefs.current[room.id] = node;
                      else delete polyLineRefs.current[room.id];
                    }}
                    points={flat}
                    closed
                    fill={hexToRgba(fillBaseColor, roomFillOpacity)}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    dash={[5, 4]}
                    lineJoin="round"
                  />
                  <Group
                    listening={false}
                    clipFunc={(ctx) => {
                      if (!pts.length) return;
                      ctx.beginPath();
                      ctx.moveTo(pts[0].x, pts[0].y);
                      for (let i = 1; i < pts.length; i++) {
                        ctx.lineTo(pts[i].x, pts[i].y);
                      }
                      ctx.closePath();
                    }}
                  >
                    {renderRoomLabels({
                      bounds: labelBounds,
                      name: roomName,
                      showName,
                      capacityText,
                      overCapacity,
                      labelScale: (room as any).labelScale,
                      labelPosition: (room as any).labelPosition
                    })}
                  </Group>
                  {showMeetingBadge && labelBounds ? (
                    <Group
                      x={labelBounds.x + Math.max(10, labelBounds.width - 12)}
                      y={labelBounds.y + 12}
                      onMouseEnter={(e) => {
                        const cx = Number((e?.evt as any)?.clientX);
                        const cy = Number((e?.evt as any)?.clientY);
                        const stage = e?.target?.getStage?.();
                        const pos = stage?.getPointerPosition?.();
                        const rect = stage?.container?.()?.getBoundingClientRect?.();
                        const clientPoint =
                          Number.isFinite(cx) && Number.isFinite(cy)
                            ? { clientX: cx, clientY: cy }
                            : pos && rect
                              ? { clientX: Number(rect.left + pos.x), clientY: Number(rect.top + pos.y) }
                              : { clientX: 0, clientY: 0 };
                        setDoorHoverCard({
                          clientX: clientPoint.clientX,
                          clientY: clientPoint.clientY,
                          content: (
                            <div className="space-y-0.5">
                              <div className="font-semibold">
                              {meetingInProgress
                                ? t({ it: 'Meeting in corso in questa sala', en: 'Meeting in progress in this room' })
                                : meetingHasFutureToday
                                  ? t({ it: 'Meeting futuri oggi in questa sala', en: 'Future meetings today in this room' })
                                  : meetingHasAnyToday
                                    ? t({ it: 'Meeting di oggi già conclusi in questa sala', en: 'Today meetings already finished in this room' })
                                    : t({ it: 'Nessun meeting oggi in questa sala', en: 'No meetings today in this room' })}
                            </div>
                              <div>{t({ it: 'Doppio click: timeline sala.', en: 'Double click: room timeline.' })}</div>
                            </div>
                          )
                        });
                      }}
                      onMouseMove={(e) => {
                        const cx = Number((e?.evt as any)?.clientX);
                        const cy = Number((e?.evt as any)?.clientY);
                        const stage = e?.target?.getStage?.();
                        const pos = stage?.getPointerPosition?.();
                        const rect = stage?.container?.()?.getBoundingClientRect?.();
                        const clientPoint =
                          Number.isFinite(cx) && Number.isFinite(cy)
                            ? { clientX: cx, clientY: cy }
                            : pos && rect
                              ? { clientX: Number(rect.left + pos.x), clientY: Number(rect.top + pos.y) }
                              : { clientX: 0, clientY: 0 };
                        setDoorHoverCard((prev) =>
                          prev
                            ? { ...prev, clientX: clientPoint.clientX, clientY: clientPoint.clientY }
                            : prev
                        );
                      }}
                      onMouseLeave={() => setDoorHoverCard(null)}
                      onDblClick={(e) => {
                        e.cancelBubble = true;
                        const stage = e.target.getStage();
                        const pos = stage?.getPointerPosition();
                        const world = pos ? pointerToWorld(pos.x, pos.y) : { x: labelBounds.x + labelBounds.width, y: labelBounds.y };
                        onMeetingBadgeDblClick?.({ id: room.id, clientX: e.evt.clientX, clientY: e.evt.clientY, worldX: world.x, worldY: world.y });
                      }}
                      onContextMenu={(e) => {
                        e.evt.preventDefault();
                        e.cancelBubble = true;
                      }}
                    >
                      {(() => {
                        const badgeFill = meetingInProgress
                          ? '#16a34a'
                          : meetingHasFutureToday
                            ? '#f59e0b'
                            : '#94a3b8';
                        return (
                          <>
                            <Rect x={-9} y={-9} width={18} height={18} cornerRadius={5} fill={badgeFill} stroke="#ffffff" strokeWidth={1.25} shadowColor="rgba(2,6,23,0.35)" shadowBlur={4} shadowOffset={{ x: 0, y: 1 }} />
                            <Rect x={-9} y={-9} width={18} height={5.2} cornerRadius={5} fill="rgba(255,255,255,0.28)" />
                            <Circle x={-4.2} y={-5.4} radius={1.05} fill="#ffffff" />
                            <Circle x={4.2} y={-5.4} radius={1.05} fill="#ffffff" />
                            <Line points={[-6.2, -1.2, 6.2, -1.2]} stroke="#ffffff" strokeWidth={1.05} opacity={0.95} />
                            <Line points={[-6, 2.4, 2.2, 2.4]} stroke="#ffffff" strokeWidth={0.95} opacity={0.9} />
                            <Line points={[-6, 5.4, 0.5, 5.4]} stroke="#ffffff" strokeWidth={0.95} opacity={0.9} lineCap="round" />
                            <Circle x={4.8} y={4.6} radius={2.35} stroke="#ffffff" strokeWidth={0.95} fill="rgba(255,255,255,0.08)" />
                            <Line points={[4.8, 4.6, 4.8, 3.4]} stroke="#ffffff" strokeWidth={0.85} lineCap="round" />
                            <Line points={[4.8, 4.6, 5.7, 5.15]} stroke="#ffffff" strokeWidth={0.85} lineCap="round" />
                          </>
                        );
                      })()}
                    </Group>
                  ) : null}
                  {isSelectedRoom && !readOnly && !roomDrawMode
                    ? pts.map((p, idx) => (
                        <Circle
                          key={`${room.id}:${idx}`}
                          ref={(node) => {
                            if (!polyVertexRefs.current[room.id]) polyVertexRefs.current[room.id] = {};
                            if (node) polyVertexRefs.current[room.id][idx] = node;
                            else if (polyVertexRefs.current[room.id]) delete polyVertexRefs.current[room.id][idx];
                          }}
                          x={p.x}
                          y={p.y}
                          radius={3.5}
                          fill="#ffffff"
                          stroke="#2563eb"
                          strokeWidth={1.2}
                          draggable={!panToolActive}
                          onDragMove={() => {
                            const line = polyLineRefs.current[room.id];
                            const verts = polyVertexRefs.current[room.id];
                            if (!line || !verts) return;
                            const next = Object.keys(verts)
                              .map((k) => Number(k))
                              .sort((a, b) => a - b)
                              .flatMap((i) => [verts[i].x(), verts[i].y()]);
                            line.points(next);
                            line.getLayer()?.batchDraw?.();
                          }}
                          onDragEnd={() => {
                            const verts = polyVertexRefs.current[room.id];
                            if (!verts) return;
                            const nextPoints = Object.keys(verts)
                              .map((k) => Number(k))
                              .sort((a, b) => a - b)
                              .map((i) => ({ x: verts[i].x(), y: verts[i].y() }));
                            onUpdateRoom?.(room.id, { kind: 'poly', points: nextPoints });
                          }}
                        />
                      ))
                    : null}
                </Group>
              );
            }
            const bounds = { x: 0, y: 0, width: room.width || 0, height: room.height || 0 };
            return (
              <Group
                key={room.id}
                ref={(node) => {
                  if (node) roomNodeRefs.current[room.id] = node;
                  else delete roomNodeRefs.current[room.id];
                }}
                x={room.x || 0}
                y={room.y || 0}
                draggable={!readOnly && !panToolActive && !pendingType}
                onDragStart={(e) => {
                  roomDragRef.current = {
                    roomId: room.id,
                    kind: 'rect',
                    startX: e.target.x(),
                    startY: e.target.y(),
                    node: e.target,
                    cancelled: false
                  };
                }}
                onClick={(e) => {
                  e.cancelBubble = true;
                  if (e.evt?.button !== 0) return;
                  const stage = e.target.getStage();
                  const pos = stage?.getPointerPosition();
                  const world = pos
                    ? pointerToWorld(pos.x, pos.y)
                    : { x: Number(room.x || 0) + Number(room.width || 0) / 2, y: Number(room.y || 0) + Number(room.height || 0) / 2 };
                  const multi = !!((e.evt as any)?.ctrlKey || (e.evt as any)?.metaKey || (e.evt as any)?.shiftKey);
                  onSelectRoom?.(room.id, { multi, worldX: world.x, worldY: world.y });
                }}
                onDblClick={(e) => {
                  e.cancelBubble = true;
                  if (e.evt?.button !== 0) return;
                  if (readOnly) return;
                  onSelectRoom?.(room.id);
                  onOpenRoomDetails?.(room.id);
                }}
                onContextMenu={(e) => {
                  e.evt.preventDefault();
                  e.cancelBubble = true;
                  if ((e.evt as any)?.metaKey) return;
                  if (isBoxSelecting()) return;
                  const stage = e.target.getStage();
                  const pos = stage?.getPointerPosition();
                  const world = pos
                    ? pointerToWorld(pos.x, pos.y)
                    : { x: Number(room.x || 0) + Number(room.width || 0) / 2, y: Number(room.y || 0) + Number(room.height || 0) / 2 };
                  lastContextMenuAtRef.current = Date.now();
                  const currentSelectedRoomIds = Array.isArray(selectedRoomIds) ? selectedRoomIds : [];
                  const preserveSelection = currentSelectedRoomIds.includes(room.id) && currentSelectedRoomIds.length > 1;
                  if (!preserveSelection) {
                    onSelectRoom?.(room.id, { keepContext: true, preserveSelection: false, worldX: world.x, worldY: world.y });
                  }
                  onRoomContextMenu?.({ id: room.id, clientX: e.evt.clientX, clientY: e.evt.clientY, worldX: world.x, worldY: world.y });
                }}
                onDragEnd={(e) => {
                  if (readOnly) return;
                  const node = e.target;
                  const active = roomDragRef.current;
                  if (active && active.roomId === room.id) {
                    roomDragRef.current = null;
                    if (active.cancelled) {
                      node.position({ x: active.startX, y: active.startY });
                      node.getLayer()?.batchDraw?.();
                      return;
                    }
                  }
                  onUpdateRoom?.(room.id, {
                    kind: 'rect',
                    x: node.x(),
                    y: node.y(),
                    width: room.width || 0,
                    height: room.height || 0
                  });
                }}
              >
                <Rect
                  ref={(node) => {
                    if (isSelectedRoom) selectedRoomNodeRef.current = node;
                  }}
                  x={0}
                  y={0}
                  width={room.width || 0}
                  height={room.height || 0}
                  fill={hexToRgba(fillBaseColor, roomFillOpacity)}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  dash={[5, 4]}
                  cornerRadius={6}
                  onTransformEnd={(e) => {
                    if (readOnly) return;
                    const node = e.target as any;
                    const group = node.getParent();
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    const nextX = (group?.x() || 0) + node.x();
                    const nextY = (group?.y() || 0) + node.y();
                    node.scaleX(1);
                    node.scaleY(1);
                    node.position({ x: 0, y: 0 });
                    onUpdateRoom?.(room.id, {
                      kind: 'rect',
                      x: nextX,
                      y: nextY,
                      width: Math.max(10, node.width() * scaleX),
                      height: Math.max(10, node.height() * scaleY)
                    });
                  }}
                />
                <Group
                  listening={false}
                  clipFunc={(ctx) => {
                    ctx.beginPath();
                    ctx.rect(0, 0, Number(room.width || 0), Number(room.height || 0));
                    ctx.closePath();
                  }}
                >
                    {renderRoomLabels({
                      bounds,
                      name: roomName,
                      showName,
                    capacityText,
                    overCapacity,
                    labelScale: (room as any).labelScale,
                    labelPosition: (room as any).labelPosition
                  })}
                </Group>
                {showMeetingBadge ? (
                  <Group
                    x={Math.max(10, Number(room.width || 0) - 12)}
                    y={12}
                    onMouseEnter={(e) => {
                      const cx = Number((e?.evt as any)?.clientX);
                      const cy = Number((e?.evt as any)?.clientY);
                      const stage = e?.target?.getStage?.();
                      const pos = stage?.getPointerPosition?.();
                      const rect = stage?.container?.()?.getBoundingClientRect?.();
                      const clientPoint =
                        Number.isFinite(cx) && Number.isFinite(cy)
                          ? { clientX: cx, clientY: cy }
                          : pos && rect
                            ? { clientX: Number(rect.left + pos.x), clientY: Number(rect.top + pos.y) }
                            : { clientX: 0, clientY: 0 };
                      setDoorHoverCard({
                        clientX: clientPoint.clientX,
                        clientY: clientPoint.clientY,
                        content: (
                          <div className="space-y-0.5">
                            <div className="font-semibold">
                              {meetingInProgress
                                ? t({ it: 'Meeting in corso in questa sala', en: 'Meeting in progress in this room' })
                                : meetingHasFutureToday
                                  ? t({ it: 'Meeting futuri oggi in questa sala', en: 'Future meetings today in this room' })
                                  : meetingHasAnyToday
                                    ? t({ it: 'Meeting di oggi già conclusi in questa sala', en: 'Today meetings already finished in this room' })
                                    : t({ it: 'Nessun meeting oggi in questa sala', en: 'No meetings today in this room' })}
                            </div>
                            <div>{t({ it: 'Doppio click: timeline sala. Click destro: pianifica meeting.', en: 'Double click: room timeline. Right click: schedule meeting.' })}</div>
                          </div>
                        )
                      });
                    }}
                    onMouseMove={(e) => {
                      const cx = Number((e?.evt as any)?.clientX);
                      const cy = Number((e?.evt as any)?.clientY);
                      const stage = e?.target?.getStage?.();
                      const pos = stage?.getPointerPosition?.();
                      const rect = stage?.container?.()?.getBoundingClientRect?.();
                      const clientPoint =
                        Number.isFinite(cx) && Number.isFinite(cy)
                          ? { clientX: cx, clientY: cy }
                          : pos && rect
                            ? { clientX: Number(rect.left + pos.x), clientY: Number(rect.top + pos.y) }
                            : { clientX: 0, clientY: 0 };
                      setDoorHoverCard((prev) =>
                        prev
                          ? { ...prev, clientX: clientPoint.clientX, clientY: clientPoint.clientY }
                          : prev
                      );
                    }}
                    onMouseLeave={() => setDoorHoverCard(null)}
                    onDblClick={(e) => {
                      e.cancelBubble = true;
                      const stage = e.target.getStage();
                      const pos = stage?.getPointerPosition();
                      const world = pos
                        ? pointerToWorld(pos.x, pos.y)
                        : { x: Number(room.x || 0) + Number(room.width || 0), y: Number(room.y || 0) };
                      onMeetingBadgeDblClick?.({ id: room.id, clientX: e.evt.clientX, clientY: e.evt.clientY, worldX: world.x, worldY: world.y });
                    }}
                    onContextMenu={(e) => {
                      e.evt.preventDefault();
                      e.cancelBubble = true;
                    }}
                  >
                    {(() => {
                      const badgeFill = meetingInProgress
                        ? '#16a34a'
                        : meetingHasFutureToday
                          ? '#f59e0b'
                          : '#94a3b8';
                      return (
                        <>
                          <Rect x={-9} y={-9} width={18} height={18} cornerRadius={5} fill={badgeFill} stroke="#ffffff" strokeWidth={1.25} shadowColor="rgba(2,6,23,0.35)" shadowBlur={4} shadowOffset={{ x: 0, y: 1 }} />
                          <Rect x={-9} y={-9} width={18} height={5.2} cornerRadius={5} fill="rgba(255,255,255,0.28)" />
                          <Circle x={-4.2} y={-5.4} radius={1.05} fill="#ffffff" />
                          <Circle x={4.2} y={-5.4} radius={1.05} fill="#ffffff" />
                          <Line points={[-6.2, -1.2, 6.2, -1.2]} stroke="#ffffff" strokeWidth={1.05} opacity={0.95} />
                          <Line points={[-6, 2.4, 2.2, 2.4]} stroke="#ffffff" strokeWidth={0.95} opacity={0.9} />
                          <Line points={[-6, 5.4, 0.5, 5.4]} stroke="#ffffff" strokeWidth={0.95} opacity={0.9} lineCap="round" />
                          <Circle x={4.8} y={4.6} radius={2.35} stroke="#ffffff" strokeWidth={0.95} fill="rgba(255,255,255,0.08)" />
                          <Line points={[4.8, 4.6, 4.8, 3.4]} stroke="#ffffff" strokeWidth={0.85} lineCap="round" />
                          <Line points={[4.8, 4.6, 5.7, 5.15]} stroke="#ffffff" strokeWidth={0.85} lineCap="round" />
                        </>
                      );
                    })()}
                  </Group>
                ) : null}
              </Group>
            );
          })}

          {selectedRoomId &&
          !roomDrawMode &&
          !readOnly &&
          (() => {
            const r = (plan.rooms || []).find((x) => x.id === selectedRoomId);
            const k = (r?.kind || (r?.points?.length ? 'poly' : 'rect')) as 'rect' | 'poly';
            return k === 'rect';
          })() ? (
            <Transformer
              ref={transformerRef}
              rotateEnabled={false}
              keepRatio={false}
              boundBoxFunc={(_oldBox: any, newBox: any) => {
                if (newBox.width < 10 || newBox.height < 10) return _oldBox;
                return newBox;
              }}
            />
          ) : null}

          {/* Print area overlay (optional) */}
          {printArea && (printAreaMode || showPrintArea) ? (
            <Rect
              x={printArea.x}
              y={printArea.y}
              width={printArea.width}
              height={printArea.height}
              stroke="#0ea5e9"
              strokeWidth={1.5}
              dash={[6, 6]}
              listening={false}
              cornerRadius={8}
            />
          ) : null}
          {draftPrintRect ? (
            <Rect
              x={draftPrintRect.x}
              y={draftPrintRect.y}
              width={draftPrintRect.width}
              height={draftPrintRect.height}
              fill="rgba(14,165,233,0.06)"
              stroke="#0ea5e9"
              strokeWidth={1.5}
              dash={[6, 6]}
              listening={false}
              cornerRadius={8}
            />
          ) : null}
          {textDraftRect ? (
            <Rect
              x={textDraftRect.x}
              y={textDraftRect.y}
              width={textDraftRect.width}
              height={textDraftRect.height}
              fill="rgba(37,99,235,0.08)"
              stroke="#2563eb"
              strokeWidth={1.5}
              dash={[6, 4]}
              listening={false}
              cornerRadius={6}
            />
          ) : null}
          {draftRect ? (
            <Rect
              x={draftRect.x}
              y={draftRect.y}
              width={draftRect.width}
              height={draftRect.height}
              fill="rgba(37,99,235,0.08)"
              stroke="#2563eb"
              strokeWidth={1.5}
              dash={[6, 6]}
              listening={false}
              cornerRadius={8}
            />
          ) : null}
          {roomDrawMode === 'rect'
            ? ((plan.rooms || []) as any[]).flatMap((room: any) => {
                const points = getRoomPolygonPoints(room);
                if (!points.length) return [];
                return points.map((p, idx) => (
                  <Rect
                    key={`room-corner-anchor:${room?.id || 'room'}:${idx}`}
                    x={p.x - 3}
                    y={p.y - 3}
                    width={6}
                    height={6}
                    cornerRadius={1.2}
                    fill="rgba(148,163,184,0.18)"
                    stroke="rgba(51,65,85,0.55)"
                    strokeWidth={0.8}
                    listening={false}
                  />
                ));
              })
            : null}
          {roomDrawMode === 'rect' && roomRectSnapHint ? (
            <Group x={roomRectSnapHint.x} y={roomRectSnapHint.y} listening={false}>
              <Rect x={-5} y={-5} width={10} height={10} cornerRadius={1.8} fill="rgba(37,99,235,0.18)" stroke="#2563eb" strokeWidth={1.2} />
              <Rect x={-2.1} y={-2.1} width={4.2} height={4.2} cornerRadius={0.8} fill="#ffffff" stroke="#2563eb" strokeWidth={0.9} />
            </Group>
          ) : null}

          {/* Draft poly */}
          {previewDraftPolyLine ? (
            <Line
              points={previewDraftPolyLine}
              closed={draftPolyPoints.length >= 3}
              fill="rgba(37,99,235,0.06)"
              stroke="#2563eb"
              strokeWidth={1.5}
              dash={[6, 6]}
              lineJoin="round"
              listening={false}
            />
          ) : null}
          {previewCorridorDraftPolyLine ? (
            <Line
              points={previewCorridorDraftPolyLine}
              closed={corridorDraftPolyPoints.length >= 3}
              fill="rgba(14,116,144,0.08)"
              stroke="#0e7490"
              strokeWidth={1.5}
              dash={[6, 6]}
              lineJoin="round"
              listening={false}
            />
          ) : null}
          {roomDrawMode === 'poly' && draftPolyPoints.length ? (
            <Circle
              x={draftPolyPoints[0].x}
              y={draftPolyPoints[0].y}
              radius={6}
              fill="#ffffff"
              stroke="#2563eb"
              strokeWidth={1.5}
              listening={false}
            />
          ) : null}
          {corridorDrawMode === 'poly' && corridorDraftPolyPoints.length ? (
            <Circle
              x={corridorDraftPolyPoints[0].x}
              y={corridorDraftPolyPoints[0].y}
              radius={6}
              fill="#ffffff"
              stroke="#0e7490"
              strokeWidth={1.5}
              listening={false}
            />
          ) : null}
        </Layer>
  );
};

RoomsLayerImpl.displayName = 'RoomsLayer';
export const RoomsLayer = memo(RoomsLayerImpl);
