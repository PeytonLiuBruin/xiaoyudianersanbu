import { ROUTE_CARDS, ROUTE_MARKERS, type Edge, type Point } from '../content/puzzleData.ts';

export type { Edge, Point } from '../content/puzzleData.ts';
export const CARD_DATA = ROUTE_CARDS;
export const MARKERS = ROUTE_MARKERS;

export interface RouteEvaluation {
  solved: boolean;
  path: Point[];
  edges: Edge[];
  reachable: Point[];
}

const keyOf = (point: Point): string => `${point.x},${point.y}`;

/** Clockwise rotation about the center of the common five-by-five grid. */
export function rotatePoint(point: Point, quarterTurns: number): Point {
  let x = point.x;
  let y = point.y;
  const turns = ((Math.trunc(quarterTurns) % 4) + 4) % 4;
  for (let i = 0; i < turns; i++) [x, y] = [4 - y, x];
  return { x, y };
}

export function rotatedEdges(index: number, quarterTurns: number): Edge[] {
  const card = CARD_DATA[index];
  if (!card) throw new RangeError(`Unknown route card: ${index}`);
  return card.edges.map(([a, b]) => [rotatePoint(a, quarterTurns), rotatePoint(b, quarterTurns)]);
}

/** Also useful for checking future card designs without adding special-case solutions. */
export function evaluateEdges(edges: readonly Edge[], allPlaced = true): RouteEvaluation {
  const graph = new Map<string, Set<string>>();
  const points = new Map<string, Point>();
  const uniqueEdges = new Map<string, Edge>();
  for (const [a, b] of edges) {
    const aKey = keyOf(a);
    const bKey = keyOf(b);
    points.set(aKey, a);
    points.set(bKey, b);
    if (!graph.has(aKey)) graph.set(aKey, new Set());
    if (!graph.has(bKey)) graph.set(bKey, new Set());
    graph.get(aKey)!.add(bKey);
    graph.get(bKey)!.add(aKey);
    uniqueEdges.set([aKey, bKey].sort().join('|'), [a, b]);
  }

  const start = keyOf(MARKERS.frog_start);
  const checkpoint = keyOf(MARKERS.flower_checkpoint);
  const goal = keyOf(MARKERS.icecream_goal);
  points.set(start, MARKERS.frog_start);
  const reachableKeys = new Set([start]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    for (const neighbor of graph.get(queue[i]!) ?? []) {
      if (reachableKeys.has(neighbor)) continue;
      reachableKeys.add(neighbor);
      queue.push(neighbor);
    }
  }

  // Find an actual simple route via the flower. Merely reaching a flower on a
  // dead-end spur and backtracking over the same junction does not solve it.
  const visited = new Set([start]);
  const pathKeys = [start];
  function findPath(current: string, passedFlower: boolean): boolean {
    if (current === goal) return passedFlower;
    for (const neighbor of graph.get(current) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      pathKeys.push(neighbor);
      if (findPath(neighbor, passedFlower || neighbor === checkpoint)) return true;
      pathKeys.pop();
      visited.delete(neighbor);
    }
    return false;
  }

  const solved = allPlaced && reachableKeys.has(checkpoint) && reachableKeys.has(goal)
    && findPath(start, start === checkpoint);
  return {
    solved,
    path: solved ? pathKeys.map(key => ({ ...points.get(key)! })) : [],
    edges: [...uniqueEdges.values()],
    reachable: queue.map(key => ({ ...points.get(key)! })),
  };
}

export function evaluateRoutes(rotations: number[], placed: boolean[]): RouteEvaluation {
  const edges = CARD_DATA.flatMap((_, index) => placed[index]
    ? rotatedEdges(index, rotations[index] ?? 0)
    : []);
  return evaluateEdges(edges, CARD_DATA.every((_, index) => placed[index] === true));
}
