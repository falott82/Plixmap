import { Fragment, type ReactNode } from 'react';
import { Circle, Group, Layer, Line, Rect, Text } from 'react-konva';
import { Corridor, FloorPlan } from '../../../store/types';
import { clamp } from '../../../utils/geometry';

export interface CorridorsLayerProps {
  plan: FloorPlan;
  toolMode?: 'scale' | 'wall' | 'measure' | 'quote' | null;
  readOnly?: boolean;
  panToolActive?: boolean;
  pendingType?: unknown;
  selectedCorridorId?: string;
  corridorDoorDraft?: { corridorId: string; start?: { edgeIndex: number; t: number; x: number; y: number } } | null;
  corridorDoorHover: { edgeIndex: number; t: number; x: number; y: number } | null;
  connectionPlanNamesById?: Record<string, string>;
  corridorPattern: unknown;
  corridorNodeRefs: React.MutableRefObject<Record<string, any>>;
  corridorPolyLineRefs: React.MutableRefObject<Record<string, any>>;
  corridorVertexRefs: React.MutableRefObject<Record<string, Record<number, any>>>;
  corridorDragRef: React.MutableRefObject<any>;
  corridorLabelDragRef: React.MutableRefObject<any>;
  hexToRgba: (hex: string, alpha: number) => string;
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
  getPolygonLabelBounds: (points: { x: number; y: number }[]) => { x: number; y: number; width: number; height: number };
  getLocalizedName: (entity: { name?: string; nameEn?: string }, fallback?: string) => string;
  pointInPolygon: (x: number, y: number, points: { x: number; y: number }[]) => boolean;
  pointerToWorld: (localX: number, localY: number) => { x: number; y: number };
  isBoxSelecting: () => boolean;
  setDoorHoverCard: React.Dispatch<
    React.SetStateAction<null | { clientX: number; clientY: number; content: ReactNode }>
  >;
  t: (m: { it: string; en: string }) => string;
  onSelectCorridor?: (corridorId?: string, options?: { keepContext?: boolean }) => void;
  onSelectCorridorDoor?: (payload?: { corridorId: string; doorId: string }) => void;
  onCorridorClick?: (payload: { id: string; clientX: number; clientY: number; worldX: number; worldY: number }) => void;
  onCorridorMiddleClick?: (payload: {
    corridorId: string;
    clientX: number;
    clientY: number;
    worldX: number;
    worldY: number;
  }) => void;
  onCorridorContextMenu?: (payload: {
    id: string;
    clientX: number;
    clientY: number;
    worldX: number;
    worldY: number;
  }) => void;
  onCorridorConnectionContextMenu?: (payload: {
    corridorId: string;
    connectionId: string;
    clientX: number;
    clientY: number;
    worldX: number;
    worldY: number;
  }) => void;
  onUpdateCorridor?: (corridorId: string, payload: any) => void;
  onAdjustCorridorLabelScale?: (corridorId: string, delta: number) => void;
}

export const CorridorsLayer = (props: CorridorsLayerProps) => {
  const {
    plan,
    toolMode,
    readOnly,
    panToolActive,
    pendingType,
    selectedCorridorId,
    corridorDoorDraft,
    corridorDoorHover,
    connectionPlanNamesById,
    corridorPattern,
    corridorNodeRefs,
    corridorPolyLineRefs,
    corridorVertexRefs,
    corridorDragRef,
    corridorLabelDragRef,
    hexToRgba,
    getCorridorPolygonPoints,
    getCorridorEdgePoint,
    getClosestCorridorEdgePoint,
    getPolygonLabelBounds,
    getLocalizedName,
    pointInPolygon,
    pointerToWorld,
    isBoxSelecting,
    setDoorHoverCard,
    t,
    onSelectCorridor,
    onSelectCorridorDoor,
    onCorridorClick,
    onCorridorMiddleClick,
    onCorridorContextMenu,
    onCorridorConnectionContextMenu,
    onUpdateCorridor,
    onAdjustCorridorLabelScale
  } = props;
  return (
        <Layer perfectDrawEnabled={false} listening={!toolMode}>
          {((plan.corridors || []) as Corridor[]).map((corridor) => {
            const points = getCorridorPolygonPoints(corridor);
            if (points.length < 3) return null;
            const flat = points.flatMap((p: { x: number; y: number }) => [p.x, p.y]);
            const bounds = getPolygonLabelBounds(points);
            const isSelectedCorridor = selectedCorridorId === corridor.id;
            const baseColor = String(corridor.color || '#94a3b8');
            const fillColor = hexToRgba(baseColor, isSelectedCorridor ? 0.24 : 0.18);
            const strokeColor = isSelectedCorridor ? '#0f766e' : '#64748b';
            const strokeWidth = isSelectedCorridor ? 2.2 : 1.3;
            const label = corridor.showName !== false ? getLocalizedName(corridor as any) : '';
            const labelScale = clamp(Number((corridor as any).labelScale || 1), 0.6, 3);
            const labelCenterX = Number.isFinite(Number((corridor as any).labelX))
              ? Number((corridor as any).labelX)
              : bounds.x + bounds.width / 2;
            const labelCenterY = Number.isFinite(Number((corridor as any).labelY))
              ? Number((corridor as any).labelY)
              : bounds.y + bounds.height / 2;
            const connections = Array.isArray(corridor.connections) ? corridor.connections : [];
            const kind = (corridor.kind || (Array.isArray(corridor.points) && corridor.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
            const isDraftTarget = corridorDoorDraft?.corridorId === corridor.id;
            const canDragCorridor =
              isSelectedCorridor &&
              kind === 'rect' &&
              !readOnly &&
                  !panToolActive &&
                  !pendingType &&
                  !toolMode &&
                  !isDraftTarget;
            const canDragLabel = isSelectedCorridor && !readOnly && !isDraftTarget;
            return (
              <Group
                key={corridor.id}
                ref={(node) => {
                  if (node) corridorNodeRefs.current[corridor.id] = node;
                  else delete corridorNodeRefs.current[corridor.id];
                }}
                draggable={canDragCorridor}
                onDragStart={(e) => {
                  corridorDragRef.current = {
                    corridorId: corridor.id,
                    startX: e.target.x(),
                    startY: e.target.y(),
                    node: e.target,
                    cancelled: false
                  };
                }}
                onDragEnd={(e) => {
                  if (!canDragCorridor) return;
                  const active = corridorDragRef.current;
                  if (active && active.corridorId === corridor.id) {
                    corridorDragRef.current = null;
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
                  onUpdateCorridor?.(corridor.id, {
                    kind: 'rect',
                    x: Number(corridor.x || 0) + dx,
                    y: Number(corridor.y || 0) + dy,
                    width: Number(corridor.width || 0),
                    height: Number(corridor.height || 0)
                  });
                }}
                onMouseDown={(e) => {
                  if (e.evt?.button !== 1) return;
                  if (readOnly || panToolActive || !!toolMode) return;
                  if (isDraftTarget) return;
                  const stage = e.target.getStage();
                  const pos = stage?.getPointerPosition();
                  const world = pos
                    ? pointerToWorld(pos.x, pos.y)
                    : { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
                  e.evt.preventDefault();
                  e.cancelBubble = true;
                  onSelectCorridor?.(corridor.id);
                  onSelectCorridorDoor?.(undefined);
                  onCorridorMiddleClick?.({
                    corridorId: corridor.id,
                    clientX: e.evt.clientX,
                    clientY: e.evt.clientY,
                    worldX: world.x,
                    worldY: world.y
                  });
                }}
                onClick={(e) => {
                  e.cancelBubble = true;
                  if (e.evt?.button !== 0) return;
                  const stage = e.target.getStage();
                  const pos = stage?.getPointerPosition();
                  const world = pos
                    ? pointerToWorld(pos.x, pos.y)
                    : { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
                  if (isDraftTarget) {
                    onSelectCorridor?.(corridor.id);
                    return;
                  }
                  onSelectCorridor?.(corridor.id);
                  onSelectCorridorDoor?.(undefined);
                  onCorridorClick?.({
                    id: corridor.id,
                    clientX: e.evt.clientX,
                    clientY: e.evt.clientY,
                    worldX: world.x,
                    worldY: world.y
                  });
                }}
                onContextMenu={(e) => {
                  e.evt.preventDefault();
                  e.cancelBubble = true;
                  if (String((e.target as any)?.attrs?.name || '') === 'corridor-connection-point') return;
                  if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                  if (isBoxSelecting()) return;
                  const stage = e.target.getStage();
                  const pos = stage?.getPointerPosition();
                  const world = pos
                    ? pointerToWorld(pos.x, pos.y)
                    : { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
                  onSelectCorridor?.(corridor.id, { keepContext: true });
                  onSelectCorridorDoor?.(undefined);
                  onCorridorContextMenu?.({
                    id: corridor.id,
                    clientX: e.evt.clientX,
                    clientY: e.evt.clientY,
                    worldX: world.x,
                    worldY: world.y
                  });
                }}
              >
                <Line
                  ref={(node) => {
                    if (node) corridorPolyLineRefs.current[corridor.id] = node;
                    else delete corridorPolyLineRefs.current[corridor.id];
                  }}
                  points={flat}
                  closed
                  fill={fillColor}
                  fillPatternImage={(corridorPattern as any) || undefined}
                  fillPatternRepeat="repeat"
                  fillPatternScale={{ x: 1, y: 1 }}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  dash={[4, 3]}
                  lineJoin="round"
                />
                <Line
                  points={flat}
                  closed
                  fill="rgba(15,23,42,0.001)"
                  strokeEnabled={false}
                />
                {label ? (
                  (() => {
                    const maxWidth = Math.max(40, bounds.width - 12);
                    const labelWidth = Math.min(maxWidth, Math.max(40, (label.length * 6.4 + 18) * labelScale));
                    const labelHeight = 20 * labelScale;
                    return (
                      <>
                        <Group
                          x={labelCenterX}
                          y={labelCenterY}
                          draggable={canDragLabel}
                          onDragStart={(e) => {
                            e.cancelBubble = true;
                            corridorLabelDragRef.current = {
                              corridorId: corridor.id,
                              node: e.target,
                              points: points.map((p) => ({ x: p.x, y: p.y })),
                              lastX: e.target.x(),
                              lastY: e.target.y()
                            };
                          }}
                          onDragMove={(e) => {
                            e.cancelBubble = true;
                            if (!corridorLabelDragRef.current || corridorLabelDragRef.current.corridorId !== corridor.id) return;
                            corridorLabelDragRef.current.lastX = e.target.x();
                            corridorLabelDragRef.current.lastY = e.target.y();
                          }}
                          onClick={(e) => {
                            e.cancelBubble = true;
                            if (e.evt?.button !== 0) return;
                            onSelectCorridor?.(corridor.id);
                          }}
                          onDragEnd={(e) => {
                            corridorLabelDragRef.current = null;
                            if (!canDragLabel) return;
                            const nx = e.target.x();
                            const ny = e.target.y();
                            if (!pointInPolygon(nx, ny, points)) {
                              e.target.position({ x: labelCenterX, y: labelCenterY });
                              e.target.getLayer()?.batchDraw?.();
                              return;
                            }
                            onUpdateCorridor?.(corridor.id, {
                              labelX: Number(nx.toFixed(3)),
                              labelY: Number(ny.toFixed(3))
                            });
                          }}
                        >
                          <Rect
                            x={-labelWidth / 2}
                            y={-labelHeight / 2}
                            width={labelWidth}
                            height={labelHeight}
                            cornerRadius={6 * labelScale}
                            fill="rgba(255,255,255,0.9)"
                            stroke={isSelectedCorridor ? 'rgba(15,118,110,0.65)' : 'rgba(100,116,139,0.45)'}
                            strokeWidth={isSelectedCorridor ? 1.2 : 0.8}
                          />
                          <Text
                            x={-labelWidth / 2 + 5 * labelScale}
                            y={-labelHeight / 2 + 4 * labelScale}
                            width={labelWidth - 10 * labelScale}
                            text={label}
                            align="center"
                            fontSize={11 * labelScale}
                            fontStyle={isSelectedCorridor ? '700' : '600'}
                            fill={isSelectedCorridor ? '#0f172a' : '#334155'}
                            wrap="none"
                            ellipsis
                          />
                        </Group>
                        {isSelectedCorridor ? (
                          <Group x={labelCenterX + labelWidth / 2 + 11} y={labelCenterY - labelHeight / 2 - 1}>
                            <Group
                              onClick={(e) => {
                                e.cancelBubble = true;
                                onAdjustCorridorLabelScale?.(corridor.id, 0.1);
                              }}
                            >
                              <Circle radius={8} fill="rgba(15,23,42,0.88)" stroke="rgba(255,255,255,0.35)" strokeWidth={0.9} />
                              <Text x={-3.5} y={-5.8} text="+" fontSize={11} fill="#ffffff" listening={false} />
                            </Group>
                            <Group
                              y={19}
                              onClick={(e) => {
                                e.cancelBubble = true;
                                onAdjustCorridorLabelScale?.(corridor.id, -0.1);
                              }}
                            >
                              <Circle radius={8} fill="rgba(15,23,42,0.88)" stroke="rgba(255,255,255,0.35)" strokeWidth={0.9} />
                              <Text x={-2.8} y={-5.8} text="-" fontSize={11} fill="#ffffff" listening={false} />
                            </Group>
                          </Group>
                        ) : null}
                      </>
                    );
                  })()
                ) : null}
                {connections.map((connection) => {
                  const point =
                    (Number.isFinite(Number((connection as any).x)) && Number.isFinite(Number((connection as any).y))
                      ? { x: Number((connection as any).x), y: Number((connection as any).y) }
                      : null) || getCorridorEdgePoint(points, Number(connection.edgeIndex), Number(connection.t));
                  if (!point) return null;
                  const canDragConnection = isSelectedCorridor && !readOnly && !isDraftTarget;
                  const transitionType = (connection as any)?.transitionType === 'elevator' ? 'elevator' : 'stairs';
                  const transitionLabel =
                    transitionType === 'elevator'
                      ? t({ it: 'Ascensore', en: 'Elevator' })
                      : t({ it: 'Scale', en: 'Stairs' });
                  const connectedPlanIds = Array.from(
                    new Set(
                      (Array.isArray((connection as any)?.planIds) ? (connection as any).planIds : [])
                        .map((id: any) => String(id || '').trim())
                        .filter(Boolean)
                    )
                  ) as string[];
                  const connectedPlanNames = connectedPlanIds
                    .map((id) => String(connectionPlanNamesById?.[id] || '').trim())
                    .filter(Boolean);
                  const currentPlanName = String((plan as any)?.name || '').trim() || t({ it: 'Piano corrente', en: 'Current floor' });
                  const renderPlanNames = () => {
                    if (!connectedPlanNames.length) return <span>{t({ it: 'piani non configurati', en: 'no floors configured' })}</span>;
                    return connectedPlanNames.map((name, idx) => (
                      <Fragment key={`${connection.id}:${name}:${idx}`}>
                        <strong>{name}</strong>
                        {idx < connectedPlanNames.length - 1 ? ', ' : ''}
                      </Fragment>
                    ));
                  };
                  const connectionHoverContent = (
                    <div className="space-y-0.5">
                      <div>
                        <span className="font-semibold">{transitionLabel}</span> {t({ it: 'per', en: 'to' })} {renderPlanNames()}
                      </div>
                      <div>
                        {t({ it: 'Collega', en: 'Connects' })}: <strong>{currentPlanName}</strong>
                        {connectedPlanNames.length ? (
                          <>
                            {' '}
                            ↔ {renderPlanNames()}
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
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
                  return (
                    <Group key={connection.id}>
                      <Circle
                        name="corridor-connection-point"
                        x={point.x}
                        y={point.y}
                        radius={5.2}
                        fill="#ef4444"
                        stroke="#7f1d1d"
                        strokeWidth={1.1}
                        draggable={canDragConnection}
                        onClick={(e) => {
                          e.cancelBubble = true;
                          onSelectCorridor?.(corridor.id);
                        }}
                        onMouseEnter={(e) => {
                          const clientPoint = resolveClientPoint(e);
                          setDoorHoverCard({ clientX: clientPoint.clientX, clientY: clientPoint.clientY, content: connectionHoverContent });
                        }}
                        onMouseMove={(e) => {
                          const clientPoint = resolveClientPoint(e);
                          setDoorHoverCard((prev) =>
                            prev
                              ? { ...prev, clientX: clientPoint.clientX, clientY: clientPoint.clientY, content: connectionHoverContent }
                              : { clientX: clientPoint.clientX, clientY: clientPoint.clientY, content: connectionHoverContent }
                          );
                        }}
                        onMouseLeave={() => {
                          setDoorHoverCard(null);
                        }}
                        onDragEnd={(e) => {
                          if (!canDragConnection) return;
                          const node = e.target;
                          const nx = node.x();
                          const ny = node.y();
                          if (!pointInPolygon(nx, ny, points)) {
                            node.position({ x: point.x, y: point.y });
                            node.getLayer()?.batchDraw?.();
                            return;
                          }
                          const snap = getClosestCorridorEdgePoint(points, { x: nx, y: ny });
                          const nextConnections = connections.map((cp) =>
                            cp.id === connection.id
                              ? {
                                  ...cp,
                                  edgeIndex: snap ? snap.edgeIndex : Number(cp.edgeIndex),
                                  t: snap ? Number(snap.t.toFixed(4)) : Number(cp.t),
                                  x: Number(nx.toFixed(3)),
                                  y: Number(ny.toFixed(3))
                                }
                              : cp
                          );
                          onUpdateCorridor?.(corridor.id, { connections: nextConnections as any });
                        }}
                        onContextMenu={(e) => {
                          e.evt.preventDefault();
                          e.evt.stopPropagation?.();
                          e.cancelBubble = true;
                          if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                          if (isBoxSelecting()) return;
                          onSelectCorridor?.(corridor.id, { keepContext: true });
                          onSelectCorridorDoor?.(undefined);
                          onCorridorConnectionContextMenu?.({
                            corridorId: corridor.id,
                            connectionId: connection.id,
                            clientX: e.evt.clientX,
                            clientY: e.evt.clientY,
                            worldX: point.x,
                            worldY: point.y
                          });
                        }}
                      />
                      <Circle x={point.x} y={point.y} radius={1.8} fill="#fee2e2" listening={false} />
                    </Group>
                  );
                })}
                {isSelectedCorridor && kind === 'poly' && !readOnly && !isDraftTarget
                  ? points.map((p, idx) => (
                      <Circle
                        key={`${corridor.id}:v:${idx}`}
                        ref={(node) => {
                          if (!corridorVertexRefs.current[corridor.id]) corridorVertexRefs.current[corridor.id] = {};
                          if (node) corridorVertexRefs.current[corridor.id][idx] = node;
                          else if (corridorVertexRefs.current[corridor.id]) delete corridorVertexRefs.current[corridor.id][idx];
                        }}
                        x={p.x}
                        y={p.y}
                        radius={3.8}
                        fill="#ffffff"
                        stroke="#0f766e"
                        strokeWidth={1.3}
                        draggable={!panToolActive}
                        onDragMove={() => {
                          const line = corridorPolyLineRefs.current[corridor.id];
                          const node = corridorVertexRefs.current[corridor.id]?.[idx];
                          if (!line || !node) return;
                          const next = points.flatMap((pt, i) => {
                            const x = i === idx ? node.x() : pt.x;
                            const y = i === idx ? node.y() : pt.y;
                            return [x, y];
                          });
                          line.points(next);
                          line.getLayer()?.batchDraw?.();
                        }}
                        onDragEnd={() => {
                          const node = corridorVertexRefs.current[corridor.id]?.[idx];
                          if (!node) return;
                          const nextPoints = points.map((pt, i) =>
                            i === idx ? { x: Number(node.x()), y: Number(node.y()) } : { x: pt.x, y: pt.y }
                          );
                          if (nextPoints.length < 3) return;
                          if (nextPoints.some((pt) => !Number.isFinite(pt.x) || !Number.isFinite(pt.y))) return;
                          onUpdateCorridor?.(corridor.id, { kind: 'poly', points: nextPoints });
                        }}
                      />
                    ))
                  : null}
              </Group>
            );
          })}
          {corridorDoorDraft?.corridorId && corridorDoorHover ? (
            <>
              <Group x={corridorDoorHover.x} y={corridorDoorHover.y} listening={false}>
                <Circle radius={8} fill="rgba(146,64,14,0.26)" stroke="#92400e" strokeWidth={1.4} />
                <Rect x={-2.8} y={-4.2} width={5.6} height={8.4} cornerRadius={1.2} stroke="#92400e" strokeWidth={1} fillEnabled={false} />
                <Line points={[0, -4.2, 0, 4.2]} stroke="#92400e" strokeWidth={1} />
              </Group>
            </>
          ) : null}
        </Layer>
  );
};
