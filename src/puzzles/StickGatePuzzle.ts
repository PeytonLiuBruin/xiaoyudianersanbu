import { STICK_DATA } from '../content/puzzleData.ts';

/** Horizontal extent of a rotated rectangle, including the branch's thickness. */
export function projectedWidth(length: number, thickness: number, angleDegrees: number): number {
  const radians = angleDegrees * Math.PI / 180;
  return Math.abs(length * Math.cos(radians)) + Math.abs(thickness * Math.sin(radians));
}

export function canPass(
  length: number,
  thickness: number,
  angleDegrees: number,
  gateWidth: number,
  tolerance = STICK_DATA.tolerance as number,
): boolean {
  return projectedWidth(length, thickness, angleDegrees) < gateWidth - tolerance;
}
