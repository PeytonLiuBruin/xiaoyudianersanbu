/** Coordinates and tracks shared by the puzzle logic and its visible drawing. */
export interface Point { x: number; y: number }
export type Edge = readonly [Point, Point];

export const THROW_DATA = {
  gravity: 420,
  dragScale: 3.4,
  maxPower: 620,
  projectileRadius: 10,
} as const;

export const STICK_DATA = {
  length: 270,
  thickness: 12,
  gateWidth: 125,
  tolerance: 8,
} as const;

export interface RouteCardDefinition {
  id: string;
  name: string;
  color: number;
  edges: readonly Edge[];
}

export const ROUTE_GRID_SIZE = 5;
export const ROUTE_MARKERS = {
  frog_start: { x: 0, y: 2 },
  flower_checkpoint: { x: 2, y: 1 },
  icecream_goal: { x: 4, y: 2 },
} as const;

// Unit-length segments prevent a visible crossing from silently becoming a junction.
// Every junction is an explicit endpoint in this data.
export const ROUTE_CARDS: readonly RouteCardDefinition[] = [
  {
    id: 'card-1', name: '小卡一', color: 0xb85643,
    edges: [
      [{ x: 2, y: 4 }, { x: 1, y: 4 }],
      [{ x: 1, y: 4 }, { x: 1, y: 3 }],
      [{ x: 1, y: 3 }, { x: 0, y: 3 }],
      [{ x: 0, y: 3 }, { x: 0, y: 2 }],
    ],
  },
  {
    id: 'card-2', name: '小卡二', color: 0x426e85,
    edges: [
      [{ x: 2, y: 4 }, { x: 2, y: 3 }],
      [{ x: 2, y: 3 }, { x: 1, y: 3 }],
      [{ x: 1, y: 3 }, { x: 1, y: 2 }],
    ],
  },
  {
    id: 'card-3', name: '小卡三', color: 0x717d45,
    edges: [
      [{ x: 2, y: 3 }, { x: 1, y: 3 }],
      [{ x: 1, y: 3 }, { x: 1, y: 4 }],
      [{ x: 1, y: 4 }, { x: 2, y: 4 }],
    ],
  },
];

export type SwitchSetting = 'L' | 'R';
export interface MachineNode extends Point {
  id: string;
  label?: string;
  kind?: 'entrance' | 'switch' | 'track' | 'recycle' | 'return' | 'cup';
}
export interface MachineEdge {
  from: string;
  to: string;
  switchIndex?: number;
  direction?: SwitchSetting;
}

export const MACHINE_ENTRANCE = 'entrance';
export const MACHINE_CUP = 'cup';
export const MACHINE_RECYCLE = 'recycle';

export const MACHINE_SWITCHES = [
  { index: 0, nodeId: 'switch-0', x: 170, y: 58 },
  { index: 1, nodeId: 'switch-1', x: 106, y: 126 },
  { index: 2, nodeId: 'switch-2', x: 182, y: 190 },
] as const;

export const MACHINE_NODES: readonly MachineNode[] = [
  { id: 'entrance', x: 170, y: 16, kind: 'entrance', label: '入口' },
  { id: 'switch-0', x: 170, y: 58, kind: 'switch' },
  { id: 'track-0-left', x: 106, y: 94, kind: 'track' },
  { id: 'track-0-right', x: 270, y: 94, kind: 'track' },
  { id: 'right-rail-top', x: 322, y: 112, kind: 'track' },
  { id: 'right-rail-bottom', x: 322, y: 292, kind: 'track' },
  { id: 'bottom-rail', x: 24, y: 292, kind: 'track' },
  { id: 'switch-1', x: 106, y: 126, kind: 'switch' },
  { id: 'track-1-left', x: 58, y: 160, kind: 'track' },
  { id: 'track-1-right', x: 182, y: 160, kind: 'track' },
  { id: 'switch-2', x: 182, y: 190, kind: 'switch' },
  { id: 'track-2-left', x: 130, y: 228, kind: 'track' },
  { id: 'track-2-right', x: 242, y: 228, kind: 'track' },
  { id: 'left-recycle-join', x: 24, y: 222, kind: 'track' },
  { id: 'cup', x: 242, y: 278, kind: 'cup', label: '杯子' },
  { id: 'recycle', x: 24, y: 276, kind: 'recycle', label: '回收' },
  { id: 'return-bottom', x: 8, y: 276, kind: 'return' },
  { id: 'return-top', x: 8, y: 10, kind: 'return' },
  { id: 'return-entry', x: 140, y: 10, kind: 'return' },
];

export const MACHINE_EDGES: readonly MachineEdge[] = [
  { from: 'entrance', to: 'switch-0' },
  { from: 'switch-0', to: 'track-0-left', switchIndex: 0, direction: 'L' },
  { from: 'switch-0', to: 'track-0-right', switchIndex: 0, direction: 'R' },
  { from: 'track-0-left', to: 'switch-1' },
  { from: 'track-0-right', to: 'right-rail-top' },
  { from: 'right-rail-top', to: 'right-rail-bottom' },
  { from: 'right-rail-bottom', to: 'bottom-rail' },
  { from: 'bottom-rail', to: 'recycle' },
  { from: 'switch-1', to: 'track-1-left', switchIndex: 1, direction: 'L' },
  { from: 'switch-1', to: 'track-1-right', switchIndex: 1, direction: 'R' },
  { from: 'track-1-left', to: 'left-recycle-join' },
  { from: 'track-1-right', to: 'switch-2' },
  { from: 'switch-2', to: 'track-2-left', switchIndex: 2, direction: 'L' },
  { from: 'switch-2', to: 'track-2-right', switchIndex: 2, direction: 'R' },
  { from: 'track-2-left', to: 'left-recycle-join' },
  { from: 'track-2-right', to: 'cup' },
  { from: 'left-recycle-join', to: 'recycle' },
  { from: 'recycle', to: 'return-bottom' },
  { from: 'return-bottom', to: 'return-top' },
  { from: 'return-top', to: 'return-entry' },
  { from: 'return-entry', to: 'entrance' },
];
