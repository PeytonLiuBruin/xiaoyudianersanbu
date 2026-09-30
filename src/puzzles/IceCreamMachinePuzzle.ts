import {
  MACHINE_CUP, MACHINE_EDGES, MACHINE_ENTRANCE, MACHINE_NODES, MACHINE_SWITCHES,
  type MachineNode, type SwitchSetting,
} from '../content/puzzleData.ts';

export {
  MACHINE_CUP, MACHINE_EDGES, MACHINE_ENTRANCE, MACHINE_NODES, MACHINE_SWITCHES,
  MACHINE_RECYCLE,
} from '../content/puzzleData.ts';
export type { MachineNode, MachineEdge, SwitchSetting } from '../content/puzzleData.ts';

export interface BallRoute { nodes: MachineNode[]; success: boolean }

const nodeById = new Map(MACHINE_NODES.map(node => [node.id, node]));

/** The animation consumes this same route, including the failed order's return trip. */
export function routeBall(switches: SwitchSetting[]): BallRoute {
  if (switches.length !== MACHINE_SWITCHES.length || switches.some(value => value !== 'L' && value !== 'R')) {
    throw new RangeError('The machine needs exactly three L/R switch settings.');
  }
  const nodes: MachineNode[] = [];
  const visited = new Set<string>();
  let current = nodeById.get(MACHINE_ENTRANCE)!;
  while (true) {
    nodes.push(current);
    if (current.id === MACHINE_CUP) return { nodes, success: true };
    // The recycling loop has finished when the ball reaches the entrance again.
    if (visited.has(current.id)) return { nodes, success: false };
    visited.add(current.id);
    const outgoing = MACHINE_EDGES.find(edge => edge.from === current.id &&
      (edge.switchIndex === undefined || edge.direction === switches[edge.switchIndex]));
    if (!outgoing) return { nodes, success: false };
    const next = nodeById.get(outgoing.to);
    if (!next) throw new Error(`Machine track refers to a missing node: ${outgoing.to}`);
    current = next;
  }
}
