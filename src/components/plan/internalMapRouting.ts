/* eslint-disable @typescript-eslint/no-explicit-any */
export * from './internalMapPathfinding';
import { Corridor, FloorPlan } from '../../store/types';
import {
  ConnectionTransitionType,
  MultiFloorRouteResult,
  Point,
  RoutePlanSegment,
  RouteResult,
  SPEED_MPS,
  MinHeap,
  computeRoute,
  reverseRoute,
  getCorridorConnectionAnchor,
  normalizeTransitionType,
  transitionPenaltySeconds
} from './internalMapPathfinding';

export interface ComputeMultiFloorRouteOptions {
  allowedTransitionTypes?: ConnectionTransitionType[];
}

export const computeMultiFloorRoute = (
  plans: FloorPlan[],
  startPlanId: string,
  destinationPlanId: string,
  startPoint: Point,
  destinationPoint: Point,
  options?: ComputeMultiFloorRouteOptions
): { result?: MultiFloorRouteResult; error?: string } => {
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const startPlan = planById.get(startPlanId);
  const destinationPlan = planById.get(destinationPlanId);
  if (!startPlan || !destinationPlan) return { error: 'path-not-found' };
  const allowedTransitionTypes =
    options?.allowedTransitionTypes && options.allowedTransitionTypes.length
      ? new Set(options.allowedTransitionTypes)
      : null;

  if (startPlan.id === destinationPlan.id) {
    const direct = computeRoute(startPlan, startPoint, destinationPoint);
    if (!direct.route) return { error: direct.error || 'path-not-found' };
    return {
      result: {
        segments: [
          {
            planId: startPlan.id,
            planName: String(startPlan.name || ''),
            startPoint,
            endPoint: destinationPoint,
            route: direct.route
          }
        ],
        distancePx: direct.route.distancePx,
        distanceMeters: direct.route.distanceMeters,
        transitionSeconds: 0,
        etaSeconds: direct.route.etaSeconds
      }
    };
  }

  type ConnectionNode = {
    nodeId: string;
    planId: string;
    planName: string;
    connectionId: string;
    point: Point;
    targets: string[];
    transitionType: ConnectionTransitionType;
  };
  type GraphEdge =
    | {
        kind: 'walk';
        fromNode: string;
        toNode: string;
        planId: string;
        route: RouteResult;
        startPoint: Point;
        endPoint: Point;
        startConnectionId?: string;
        endConnectionId?: string;
        cost: number;
      }
    | {
        kind: 'transition';
        fromNode: string;
        toNode: string;
        fromConnectionId: string;
        toConnectionId: string;
        fromPlanId: string;
        toPlanId: string;
        transitionType: ConnectionTransitionType;
        seconds: number;
        cost: number;
      };

  const connectionNodes: ConnectionNode[] = [];
  const nodesByPlan = new Map<string, ConnectionNode[]>();
  for (const plan of plans) {
    const planNodes: ConnectionNode[] = [];
    for (const corridor of (plan.corridors || []) as Corridor[]) {
      for (const connection of corridor.connections || []) {
        const anchor = getCorridorConnectionAnchor(corridor, connection);
        if (!anchor) continue;
        const node: ConnectionNode = {
          nodeId: `cp:${plan.id}:${connection.id}`,
          planId: plan.id,
          planName: String(plan.name || ''),
          connectionId: String(connection.id),
          point: anchor,
          targets: Array.from(new Set((connection.planIds || []).map((id) => String(id)).filter(Boolean))),
          transitionType: normalizeTransitionType((connection as any).transitionType)
        };
        planNodes.push(node);
        connectionNodes.push(node);
      }
    }
    nodesByPlan.set(plan.id, planNodes);
  }

  const startPlanConnections = nodesByPlan.get(startPlan.id) || [];
  const destinationPlanConnections = nodesByPlan.get(destinationPlan.id) || [];
  if (!startPlanConnections.length || !destinationPlanConnections.length) {
    return { error: 'path-not-found' };
  }

  const meterSamples = plans
    .map((plan) => Number(plan.scale?.metersPerPixel))
    .filter((value) => Number.isFinite(value) && value > 0) as number[];
  const avgMetersPerPixel = meterSamples.length
    ? meterSamples.reduce((sum, value) => sum + value, 0) / meterSamples.length
    : 0.05;

  const transitionCost = (type: ConnectionTransitionType) => {
    const seconds = transitionPenaltySeconds(type);
    return Math.max(1, (seconds * SPEED_MPS) / Math.max(0.000001, avgMetersPerPixel));
  };

  const START_NODE = '__start__';
  const END_NODE = '__end__';
  const adjacency = new Map<string, GraphEdge[]>();
  const addEdge = (edge: GraphEdge) => {
    const list = adjacency.get(edge.fromNode) || [];
    list.push(edge);
    adjacency.set(edge.fromNode, list);
  };

  const routeCache = new Map<string, RouteResult | null>();
  const routeKey = (planId: string, a: Point, b: Point) =>
    `${planId}:${Number(a.x.toFixed(3))},${Number(a.y.toFixed(3))}->${Number(b.x.toFixed(3))},${Number(b.y.toFixed(3))}`;
  const getRoute = (plan: FloorPlan, from: Point, to: Point) => {
    const key = routeKey(plan.id, from, to);
    if (routeCache.has(key)) return routeCache.get(key);
    const result = computeRoute(plan, from, to).route || null;
    routeCache.set(key, result);
    if (result) {
      const reverseKey = routeKey(plan.id, to, from);
      routeCache.set(reverseKey, reverseRoute(result));
    }
    return result;
  };

  const addWalkBothWays = (
    plan: FloorPlan,
    fromNode: string,
    fromPoint: Point,
    toNode: string,
    toPoint: Point,
    startConnectionId?: string,
    endConnectionId?: string
  ) => {
    if (fromNode === toNode) return;
    const forward = getRoute(plan, fromPoint, toPoint);
    if (!forward) return;
    addEdge({
      kind: 'walk',
      fromNode,
      toNode,
      planId: plan.id,
      route: forward,
      startPoint: fromPoint,
      endPoint: toPoint,
      startConnectionId,
      endConnectionId,
      cost: Math.max(1, forward.distancePx)
    });
    addEdge({
      kind: 'walk',
      fromNode: toNode,
      toNode: fromNode,
      planId: plan.id,
      route: reverseRoute(forward),
      startPoint: toPoint,
      endPoint: fromPoint,
      startConnectionId: endConnectionId,
      endConnectionId: startConnectionId,
      cost: Math.max(1, forward.distancePx)
    });
  };

  for (const connection of startPlanConnections) {
    const route = computeRoute(startPlan, startPoint, connection.point).route;
    if (!route) continue;
    addEdge({
      kind: 'walk',
      fromNode: START_NODE,
      toNode: connection.nodeId,
      planId: startPlan.id,
      route,
      startPoint,
      endPoint: connection.point,
      endConnectionId: connection.connectionId,
      cost: Math.max(1, route.distancePx)
    });
  }

  for (const connection of destinationPlanConnections) {
    const route = computeRoute(destinationPlan, connection.point, destinationPoint).route;
    if (!route) continue;
    addEdge({
      kind: 'walk',
      fromNode: connection.nodeId,
      toNode: END_NODE,
      planId: destinationPlan.id,
      route,
      startPoint: connection.point,
      endPoint: destinationPoint,
      startConnectionId: connection.connectionId,
      cost: Math.max(1, route.distancePx)
    });
  }

  for (const [planId, nodes] of nodesByPlan.entries()) {
    const plan = planById.get(planId);
    if (!plan || nodes.length < 2) continue;
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        addWalkBothWays(plan, a.nodeId, a.point, b.nodeId, b.point, a.connectionId, b.connectionId);
      }
    }
  }

  for (let i = 0; i < connectionNodes.length; i += 1) {
    for (let j = i + 1; j < connectionNodes.length; j += 1) {
      const a = connectionNodes[i];
      const b = connectionNodes[j];
      if (a.planId === b.planId) continue;
      const linked = a.targets.includes(b.planId) || b.targets.includes(a.planId);
      if (!linked) continue;
      const abType = a.transitionType;
      const baType = b.transitionType;
      if (!allowedTransitionTypes || allowedTransitionTypes.has(abType)) {
        addEdge({
          kind: 'transition',
          fromNode: a.nodeId,
          toNode: b.nodeId,
          fromConnectionId: a.connectionId,
          toConnectionId: b.connectionId,
          fromPlanId: a.planId,
          toPlanId: b.planId,
          transitionType: abType,
          seconds: transitionPenaltySeconds(abType),
          cost: transitionCost(abType)
        });
      }
      if (!allowedTransitionTypes || allowedTransitionTypes.has(baType)) {
        addEdge({
          kind: 'transition',
          fromNode: b.nodeId,
          toNode: a.nodeId,
          fromConnectionId: b.connectionId,
          toConnectionId: a.connectionId,
          fromPlanId: b.planId,
          toPlanId: a.planId,
          transitionType: baType,
          seconds: transitionPenaltySeconds(baType),
          cost: transitionCost(baType)
        });
      }
    }
  }

  const bestByNode = new Map<string, number>([[START_NODE, 0]]);
  const previous = new Map<string, { prevNode: string; edge: GraphEdge }>();
  const heap = new MinHeap();
  heap.push({ key: START_NODE, score: 0 });
  while (heap.size) {
    const next = heap.pop();
    if (!next) break;
    const currentNode = next.key;
    const currentDist = bestByNode.get(currentNode);
    if (currentDist === undefined) continue;
    if (next.score > currentDist + 0.0001) continue;
    if (currentNode === END_NODE) break;
    for (const edge of adjacency.get(currentNode) || []) {
      const candidate = currentDist + edge.cost;
      const prevBest = bestByNode.get(edge.toNode);
      if (prevBest !== undefined && candidate >= prevBest - 0.0001) continue;
      bestByNode.set(edge.toNode, candidate);
      previous.set(edge.toNode, { prevNode: currentNode, edge });
      heap.push({ key: edge.toNode, score: candidate });
    }
  }

  if (!bestByNode.has(END_NODE)) return { error: 'path-not-found' };

  const orderedEdges: GraphEdge[] = [];
  let cursor = END_NODE;
  while (cursor !== START_NODE) {
    const prev = previous.get(cursor);
    if (!prev) return { error: 'path-not-found' };
    orderedEdges.push(prev.edge);
    cursor = prev.prevNode;
  }
  orderedEdges.reverse();

  const segments: RoutePlanSegment[] = [];
  let transitionSeconds = 0;
  for (let i = 0; i < orderedEdges.length; i += 1) {
    const edge = orderedEdges[i];
    if (edge.kind === 'transition') {
      transitionSeconds += edge.seconds;
      continue;
    }
    const prevTransition = i > 0 && orderedEdges[i - 1].kind === 'transition' ? (orderedEdges[i - 1] as GraphEdge & { kind: 'transition' }) : null;
    const nextTransition =
      i + 1 < orderedEdges.length && orderedEdges[i + 1].kind === 'transition'
        ? (orderedEdges[i + 1] as GraphEdge & { kind: 'transition' })
        : null;
    const plan = planById.get(edge.planId);
    if (!plan) continue;
    segments.push({
      planId: edge.planId,
      planName: String(plan.name || edge.planId),
      startPoint: edge.startPoint,
      endPoint: edge.endPoint,
      route: edge.route,
      startConnectionId: edge.startConnectionId,
      endConnectionId: edge.endConnectionId,
      startTransitionType: prevTransition?.transitionType,
      endTransitionType: nextTransition?.transitionType
    });
  }

  if (!segments.length) return { error: 'path-not-found' };

  const distancePx = segments.reduce((sum, segment) => sum + segment.route.distancePx, 0);
  const hasMeters = segments.every(
    (segment) => typeof segment.route.distanceMeters === 'number' && Number.isFinite(segment.route.distanceMeters)
  );
  const distanceMeters = hasMeters
    ? segments.reduce((sum, segment) => sum + Number(segment.route.distanceMeters || 0), 0)
    : undefined;
  const etaSeconds = distanceMeters !== undefined ? distanceMeters / SPEED_MPS + transitionSeconds : undefined;

  return {
    result: {
      segments,
      distancePx,
      distanceMeters,
      transitionSeconds,
      etaSeconds
    }
  };
};

export const formatEta = (seconds?: number) => {
  if (!seconds || !Number.isFinite(seconds)) return '--';
  const rounded = Math.max(1, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remaining = rounded % 60;
  if (!minutes) return `${remaining}s`;
  return `${minutes}m ${remaining}s`;
};

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

