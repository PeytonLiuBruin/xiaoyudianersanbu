import assert from 'node:assert/strict';
import test from 'node:test';
import { pointAt, segmentHitsRect, suggestedVelocity, velocityFromDrag } from '../src/puzzles/ThrowPuzzle.ts';
import { canPass, projectedWidth } from '../src/puzzles/StickGatePuzzle.ts';
import { CARD_DATA, MARKERS, evaluateEdges, evaluateRoutes, rotatedEdges, type Edge, type Point } from '../src/puzzles/RouteCardPuzzle.ts';
import { MACHINE_CUP, MACHINE_EDGES, MACHINE_ENTRANCE, MACHINE_NODES, MACHINE_RECYCLE, routeBall, type SwitchSetting } from '../src/puzzles/IceCreamMachinePuzzle.ts';
import { STICK_DATA, THROW_DATA } from '../src/content/puzzleData.ts';

const samePoint = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;
const pointKey = (point: Point): string => `${point.x},${point.y}`;
const edgeKey = ([a, b]: Edge): string => [pointKey(a), pointKey(b)].sort().join('|');
const close = (actual: number, expected: number): void => {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} should be close to ${expected}`);
};

test('a drag launches in the opposite direction and respects the speed cap', () => {
  assert.deepEqual(velocityFromDrag({ x: 100, y: 100 }, { x: 80, y: 130 }), { x: 68, y: -102 });
  const strong = velocityFromDrag({ x: 0, y: 0 }, { x: -10000, y: 10000 });
  close(Math.hypot(strong.x, strong.y), THROW_DATA.maxPower);
  assert.ok(strong.x > 0 && strong.y < 0);
  assert.deepEqual(velocityFromDrag({ x: 0, y: 0 }, { x: 0, y: 0 }), { x: 0, y: 0 });
  assert.deepEqual(velocityFromDrag({ x: 0, y: 0 }, { x: -20, y: 20 }, 0), { x: 0, y: -0 });
});

test('prediction and the actual throw follow the same gravity, with a real hit and miss', () => {
  const origin = { x: 200, y: 360 };
  const target = { x: 650, y: 300 };
  const penguin = { x: 610, y: 240, width: 80, height: 120 };
  const assist = suggestedVelocity(origin, target);
  assert.deepEqual(pointAt(origin, assist, 0), origin);
  const flightTime = (target.x - origin.x) / assist.x;
  close(pointAt(origin, assist, flightTime).x, target.x);
  close(pointAt(origin, assist, flightTime).y, target.y);

  function hits(velocity: Point): boolean {
    for (let t = 0; t < 2; t += 1 / 60) {
      const a = pointAt(origin, velocity, t);
      const b = pointAt(origin, velocity, t + 1 / 60);
      if (segmentHitsRect(a, b, penguin)) return true;
      if (b.y > 540) return false;
    }
    return false;
  }
  assert.equal(hits(assist), true);
  assert.equal(hits({ x: 50, y: -180 }), false);
  assert.equal(hits({ x: -340, y: -180 }), false);
  close(pointAt({ x: 0, y: 0 }, { x: 100, y: -100 }, 1).y, 110);
});

test('continuous collision catches tunneling, tangency, and excludes rounded-corner misses', () => {
  const rect = { x: 45, y: 40, width: 10, height: 20 };
  assert.equal(segmentHitsRect({ x: 0, y: 50 }, { x: 100, y: 50 }, rect, 0), true);
  assert.equal(segmentHitsRect({ x: 0, y: 30 }, { x: 100, y: 30 }, rect, 10), true);
  assert.equal(segmentHitsRect({ x: 0, y: 29 }, { x: 100, y: 29 }, rect, 10), false);
  assert.equal(segmentHitsRect({ x: 35, y: 30 }, { x: 35, y: 30 }, rect, 10), false);
  assert.equal(segmentHitsRect({ x: 39, y: 32 }, { x: 39, y: 32 }, rect, 10), true);
  assert.equal(segmentHitsRect({ x: 50, y: 50 }, { x: 50, y: 50 }, rect, 0), true);
});

test('the branch fits over a continuous angle interval rather than one exact angle', () => {
  const { length, thickness, gateWidth, tolerance } = STICK_DATA;
  close(projectedWidth(length, thickness, 0), length);
  close(projectedWidth(length, thickness, 90), thickness);
  for (const angle of [67, 70, 80, 90, 100, 110, 113, 270, -90]) {
    assert.equal(canPass(length, thickness, angle, gateWidth, tolerance), true, `${angle} degrees should fit`);
  }
  for (const angle of [0, 45, 65, 115, 135, 180]) {
    assert.equal(canPass(length, thickness, angle, gateWidth, tolerance), false, `${angle} degrees should be blocked`);
  }
  for (let angle = 0; angle < 180; angle += 7) {
    close(projectedWidth(length, thickness, angle), projectedWidth(length, thickness, angle + 180));
  }
  assert.equal(canPass(117, 12, 0, 125, 8), false, 'the clearance margin is strict');
});

test('card rotation changes the very endpoints used to draw and connect the tracks', () => {
  const before = JSON.stringify(CARD_DATA);
  for (let i = 0; i < CARD_DATA.length; i++) {
    assert.deepEqual(rotatedEdges(i, 4), rotatedEdges(i, 0));
    assert.deepEqual(rotatedEdges(i, -1), rotatedEdges(i, 3));
    for (let quarterTurns = 0; quarterTurns < 4; quarterTurns++) {
      for (const [a, b] of rotatedEdges(i, quarterTurns)) {
        for (const point of [a, b]) {
          assert.ok(Number.isInteger(point.x) && Number.isInteger(point.y));
          assert.ok(point.x >= 0 && point.x <= 4 && point.y >= 0 && point.y <= 4);
        }
        assert.equal(Math.abs(a.x - b.x) + Math.abs(a.y - b.y), 1);
      }
    }
  }
  assert.equal(JSON.stringify(CARD_DATA), before, 'rotation must not mutate the source cards');
});

test('all 64 orientations are evaluated as a graph, and each successful route is visible', () => {
  const solutions: number[][] = [];
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) {
    const rotations = [a, b, c];
    const evaluation = evaluateRoutes(rotations, [true, true, true]);
    const drawnEdges = rotations.flatMap((turns, index) => rotatedEdges(index, turns));
    const drawnKeys = new Set(drawnEdges.map(edgeKey));
    assert.deepEqual(new Set(evaluation.edges.map(edgeKey)), drawnKeys);
    if (!evaluation.solved) {
      assert.deepEqual(evaluation.path, []);
      continue;
    }
    solutions.push(rotations);
    assert.ok(rotations.filter(turns => turns !== 0).length >= 2);
    assert.deepEqual(evaluation.path[0], MARKERS.frog_start);
    assert.deepEqual(evaluation.path.at(-1), MARKERS.icecream_goal);
    assert.ok(evaluation.path.some(point => samePoint(point, MARKERS.flower_checkpoint)));
    assert.equal(new Set(evaluation.path.map(pointKey)).size, evaluation.path.length, 'a valid route cannot backtrack');
    for (let i = 1; i < evaluation.path.length; i++) {
      assert.ok(drawnKeys.has(edgeKey([evaluation.path[i - 1]!, evaluation.path[i]!])));
    }
  }
  assert.deepEqual(solutions, [[1, 2, 3], [2, 1, 2]]);
  assert.equal(evaluateRoutes([0, 0, 0], [true, true, true]).solved, false);
});

test('all cards must be placed, and a reachable flower on a dead-end spur is insufficient', () => {
  for (let placement = 0; placement < 7; placement++) {
    const placed = [0, 1, 2].map(index => (placement & (1 << index)) !== 0);
    assert.equal(evaluateRoutes([1, 2, 3], placed).solved, false);
  }
  const direct: Edge[] = [
    [{ x: 0, y: 2 }, { x: 1, y: 2 }],
    [{ x: 1, y: 2 }, { x: 2, y: 2 }],
    [{ x: 2, y: 2 }, { x: 3, y: 2 }],
    [{ x: 3, y: 2 }, { x: 4, y: 2 }],
  ];
  assert.equal(evaluateEdges(direct).solved, false, 'reaching the goal alone is insufficient');
  const spur: Edge[] = [...direct, [{ x: 2, y: 2 }, { x: 2, y: 1 }]];
  const evaluation = evaluateEdges(spur);
  assert.ok(evaluation.reachable.some(point => samePoint(point, MARKERS.flower_checkpoint)));
  assert.ok(evaluation.reachable.some(point => samePoint(point, MARKERS.icecream_goal)));
  assert.equal(evaluation.solved, false, 'the flower and goal must share a simple route from the start');

  const detour: Edge[] = [...direct,
    [{ x: 1, y: 2 }, { x: 1, y: 1 }],
    [{ x: 1, y: 1 }, { x: 2, y: 1 }],
    [{ x: 2, y: 1 }, { x: 3, y: 1 }],
    [{ x: 3, y: 1 }, { x: 3, y: 2 }],
  ];
  assert.equal(evaluateEdges(detour).solved, true, 'a real route through the flower works even when a shortcut exists');
});

test('all 8 machine settings follow actual selected rails, with the 7 failures returning to the entrance', () => {
  const nodeIds = new Set(MACHINE_NODES.map(node => node.id));
  for (const edge of MACHINE_EDGES) {
    assert.ok(nodeIds.has(edge.from) && nodeIds.has(edge.to));
  }
  for (const a of ['L', 'R'] as const) for (const b of ['L', 'R'] as const) for (const c of ['L', 'R'] as const) {
    const settings: SwitchSetting[] = [a, b, c];
    const route = routeBall(settings);
    const correct = a === 'L' && b === 'R' && c === 'R';
    assert.equal(route.success, correct, settings.join(''));
    assert.equal(route.nodes[0]!.id, MACHINE_ENTRANCE);
    for (let i = 1; i < route.nodes.length; i++) {
      assert.ok(MACHINE_EDGES.some(edge =>
        edge.from === route.nodes[i - 1]!.id && edge.to === route.nodes[i]!.id &&
        (edge.switchIndex === undefined || edge.direction === settings[edge.switchIndex])));
    }
    if (correct) {
      assert.equal(route.nodes.at(-1)!.id, MACHINE_CUP);
      assert.equal(route.nodes.some(node => node.id === MACHINE_RECYCLE), false);
    } else {
      assert.equal(route.nodes.at(-1)!.id, MACHINE_ENTRANCE);
      assert.equal(route.nodes.filter(node => node.id === MACHINE_ENTRANCE).length, 2);
      assert.ok(route.nodes.some(node => node.id === MACHINE_RECYCLE));
      assert.equal(route.nodes.some(node => node.id === MACHINE_CUP), false);
    }
    if (a === 'R') {
      assert.equal(route.nodes.some(node => node.id === 'switch-1'), false, 'first-level failure bypasses later switches');
    } else if (b === 'L') {
      assert.equal(route.nodes.some(node => node.id === 'switch-2'), false, 'second-level failure bypasses the final switch');
    }
  }
  assert.deepEqual(routeBall(['L', 'R', 'R']).nodes.map(node => node.id), [
    'entrance', 'switch-0', 'track-0-left', 'switch-1', 'track-1-right', 'switch-2', 'track-2-right', 'cup',
  ]);
});

test('the machine rejects malformed control states rather than silently accepting an order', () => {
  assert.throws(() => routeBall(['L']), RangeError);
  assert.throws(() => routeBall(['L', 'R', 'X'] as SwitchSetting[]), RangeError);
});
