import { type ReactNode } from 'react';
import { Arrow, Circle, Group, Layer, Line, Rect, Text } from 'react-konva';
import { Corridor, FloorPlan, MapObject, RoomConnectionDoor } from '../../../store/types';
import { WALL_LAYER_COLOR } from '../../../store/data';
import { clamp } from '../../../utils/geometry';
import { getWallTypeColor } from '../../../utils/wallColors';

export interface WallsLinksLayerProps {
  plan: FloorPlan;
  wallObjects: MapObject[];
  quoteObjects: MapObject[];
  objectById: Map<string, MapObject>;
  toolMode?: 'scale' | 'wall' | 'measure' | 'quote' | null;
  corridorDoorDraftActive: boolean;
  readOnly?: boolean;
  panToolActive?: boolean;
  pendingType?: unknown;
  selectedId?: string;
  selectedIds?: string[];
  selectedLinkId?: string | null;
  highlightId?: string;
  highlightUntil?: number;
  highlightNow: number;
  metersPerPixel?: number | null;
  quoteLabels?: Record<string, string>;
  quoteResizePreview: { id: string; points: { x: number; y: number }[] } | null;
  selectedRoomDoorId?: string | null;
  roomDoorDraft?: { roomAId: string; roomBId: string } | null;
  selectedCorridorId?: string;
  corridorDoorDraft?: { corridorId: string; start?: { edgeIndex: number; t: number; x: number; y: number } } | null;
  selectedCorridorDoor?: { corridorId: string; doorId: string } | null;
  objectNodeRefs: React.MutableRefObject<Record<string, any>>;
  quoteResizeRef: React.MutableRefObject<any>;
  corridorDoorPointerRef: React.MutableRefObject<{ corridorId: string; doorId: string; allowDrag: boolean } | null>;
  lastContextMenuAtRef: React.MutableRefObject<number>;
  pointerToWorld: (localX: number, localY: number) => { x: number; y: number };
  isBoxSelecting: () => boolean;
  nearestWallSegment: (
    points: { x: number; y: number }[],
    target: { x: number; y: number }
  ) => { length: number } | null;
  estimateTextWidth: (text: string, fontSize: number) => number;
  getRoomPolygonPoints: (room: any) => { x: number; y: number }[];
  getRoomEdgePoint: (
    points: { x: number; y: number }[],
    edgeIndex: number,
    t: number
  ) => { x: number; y: number } | null;
  getCorridorPolygonPoints: (corridor: Corridor | any) => { x: number; y: number }[];
  getCorridorEdgePoint: (
    points: { x: number; y: number }[],
    edgeIndex: number,
    t: number
  ) => { x: number; y: number } | null;
  getClosestCorridorEdgePoint: (
    points: { x: number; y: number }[],
    point: { x: number; y: number }
  ) => { edgeIndex: number; t: number; x: number; y: number } | null;
  setQuoteResizePreview: React.Dispatch<
    React.SetStateAction<{ id: string; points: { x: number; y: number }[] } | null>
  >;
  setDoorHoverCard: React.Dispatch<
    React.SetStateAction<null | { clientX: number; clientY: number; content: ReactNode }>
  >;
  t: (m: { it: string; en: string }) => string;
  onMoveWall?: (id: string, dx: number, dy: number, batchId?: string, movedRoomIds?: string[]) => void;
  onSelect: (id?: string, options?: { keepContext?: boolean; multi?: boolean }) => void;
  onWallClick?: (payload: { id: string; clientX: number; clientY: number; world: { x: number; y: number } }) => void;
  onWallSegmentDblClick?: (payload: { id: string; lengthPx: number }) => void;
  onContextMenu: (payload: { id: string; clientX: number; clientY: number; wallSegmentLengthPx?: number }) => void;
  onMoveStart?: (id: string, x: number, y: number, roomId?: string) => void;
  onMove: (id: string, x: number, y: number) => boolean | void;
  onEdit: (id: string) => void;
  onUpdateQuotePoints?: (id: string, points: { x: number; y: number }[]) => void;
  onSelectLink?: (id?: string) => void;
  onLinkDblClick?: (id: string) => void;
  onLinkContextMenu?: (payload: { id: string; clientX: number; clientY: number }) => void;
  onSelectRoomDoor?: (doorId?: string) => void;
  onRoomDoorContextMenu?: (payload: { doorId: string; clientX: number; clientY: number }) => void;
  onRoomDoorDblClick?: (doorId: string) => void;
  onSelectCorridorDoor?: (payload?: { corridorId: string; doorId: string }) => void;
  onCorridorDoorContextMenu?: (payload: {
    corridorId: string;
    doorId: string;
    clientX: number;
    clientY: number;
  }) => void;
  onCorridorDoorDblClick?: (payload: { corridorId: string; doorId: string }) => void;
  onUpdateCorridor?: (corridorId: string, payload: any) => void;
}

export const WallsLinksLayer = (props: WallsLinksLayerProps) => {
  const {
    plan,
    wallObjects,
    quoteObjects,
    objectById,
    toolMode,
    corridorDoorDraftActive,
    readOnly,
    panToolActive,
    pendingType,
    selectedId,
    selectedIds,
    selectedLinkId,
    highlightId,
    highlightUntil,
    highlightNow,
    metersPerPixel,
    quoteLabels,
    quoteResizePreview,
    selectedRoomDoorId,
    roomDoorDraft,
    selectedCorridorId,
    corridorDoorDraft,
    selectedCorridorDoor,
    objectNodeRefs,
    quoteResizeRef,
    corridorDoorPointerRef,
    lastContextMenuAtRef,
    pointerToWorld,
    isBoxSelecting,
    nearestWallSegment,
    estimateTextWidth,
    getRoomPolygonPoints,
    getRoomEdgePoint,
    getCorridorPolygonPoints,
    getCorridorEdgePoint,
    getClosestCorridorEdgePoint,
    setQuoteResizePreview,
    setDoorHoverCard,
    t,
    onMoveWall,
    onSelect,
    onWallClick,
    onWallSegmentDblClick,
    onContextMenu,
    onMoveStart,
    onMove,
    onEdit,
    onUpdateQuotePoints,
    onSelectLink,
    onLinkDblClick,
    onLinkContextMenu,
    onSelectRoomDoor,
    onRoomDoorContextMenu,
    onRoomDoorDblClick,
    onSelectCorridorDoor,
    onCorridorDoorContextMenu,
    onCorridorDoorDblClick,
    onUpdateCorridor
  } = props;
  return (
        <Layer perfectDrawEnabled={false} listening={!toolMode && !corridorDoorDraftActive}>
          {wallObjects.map((obj) => {
            const pts = obj.points || [];
            if (pts.length < 2) return null;
            const isSelected = selectedIds ? selectedIds.includes(obj.id) : selectedId === obj.id;
            const highlightActive = !!(highlightId && highlightUntil && highlightId === obj.id && highlightUntil > highlightNow);
            const pulse = highlightActive ? 0.6 + 0.4 * Math.sin(highlightNow / 80) : 0;
            const rawStroke = typeof obj.strokeColor === 'string' && obj.strokeColor.trim() ? obj.strokeColor.trim() : '';
            const typeStroke = getWallTypeColor(obj.type);
            const baseStroke = rawStroke && rawStroke !== WALL_LAYER_COLOR ? rawStroke : typeStroke;
            const baseWidth = clamp(Number(obj.strokeWidth ?? 1) || 1, 1, 12);
            const lineOpacity = clamp(Number(obj.opacity ?? 1) || 1, 0.1, 1);
            const stroke = highlightActive ? '#22d3ee' : isSelected ? '#2563eb' : baseStroke;
            const strokeWidth = highlightActive ? baseWidth + 1 + 2 * pulse : isSelected ? baseWidth + 1 : baseWidth;
            const linePoints = pts.flatMap((p) => [p.x, p.y]);
            const multiSelected = (selectedIds || []).length > 1;
            const allowWallDrag = isSelected && !readOnly && !panToolActive && !toolMode && !multiSelected;
            return (
              <Group
                key={obj.id}
                ref={(node) => {
                  if (node) objectNodeRefs.current[obj.id] = node;
                  else delete objectNodeRefs.current[obj.id];
                }}
                draggable={allowWallDrag}
                onDragStart={(e) => {
                  e.cancelBubble = true;
                }}
                onDragEnd={(e) => {
                  if (!allowWallDrag) return;
                  const node = e.target;
                  const dx = node.x();
                  const dy = node.y();
                  node.position({ x: 0, y: 0 });
                  node.getLayer()?.batchDraw?.();
                  if (!dx && !dy) return;
                  onMoveWall?.(obj.id, dx, dy);
                }}
              >
                <Line
                  points={linePoints}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  lineCap="round"
                  lineJoin="round"
                  hitStrokeWidth={Math.max(12, strokeWidth + 10)}
                  opacity={lineOpacity}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    if (e.evt?.button !== 0) return;
                    const isMulti = !!(e.evt.ctrlKey || e.evt.metaKey);
                    onSelect(obj.id, { multi: isMulti });
                    if (onWallClick && !isMulti) {
                      const stage = e.target.getStage();
                      const pos = stage?.getPointerPosition();
                      if (!pos) return;
                      const world = pointerToWorld(pos.x, pos.y);
                      onWallClick({ id: obj.id, clientX: e.evt.clientX, clientY: e.evt.clientY, world });
                    }
                  }}
                  onDblClick={(e) => {
                    e.cancelBubble = true;
                    if (e.evt?.button !== 0) return;
                    const stage = e.target.getStage();
                    const pos = stage?.getPointerPosition();
                    if (!pos) return;
                    const world = pointerToWorld(pos.x, pos.y);
                    const segment = nearestWallSegment(pts, world);
                    if (!segment) return;
                    onWallSegmentDblClick?.({ id: obj.id, lengthPx: segment.length });
                  }}
                  onContextMenu={(e) => {
                    e.evt.preventDefault();
                    e.cancelBubble = true;
                    if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                    if (isBoxSelecting()) return;
                    lastContextMenuAtRef.current = Date.now();
                    const multiSelected = (selectedIds || []).length > 1;
                    const multiKey = !!(e.evt.ctrlKey || e.evt.metaKey);
                    if (!isSelected || !multiSelected) {
                      onSelect(obj.id, { keepContext: true, multi: multiKey });
                    }
                    if (pendingType || readOnly) return;
                    const stage = e.target.getStage();
                    const pos = stage?.getPointerPosition();
                    const world = pos ? pointerToWorld(pos.x, pos.y) : null;
                    const segment = world ? nearestWallSegment(pts, world) : null;
                    onContextMenu({
                      id: obj.id,
                      clientX: e.evt.clientX,
                      clientY: e.evt.clientY,
                      wallSegmentLengthPx: segment?.length
                    });
                  }}
                />
              </Group>
            );
          })}
          {quoteObjects.map((obj) => {
            const pts = obj.points || [];
            if (pts.length < 2) return null;
            const displayPts = quoteResizePreview?.id === obj.id ? quoteResizePreview.points : pts;
            if (displayPts.length < 2) return null;
            const start = displayPts[0];
            const end = displayPts[displayPts.length - 1];
            const isSelected = !!selectedIds?.includes(obj.id);
            const baseStroke = typeof obj.strokeColor === 'string' && obj.strokeColor.trim() ? obj.strokeColor.trim() : '#f97316';
            const stroke = isSelected ? '#2563eb' : baseStroke;
            const scale = clamp(Number(obj.scale ?? 1) || 1, 0.5, 1.6);
            const labelScale = clamp(Number((obj as any).quoteLabelScale ?? 1) || 1, 0.6, 2);
            const strokeWidth = clamp((Number(obj.strokeWidth ?? 2) || 2) * scale, 0.8, 6);
            const opacity = clamp(Number(obj.opacity ?? 1) || 1, 0.2, 1);
            const pointerSize = Math.max(4, Math.round(5 * scale));
            const labelFontSize = Math.max(8, Math.round(9 * labelScale));
            const labelPadding = Math.max(6, Math.round(8 * labelScale));
            const computedLabel = (() => {
              const lengthPx = Math.hypot(end.x - start.x, end.y - start.y);
              const lengthLabel =
                Number.isFinite(metersPerPixel) && (metersPerPixel as number) > 0
                  ? `${(lengthPx * (metersPerPixel as number)).toFixed(2)} m`
                  : `${Math.round(lengthPx)} px`;
              const name = String(obj.name || '').trim();
              return name && lengthLabel ? `${name} · ${lengthLabel}` : name || lengthLabel;
            })();
            const label = quoteLabels?.[obj.id] || computedLabel;
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;
            const textW = label ? estimateTextWidth(label, labelFontSize) + labelPadding : 0;
            const textH = Math.max(12, Math.round(14 * labelScale));
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const orientation = Math.abs(dy) > Math.abs(dx) ? 'vertical' : 'horizontal';
            const labelPos = (obj as any).quoteLabelPos || 'center';
            const labelBg = labelPos === 'center' || (obj as any).quoteLabelBg === true;
            const labelColor = String((obj as any).quoteLabelColor || '#0f172a');
            const labelOffset = Number((obj as any).quoteLabelOffset);
            const labelOffsetFactor = Number.isFinite(labelOffset) && labelOffset > 0 ? labelOffset : 1;
            const normalizedOffsetFactor = Math.abs(labelOffsetFactor - 1.15) < 0.001 ? 1 : labelOffsetFactor;
            const baseOffset = Math.max(6, Math.round(6 * labelScale));
            const perpSize = textH;
            const offsetDist = (baseOffset + perpSize / 2) * normalizedOffsetFactor;
            let offsetX = 0;
            let offsetY = 0;
            if (orientation === 'vertical') {
              if (labelPos === 'left') offsetX = -offsetDist;
              if (labelPos === 'right') offsetX = offsetDist;
            } else {
              if (labelPos === 'above') offsetY = -offsetDist;
              if (labelPos === 'below') offsetY = offsetDist;
            }
            const endpoint = (obj as any).quoteEndpoint || 'arrows';
            const dashed = !!(obj as any).quoteDashed;
            const dash = dashed ? [8 * scale, 6 * scale] : undefined;
            const isResizing = quoteResizePreview?.id === obj.id;
            return (
              <Group
                key={obj.id}
                draggable={isSelected && !readOnly && !panToolActive && !toolMode && !isResizing}
                onDragStart={() => {
                  if (!isSelected || !onMoveStart) return;
                  onMoveStart(obj.id, obj.x ?? start.x, obj.y ?? start.y, obj.roomId);
                }}
                onDragEnd={(e) => {
                  if (!isSelected || !onMove) return;
                  const dx = e.target.x();
                  const dy = e.target.y();
                  e.target.position({ x: 0, y: 0 });
                  if (!dx && !dy) return;
                  const baseX = Number.isFinite(obj.x) ? obj.x : start.x;
                  const baseY = Number.isFinite(obj.y) ? obj.y : start.y;
                  onMove(obj.id, baseX + dx, baseY + dy);
                }}
              >
                {endpoint === 'arrows' ? (
                  <Arrow
                    points={[start.x, start.y, end.x, end.y]}
                    stroke={stroke}
                    fill={stroke}
                    pointerLength={pointerSize}
                    pointerWidth={pointerSize}
                    pointerAtBeginning
                    pointerAtEnding
                    strokeWidth={strokeWidth}
                    dash={dash}
                    hitStrokeWidth={Math.max(10, strokeWidth + 8)}
                    opacity={opacity}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      if (e.evt?.button !== 0) return;
                      onSelect(obj.id, { multi: !!(e.evt.ctrlKey || e.evt.metaKey) });
                    }}
                    onDblClick={(e) => {
                      e.cancelBubble = true;
                      if (readOnly || toolMode) return;
                      onEdit(obj.id);
                    }}
                    onContextMenu={(e) => {
                      e.evt.preventDefault();
                      e.cancelBubble = true;
                      if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                      if (isBoxSelecting()) return;
                      lastContextMenuAtRef.current = Date.now();
                      const multiSelected = (selectedIds || []).length > 1;
                      const multiKey = !!(e.evt.ctrlKey || e.evt.metaKey);
                      if (!selectedIds?.includes(obj.id) || !multiSelected) {
                        onSelect(obj.id, { keepContext: true, multi: multiKey });
                      }
                      if (pendingType || readOnly) return;
                      onContextMenu({ id: obj.id, clientX: e.evt.clientX, clientY: e.evt.clientY });
                    }}
                  />
                ) : (
                  <>
                    <Line
                      points={[start.x, start.y, end.x, end.y]}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      dash={dash}
                      lineCap="round"
                      hitStrokeWidth={Math.max(10, strokeWidth + 8)}
                      opacity={opacity}
                      onClick={(e) => {
                        e.cancelBubble = true;
                        if (e.evt?.button !== 0) return;
                        onSelect(obj.id, { multi: !!(e.evt.ctrlKey || e.evt.metaKey) });
                      }}
                      onDblClick={(e) => {
                        e.cancelBubble = true;
                        if (readOnly || toolMode) return;
                        onEdit(obj.id);
                      }}
                      onContextMenu={(e) => {
                        e.evt.preventDefault();
                        e.cancelBubble = true;
                        if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                        if (isBoxSelecting()) return;
                        lastContextMenuAtRef.current = Date.now();
                        const multiSelected = (selectedIds || []).length > 1;
                        const multiKey = !!(e.evt.ctrlKey || e.evt.metaKey);
                        if (!selectedIds?.includes(obj.id) || !multiSelected) {
                          onSelect(obj.id, { keepContext: true, multi: multiKey });
                        }
                        if (pendingType || readOnly) return;
                        onContextMenu({ id: obj.id, clientX: e.evt.clientX, clientY: e.evt.clientY });
                      }}
                    />
                    {endpoint === 'dots' ? (
                      <>
                        <Circle x={start.x} y={start.y} radius={Math.max(2, Math.round(3 * scale))} fill={stroke} opacity={opacity} />
                        <Circle x={end.x} y={end.y} radius={Math.max(2, Math.round(3 * scale))} fill={stroke} opacity={opacity} />
                      </>
                    ) : null}
                  </>
                )}
                {label ? (
                  <Group
                    x={midX + offsetX}
                    y={midY + offsetY}
                    opacity={opacity}
                    rotation={orientation === 'vertical' ? -90 : 0}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      if (e.evt?.button !== 0) return;
                      onSelect(obj.id, { multi: !!(e.evt.ctrlKey || e.evt.metaKey) });
                    }}
                    onDblClick={(e) => {
                      e.cancelBubble = true;
                      if (readOnly || toolMode) return;
                      onEdit(obj.id);
                    }}
                    onContextMenu={(e) => {
                      e.evt.preventDefault();
                      e.cancelBubble = true;
                      if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                      if (isBoxSelecting()) return;
                      lastContextMenuAtRef.current = Date.now();
                      const multiSelected = (selectedIds || []).length > 1;
                      const multiKey = !!(e.evt.ctrlKey || e.evt.metaKey);
                      if (!selectedIds?.includes(obj.id) || !multiSelected) {
                        onSelect(obj.id, { keepContext: true, multi: multiKey });
                      }
                      if (pendingType || readOnly) return;
                      onContextMenu({ id: obj.id, clientX: e.evt.clientX, clientY: e.evt.clientY });
                    }}
                  >
                    {labelBg ? (
                      <Rect
                        x={-textW / 2}
                        y={-textH / 2}
                        width={textW}
                        height={textH}
                        fill="rgba(255,255,255,0.9)"
                        cornerRadius={4}
                      />
                    ) : null}
                    <Text
                      text={label}
                      x={-textW / 2}
                      y={-textH / 2}
                      width={textW}
                      height={textH}
                      align="center"
                      fontSize={labelFontSize}
                      fontStyle="bold"
                      fill={isSelected ? stroke : labelColor}
                    />
                  </Group>
                ) : null}
                {isSelected && !readOnly && !panToolActive && !toolMode && !!onUpdateQuotePoints ? (
                  <>
                    <Circle
                      x={start.x}
                      y={start.y}
                      radius={Math.max(4, Math.round(4 * scale))}
                      fill="#ffffff"
                      stroke={stroke}
                      strokeWidth={2}
                      onMouseDown={(e) => {
                        if (!onUpdateQuotePoints) return;
                        e.cancelBubble = true;
                        const basePoints = pts.map((p) => ({ x: p.x, y: p.y }));
                        const group = e.target.getParent();
                        group?.stopDrag?.();
                        group?.draggable?.(false);
                        quoteResizeRef.current = { id: obj.id, index: 0, points: basePoints, node: group };
                        setQuoteResizePreview({ id: obj.id, points: basePoints });
                      }}
                    />
                    <Circle
                      x={end.x}
                      y={end.y}
                      radius={Math.max(4, Math.round(4 * scale))}
                      fill="#ffffff"
                      stroke={stroke}
                      strokeWidth={2}
                      onMouseDown={(e) => {
                        if (!onUpdateQuotePoints) return;
                        e.cancelBubble = true;
                        const basePoints = pts.map((p) => ({ x: p.x, y: p.y }));
                        const group = e.target.getParent();
                        group?.stopDrag?.();
                        group?.draggable?.(false);
                        quoteResizeRef.current = { id: obj.id, index: basePoints.length - 1, points: basePoints, node: group };
                        setQuoteResizePreview({ id: obj.id, points: basePoints });
                      }}
                    />
                  </>
                ) : null}
              </Group>
            );
          })}
          {(plan.links || []).map((link) => {
            const from = objectById.get(link.fromId);
            const to = objectById.get(link.toId);
            if (!from || !to) return null;
            const isSelected = !!selectedLinkId && selectedLinkId === link.id;
            const kind = (link as any).kind || 'arrow';
            const arrowMode = (link as any).arrow ?? 'none';
            const arrowStart = arrowMode === 'start' || arrowMode === 'both';
            const arrowEnd = arrowMode === 'end' || arrowMode === 'both';
            const stroke = isSelected ? '#2563eb' : link.color || '#94a3b8';
            const widthRaw = Number((link as any).width);
            const width = Number.isFinite(widthRaw) && widthRaw > 0 ? widthRaw : 1;
            const selectedWidthDeltaRaw = Number((link as any).selectedWidthDelta);
            const selectedWidthDelta =
              Number.isFinite(selectedWidthDeltaRaw) && selectedWidthDeltaRaw > 0 ? selectedWidthDeltaRaw : 1;
            const dash = (link as any).dashed ? [8, 6] : undefined;
            const route = ((link as any).route || 'vh') as 'vh' | 'hv';

            if (kind === 'cable') {
              const offset = Number((link as any).offset || 0);
              let fromX = from.x;
              let fromY = from.y;
              let toX = to.x;
              let toY = to.y;
              if (offset) {
                const dx = to.x - from.x;
                const dy = to.y - from.y;
                const len = Math.hypot(dx, dy);
                if (len) {
                  const nx = -dy / len;
                  const ny = dx / len;
                  const shiftX = nx * offset;
                  const shiftY = ny * offset;
                  fromX += shiftX;
                  fromY += shiftY;
                  toX += shiftX;
                  toY += shiftY;
                }
              }
              const points =
                route === 'hv'
                  ? [fromX, fromY, toX, fromY, toX, toY]
                  : [fromX, fromY, fromX, toY, toX, toY];

              const label = String((link as any).name || (link as any).label || '').trim();
              const mid = (() => {
                const pts = points;
                let total = 0;
                for (let i = 0; i < pts.length - 2; i += 2) total += Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]);
                const half = total / 2;
                let acc = 0;
                for (let i = 0; i < pts.length - 2; i += 2) {
                  const x1 = pts[i];
                  const y1 = pts[i + 1];
                  const x2 = pts[i + 2];
                  const y2 = pts[i + 3];
                  const seg = Math.hypot(x2 - x1, y2 - y1);
                  if (acc + seg >= half) {
                    const t = seg ? (half - acc) / seg : 0;
                    return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
                  }
                  acc += seg;
                }
                return { x: (fromX + toX) / 2, y: (fromY + toY) / 2 };
              })();

              return (
                <Group key={link.id}>
                  <Line
                    points={points}
                    stroke={stroke}
                    strokeWidth={isSelected ? width + selectedWidthDelta : width}
                    hitStrokeWidth={Math.max(14, (isSelected ? width + selectedWidthDelta : width) + 10)}
                    dash={dash as any}
                    lineCap="round"
                    lineJoin="round"
                    opacity={0.9}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      onSelectLink?.(link.id);
                    }}
                    onDblClick={(e) => {
                      e.cancelBubble = true;
                      if (!onLinkDblClick) return;
                      if (readOnly) return;
                      onSelectLink?.(link.id);
                      onLinkDblClick(link.id);
                    }}
                    onContextMenu={(e) => {
                      e.evt.preventDefault();
                      e.cancelBubble = true;
                      if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                      if (!onLinkContextMenu) return;
                      onSelectLink?.(link.id);
                      onLinkContextMenu({ id: link.id, clientX: e.evt.clientX, clientY: e.evt.clientY });
                    }}
                  />
                  {label ? (
                    <Text
                      text={label}
                      x={mid.x - 120}
                      y={mid.y - 14}
                      width={240}
                      align="center"
                      fontSize={11}
                      fontStyle="bold"
                      fill="#0f172a"
                      listening={false}
                    />
                  ) : null}
                </Group>
              );
            }

            return (
              <Group key={link.id}>
                <Arrow
                  points={[from.x, from.y, to.x, to.y]}
                  stroke={stroke}
                  fill={stroke}
                  pointerLength={arrowStart || arrowEnd ? 8 : 0}
                  pointerWidth={arrowStart || arrowEnd ? 8 : 0}
                  pointerAtBeginning={arrowStart}
                  pointerAtEnding={arrowEnd}
                  strokeWidth={isSelected ? width + selectedWidthDelta : width}
                  hitStrokeWidth={Math.max(14, (isSelected ? width + selectedWidthDelta : width) + 10)}
                  opacity={0.85}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    onSelectLink?.(link.id);
                  }}
                  onDblClick={(e) => {
                    e.cancelBubble = true;
                    if (!onLinkDblClick) return;
                    if (readOnly) return;
                    onSelectLink?.(link.id);
                    onLinkDblClick(link.id);
                  }}
                  onContextMenu={(e) => {
                    e.evt.preventDefault();
                    e.cancelBubble = true;
                    if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                    if (!onLinkContextMenu) return;
                    onSelectLink?.(link.id);
                    onLinkContextMenu({ id: link.id, clientX: e.evt.clientX, clientY: e.evt.clientY });
                  }}
                />
                {String(link.name || link.label || '').trim() ? (
                  <Text
                    text={String(link.name || link.label || '').trim()}
                    x={(from.x + to.x) / 2 - 120}
                    y={(from.y + to.y) / 2 - 18}
                    width={240}
                    align="center"
                    fontSize={11}
                    fontStyle="bold"
                    fill="#0f172a"
                    listening={false}
                  />
                ) : null}
              </Group>
            );
          })}
          {/* Room connection doors */}
          {(() => {
            const planRoomDoors = Array.isArray((plan as any)?.roomDoors) ? (((plan as any).roomDoors as RoomConnectionDoor[]).filter(Boolean)) : [];
            if (!planRoomDoors.length) return null;
            const roomsById = new Map<string, any>(((plan.rooms || []) as any[]).map((room: any) => [String(room?.id || ''), room]));
            return planRoomDoors.map((door) => {
              const roomAId = String((door as any)?.roomAId || '').trim();
              const roomBId = String((door as any)?.roomBId || '').trim();
              if (!roomAId || !roomBId || roomAId === roomBId) return null;
              const anchorRoomIdRaw = String((door as any)?.anchorRoomId || '').trim();
              const anchorRoomId = anchorRoomIdRaw === roomAId || anchorRoomIdRaw === roomBId ? anchorRoomIdRaw : roomAId;
              const anchorRoom = roomsById.get(anchorRoomId) || roomsById.get(roomAId) || roomsById.get(roomBId);
              if (!anchorRoom) return null;
              const anchorPoints = getRoomPolygonPoints(anchorRoom);
              const anchor = getRoomEdgePoint(anchorPoints, Number((door as any)?.edgeIndex), Number((door as any)?.t));
              if (!anchor) return null;
              const isDoorSelected = selectedRoomDoorId === door.id;
              const inDraftPair =
                !!roomDoorDraft &&
                ((roomDoorDraft.roomAId === roomAId && roomDoorDraft.roomBId === roomBId) ||
                  (roomDoorDraft.roomAId === roomBId && roomDoorDraft.roomBId === roomAId));
              const doorMode = (door as any).mode === 'auto_sensor' || (door as any).mode === 'automated' ? (door as any).mode : 'static';
              const doorColor = doorMode === 'automated' ? '#16a34a' : doorMode === 'auto_sensor' ? '#2563eb' : '#0f766e';
              const stroke = isDoorSelected ? '#f8fafc' : '#e2e8f0';
              const openContext = (e: any) => {
                e.evt.preventDefault();
                e.cancelBubble = true;
                if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                if (isBoxSelecting()) return;
                lastContextMenuAtRef.current = Date.now();
                onSelectRoomDoor?.(door.id);
                onRoomDoorContextMenu?.({ doorId: door.id, clientX: e.evt.clientX, clientY: e.evt.clientY });
              };
              return (
                <Group
                  key={`room-door:${door.id}`}
                  name="room-door-point"
                  onClick={(e) => {
                    e.cancelBubble = true;
                    if (e.evt?.button !== 0) return;
                    onSelectRoomDoor?.(door.id);
                  }}
                  onDblClick={(e) => {
                    e.cancelBubble = true;
                    if (e.evt?.button !== 0) return;
                    onSelectRoomDoor?.(door.id);
                    onRoomDoorDblClick?.(door.id);
                  }}
                  onContextMenu={(e) => {
                    openContext(e);
                  }}
                >
                  <Group x={anchor.x} y={anchor.y}>
                    <Circle radius={11} fill="rgba(15,23,42,0.001)" strokeEnabled={false} />
                    <Rect
                      x={-3.2}
                      y={-4.8}
                      width={6.4}
                      height={9.6}
                      cornerRadius={1.1}
                      fill={doorColor}
                      stroke={stroke}
                      strokeWidth={isDoorSelected ? 1.9 : 1.2}
                    />
                    <Line points={[0, -4.8, 0, 4.8]} stroke={stroke} strokeWidth={isDoorSelected ? 1.5 : 1.1} />
                    {!!(door as any)?.isEmergency ? <Circle x={2.8} y={-5} radius={1.4} fill="#dc2626" stroke="#ffffff" strokeWidth={0.55} /> : null}
                    {inDraftPair ? <Circle x={-2.8} y={-5} radius={1.4} fill="#0ea5e9" stroke="#ffffff" strokeWidth={0.55} /> : null}
                  </Group>
                </Group>
              );
            });
          })()}
          {/* Corridor doors (kept in the same layer to reduce total layer count) */}
          {((plan.corridors || []) as Corridor[]).map((corridor) => {
            const points = getCorridorPolygonPoints(corridor);
            if (points.length < 3) return null;
            const doors = Array.isArray(corridor.doors) ? corridor.doors : [];
            if (!doors.length) return null;
            const isSelectedCorridor = selectedCorridorId === corridor.id;
            const isDraftTarget = corridorDoorDraft?.corridorId === corridor.id;
            return doors.map((door) => {
              const anchor = getCorridorEdgePoint(points, Number(door.edgeIndex), Number(door.t));
              if (!anchor) return null;
              const isDoorSelected = selectedCorridorDoor?.corridorId === corridor.id && selectedCorridorDoor?.doorId === door.id;
              const canDragDoor = (isDoorSelected || isSelectedCorridor) && !readOnly && !isDraftTarget;
              const doorMode = (door as any).mode === 'auto_sensor' || (door as any).mode === 'automated' ? (door as any).mode : 'static';
              const doorColor = doorMode === 'automated' ? '#16a34a' : doorMode === 'auto_sensor' ? '#2563eb' : '#92400e';
              const resolveClientPoint = (e: any): { clientX: number; clientY: number } => {
                const cx = Number((e?.evt as any)?.clientX);
                const cy = Number((e?.evt as any)?.clientY);
                if (Number.isFinite(cx) && Number.isFinite(cy)) return { clientX: cx, clientY: cy };
                const stage = e?.target?.getStage?.();
                const pos = stage?.getPointerPosition?.();
                const rect = stage?.container?.()?.getBoundingClientRect?.();
                if (pos && rect) return { clientX: Number(rect.left + pos.x), clientY: Number(rect.top + pos.y) };
                return { clientX: 0, clientY: 0 };
              };
              const openDoorContextMenu = (e: any) => {
                e.evt.preventDefault();
                e.cancelBubble = true;
                if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                if (isBoxSelecting()) return;
                lastContextMenuAtRef.current = Date.now();
                const point = resolveClientPoint(e);
                onSelectCorridorDoor?.({ corridorId: corridor.id, doorId: door.id });
                onCorridorDoorContextMenu?.({
                  corridorId: corridor.id,
                  doorId: door.id,
                  clientX: point.clientX,
                  clientY: point.clientY
                });
              };
              const doorDescription = String((door as any).description || '').trim();
              const emergency = !!(door as any).isEmergency;
              const mainEntrance = !!(door as any).isMainEntrance;
              const isExternal = !!(door as any).isExternal;
              const isFireDoor = !!(door as any).isFireDoor;
              const automationUrl = String((door as any).automationUrl || '').trim();
              const mode = String((door as any).mode || 'static');
              const modeLabel =
                mode === 'automated'
                  ? t({ it: 'Apertura automatizzata', en: 'Automated opening' })
                  : mode === 'auto_sensor'
                    ? t({ it: 'Apertura a rilevazione', en: 'Sensor opening' })
                    : t({ it: 'Statica', en: 'Static' });
              const lastVerificationAt = String((door as any).lastVerificationAt || '').trim();
              const verifierCompany = String((door as any).verifierCompany || '').trim();
              const hoverTextParts = [
                doorDescription ? `${t({ it: 'Descrizione', en: 'Description' })}: ${doorDescription}` : t({ it: 'Porta', en: 'Door' }),
                `${t({ it: 'Modalità', en: 'Mode' })}: ${modeLabel}`,
                emergency ? t({ it: 'Porta antipanico', en: 'Panic door' }) : '',
                mainEntrance ? t({ it: 'Ingresso principale', en: 'Main entrance' }) : '',
                isExternal ? t({ it: 'Porta esterna', en: 'External door' }) : '',
                isFireDoor ? t({ it: 'Tagliafuoco', en: 'Fire door' }) : '',
                automationUrl ? `${t({ it: 'URL apertura', en: 'Open URL' })}: ${automationUrl}` : '',
                emergency && (lastVerificationAt || verifierCompany)
                  ? `${t({ it: 'Ultima revisione', en: 'Latest check' })}: ${lastVerificationAt || '—'}${verifierCompany ? ` · ${verifierCompany}` : ''}`
                  : ''
              ].filter(Boolean);
              const hoverText = hoverTextParts.join(' · ');
              return (
                <Group
                  key={`${corridor.id}:${door.id}`}
                  name="corridor-door-point"
                  corridorId={corridor.id}
                  doorId={door.id}
                  onMouseDown={(e) => {
                    const button = Number((e.evt as any)?.button ?? 0);
                    const isContextIntent = button === 2 || !!(e.evt as any)?.ctrlKey;
                    corridorDoorPointerRef.current = {
                      corridorId: corridor.id,
                      doorId: door.id,
                      allowDrag: !isContextIntent && button === 0
                    };
                    if (!isContextIntent && button === 0) onSelectCorridorDoor?.({ corridorId: corridor.id, doorId: door.id });
                    if (isContextIntent) openDoorContextMenu(e);
                  }}
                  onMouseEnter={(e) => {
                    const point = resolveClientPoint(e);
                    setDoorHoverCard({ clientX: point.clientX, clientY: point.clientY, content: hoverText });
                  }}
                  onMouseMove={(e) => {
                    const point = resolveClientPoint(e);
                    setDoorHoverCard((prev) =>
                      prev
                        ? { ...prev, clientX: point.clientX, clientY: point.clientY, content: hoverText }
                        : { clientX: point.clientX, clientY: point.clientY, content: hoverText }
                    );
                  }}
                  onMouseLeave={() => {
                    setDoorHoverCard(null);
                  }}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    if (e.evt?.button !== 0) return;
                    onSelectCorridorDoor?.({ corridorId: corridor.id, doorId: door.id });
                  }}
                  onDblClick={(e) => {
                    e.cancelBubble = true;
                    if (e.evt?.button !== 0) return;
                    onSelectCorridorDoor?.({ corridorId: corridor.id, doorId: door.id });
                    onCorridorDoorDblClick?.({ corridorId: corridor.id, doorId: door.id });
                  }}
                  onContextMenu={(e) => {
                    openDoorContextMenu(e);
                  }}
                >
                  <Group
                    x={anchor.x}
                    y={anchor.y}
                    draggable={canDragDoor}
                    onDragStart={(e) => {
                      const dragState = corridorDoorPointerRef.current;
                      const allowDrag =
                        !!dragState &&
                        dragState.allowDrag &&
                        dragState.corridorId === corridor.id &&
                        dragState.doorId === door.id;
                      if (allowDrag) return;
                      e.target.stopDrag();
                      e.target.position({ x: anchor.x, y: anchor.y });
                      e.target.getLayer()?.batchDraw?.();
                    }}
                    onContextMenu={(e) => {
                      openDoorContextMenu(e);
                    }}
                    onDragEnd={(e) => {
                      e.cancelBubble = true;
                      const dragState = corridorDoorPointerRef.current;
                      const allowDrag =
                        !!dragState &&
                        dragState.allowDrag &&
                        dragState.corridorId === corridor.id &&
                        dragState.doorId === door.id;
                      if (!allowDrag) {
                        e.target.position({ x: anchor.x, y: anchor.y });
                        e.target.getLayer()?.batchDraw?.();
                        return;
                      }
                      const snap = getClosestCorridorEdgePoint(points, { x: e.target.x(), y: e.target.y() });
                      if (!snap) {
                        e.target.position({ x: anchor.x, y: anchor.y });
                        e.target.getLayer()?.batchDraw?.();
                        return;
                      }
                      const nextDoors = doors.map((entry) =>
                        entry.id === door.id
                          ? {
                              ...entry,
                              edgeIndex: snap.edgeIndex,
                              t: Number(snap.t.toFixed(4))
                            }
                          : entry
                      );
                      onUpdateCorridor?.(corridor.id, { doors: nextDoors as any });
                    }}
                  >
                    <Circle radius={13} fill="rgba(15,23,42,0.001)" strokeEnabled={false} />
                    <Rect
                      x={-3.4}
                      y={-5.1}
                      width={6.8}
                      height={10.2}
                      cornerRadius={1.2}
                      fill={doorColor}
                      stroke={isDoorSelected ? '#f8fafc' : '#e2e8f0'}
                      strokeWidth={isDoorSelected ? 1.6 : 1}
                    />
                    <Line points={[0, -5.1, 0, 5.1]} stroke="#ffffff" strokeWidth={1} />
                    <Circle x={1.3} y={0} radius={0.72} fill="#ffffff" />
                    {emergency ? <Circle x={4.5} y={-4.8} radius={2.2} fill="#dc2626" stroke="#ffffff" strokeWidth={1.2} /> : null}
                  </Group>
                </Group>
              );
            });
          })}
        </Layer>
  );
};
