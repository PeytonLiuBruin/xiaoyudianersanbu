import { THROW_DATA, type Point } from '../content/puzzleData.ts';

export type { Point } from '../content/puzzleData.ts';
export interface Rect extends Point { width: number; height: number }

export function pointAt(
  origin: Point,
  velocity: Point,
  t: number,
  gravity = THROW_DATA.gravity as number,
): Point {
  return {
    x: origin.x + velocity.x * t,
    y: origin.y + velocity.y * t + 0.5 * gravity * t * t,
  };
}

/** Pull away from the intended direction, then release. Speed is in pixels/second. */
export function velocityFromDrag(
  origin: Point,
  drag: Point,
  maxPower = THROW_DATA.maxPower as number,
): Point {
  const x = (origin.x - drag.x) * THROW_DATA.dragScale;
  const y = (origin.y - drag.y) * THROW_DATA.dragScale;
  const magnitude = Math.hypot(x, y);
  const scale = magnitude > 0 ? Math.min(1, Math.max(0, maxPower) / magnitude) : 0;
  return { x: x * scale, y: y * scale };
}

/** An aiming aid still produces a ballistic launch, so the normal hit test applies. */
export function suggestedVelocity(
  origin: Point,
  target: Point,
  gravity = THROW_DATA.gravity as number,
): Point {
  const flightTime = Math.max(0.55, Math.abs(target.x - origin.x) / 340);
  return {
    x: (target.x - origin.x) / flightTime,
    y: (target.y - origin.y - 0.5 * gravity * flightTime ** 2) / flightTime,
  };
}

function squaredDistanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return (point.x - a.x - t * dx) ** 2 + (point.y - a.y - t * dy) ** 2;
}

function squaredDistanceToRect(point: Point, rect: Rect): number {
  const dx = Math.max(rect.x - point.x, 0, point.x - rect.x - rect.width);
  const dy = Math.max(rect.y - point.y, 0, point.y - rect.y - rect.height);
  return dx * dx + dy * dy;
}

function segmentIntersectsRect(a: Point, b: Point, rect: Rect): boolean {
  let enter = 0;
  let exit = 1;
  for (const axis of ['x', 'y'] as const) {
    const start = a[axis];
    const delta = b[axis] - start;
    const minimum = rect[axis];
    const maximum = minimum + (axis === 'x' ? rect.width : rect.height);
    if (delta === 0) {
      if (start < minimum || start > maximum) return false;
      continue;
    }
    const first = (minimum - start) / delta;
    const second = (maximum - start) / delta;
    enter = Math.max(enter, Math.min(first, second));
    exit = Math.min(exit, Math.max(first, second));
    if (enter > exit) return false;
  }
  return true;
}

/** Swept circular collision, including true rounded corners and fast-moving throws. */
export function segmentHitsRect(
  a: Point,
  b: Point,
  rect: Rect,
  radius = THROW_DATA.projectileRadius as number,
): boolean {
  if (segmentIntersectsRect(a, b, rect)) return true;
  const radiusSquared = Math.max(0, radius) ** 2;
  if (Math.min(squaredDistanceToRect(a, rect), squaredDistanceToRect(b, rect)) <= radiusSquared) {
    return true;
  }
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x, y: rect.y + rect.height },
    { x: rect.x + rect.width, y: rect.y + rect.height },
  ].some(corner => squaredDistanceToSegment(corner, a, b) <= radiusSquared);
}
