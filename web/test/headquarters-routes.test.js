import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { layoutHeadquarters } from "../scripts/domain/headquarters/headquarters-layout.js";
import { headquartersSpots } from "../scripts/domain/headquarters/headquarters-spots.js";
import { headquartersRoutes } from "../scripts/domain/navigation/headquarters-routes.js";
import { crossesRect } from "../scripts/domain/navigation/segment-crossing.js";

const NOW = 1_800_000_000_000;
const MINUTE = 60_000;
const BODY_CLEARANCE = 0.1;
const SAME_POINT = 0.01;
const MAX_PROJECTS = 12;

const agentOf = (key, extra = {}) => ({
  key, kind: "main", source: "claude", parentKey: null, label: "Claude Code", status: "working", activity: "editing",
  startedAt: NOW - 60 * MINUTE, updatedAt: NOW, endedAt: null, ...extra,
});
function officeWith(projectCount) {
  return Object.fromEntries(Array.from({ length: projectCount }, (_, p) => {
    const agents = Array.from({ length: 1 + (p % 4) * 2 }, (__, a) => agentOf(`claude:p${p}-a${a}`, { startedAt: NOW - MINUTE + a }));
    const key = `c:/p${String(p).padStart(2, "0")}`;
    return [key, { key, name: key, template: "startup", createdAt: NOW + p, updatedAt: NOW, team: [], agents: Object.fromEntries(agents.map((agent) => [agent.key, agent])) }];
  }));
}

const isInside = ({ x, z, w, d }, point) => point.x > x && point.x < x + w && point.z > z && point.z < z + d;
const obstaclesOf = (layout) => [
  ...layout.walls.map((wall) => ({ ...wall, what: `wall ${wall.id}` })),
  ...layout.islands.map((island) => ({ ...island.desk, what: `island ${island.index}` })),
  ...layout.decor.filter((item) => !item.y).map((item) => ({ ...item, what: `furniture ${item.id}` })),
];
const grown = (rect) => ({ x: rect.x - BODY_CLEARANCE, z: rect.z - BODY_CLEARANCE, w: rect.w + 2 * BODY_CLEARANCE, d: rect.d + 2 * BODY_CLEARANCE });

function blockedSegments(points, obstacles, { from, to }) {
  const ends = [from, to].filter(Boolean);
  const own = obstacles.filter((rect) => ends.some((end) => isInside(grown(rect), end)));
  const others = obstacles.filter((rect) => !own.includes(rect));
  return points.slice(1).flatMap((point, i) => others
    .filter((rect) => crossesRect(points[i], point, rect, BODY_CLEARANCE))
    .map((rect) => `${rect.what} between ${JSON.stringify(points[i])} and ${JSON.stringify(point)}`));
}

const isSame = (a, b) => Math.abs(a.x - b.x) < SAME_POINT && Math.abs(a.z - b.z) < SAME_POINT;
const hasRepeat = (path) => path.some((point, i) => i > 0 && isSame(point, path[i - 1]));
const catalogOf = (spots) => [
  ...[...spots.desks].map(([key, stop]) => [`desk ${key}`, stop]),
  ...[...spots.freeTime.values()].flat().map((spot) => [spot.id, spot]),
  ["exit", spots.exit],
];

describe("headquarters walkways", () => {
  for (let projectCount = 1; projectCount <= MAX_PROJECTS; projectCount += 1) {
    it(`never cut through a wall, a partition, an island or furniture with ${projectCount} project(s)`, () => {
      const layout = layoutHeadquarters(officeWith(projectCount));
      const { graph } = headquartersRoutes(layout);
      const obstacles = obstaclesOf(layout);
      const blocked = graph.edges.flatMap(([a, b]) => blockedSegments([graph.nodes[a], graph.nodes[b]], obstacles, {}));
      assert.deepEqual(blocked, []);
    });
  }
});

describe("headquarters routes", () => {
  for (let projectCount = 1; projectCount <= MAX_PROJECTS; projectCount += 1) {
    it(`takes everyone from the arrival to every desk and spot and back, around everything, with ${projectCount} project(s)`, () => {
      const layout = layoutHeadquarters(officeWith(projectCount));
      const spots = headquartersSpots(layout);
      const { routeFor } = headquartersRoutes(layout);
      const obstacles = obstaclesOf(layout);
      for (const [name, stop] of catalogOf(spots)) {
        for (const [from, to] of [[spots.arrival, stop], [stop, spots.arrival]]) {
          const path = routeFor(from, to);
          assert.ok(path.length > 0, `${name}: no way`);
          assert.ok(isSame(path.at(-1), to), `${name}: ends at ${JSON.stringify(path.at(-1))}`);
          assert.equal(hasRepeat([from, ...path]), false, name);
          assert.deepEqual(blockedSegments([from, ...path], obstacles, { from, to }), [], name);
        }
      }
    });
  }

  it("walks from a free time spot back to a desk on another island without cutting through anything", () => {
    const layout = layoutHeadquarters(officeWith(MAX_PROJECTS));
    const spots = headquartersSpots(layout);
    const { routeFor } = headquartersRoutes(layout);
    const desks = [...spots.desks.values()];
    for (const spot of [...spots.freeTime.values()].flat()) {
      for (const desk of [desks[0], desks.at(-1)]) {
        const path = routeFor(spot, desk);
        assert.ok(isSame(path.at(-1), desk));
        assert.deepEqual(blockedSegments([spot, ...path], obstaclesOf(layout), { from: spot, to: desk }), [], spot.id);
      }
    }
  });

  it("crosses between rows at the walkway right next to the islands, not at the far wall", () => {
    const layout = layoutHeadquarters(officeWith(8));
    const spots = headquartersSpots(layout);
    const deskOn = (column, row) => spots.desks.get(layout.islands.find((island) => island.column === column && island.row === row).seats[0].agent.key);
    const [from, to] = [deskOn(2, 1), deskOn(2, 0)];
    const path = [from, ...headquartersRoutes(layout).routeFor(from, to)];
    const length = path.slice(1).reduce((total, point, i) => total + Math.hypot(point.x - path[i].x, point.z - path[i].z), 0);
    assert.ok(length < 10, `walked ${length.toFixed(1)}`);
  });

  it("leaves a spot behind furniture through its own way in, walked backwards", () => {
    const layout = layoutHeadquarters(officeWith(4));
    const spots = headquartersSpots(layout);
    const [, middleSeat] = spots.freeTime.get("sofa");
    const path = headquartersRoutes(layout).routeFor(middleSeat, spots.arrival);
    assert.deepEqual(path.slice(0, 3), [{ x: 22.5, z: 2.6 }, { x: 24.4, z: 2.6 }, { x: 24.4, z: 5.2 }]);
  });

  it("brings someone caught halfway along the corridor onto the walkway before going on", () => {
    const layout = layoutHeadquarters(officeWith(4));
    const spots = headquartersSpots(layout);
    const halfway = { x: 12, z: 7.3 };
    const path = headquartersRoutes(layout).routeFor(halfway, spots.freeTime.get("arcade")[0]);
    assert.deepEqual(path[0], { x: 12, z: 7 });
    assert.deepEqual(blockedSegments([halfway, ...path], obstaclesOf(layout), {}), []);
  });

  it("joins the walkway on its own side of a wall, even when the one behind the wall is nearer", () => {
    const layout = layoutHeadquarters(officeWith(4));
    const inCorridorAgainstPantryWall = { x: 12, z: 6.05 };
    const path = headquartersRoutes(layout).routeFor(inCorridorAgainstPantryWall, { x: 12, z: 7 });
    assert.deepEqual(path, [{ x: 12, z: 7 }]);
  });
});

describe("segment crossing a rectangle", () => {
  const rect = { x: 1, z: 1, w: 2, d: 1 };

  it("sees a segment that goes through the rectangle or ends inside it", () => {
    assert.equal(crossesRect({ x: 0, z: 1.5 }, { x: 4, z: 1.5 }, rect), true);
    assert.equal(crossesRect({ x: 2, z: 0 }, { x: 2, z: 1.5 }, rect), true);
    assert.equal(crossesRect({ x: 0, z: 0 }, { x: 4, z: 3 }, rect), true);
  });

  it("ignores a segment that passes by or only touches an edge", () => {
    assert.equal(crossesRect({ x: 0, z: 0.5 }, { x: 4, z: 0.5 }, rect), false);
    assert.equal(crossesRect({ x: 0, z: 1 }, { x: 4, z: 1 }, rect), false);
    assert.equal(crossesRect({ x: 3.5, z: 0 }, { x: 3.5, z: 4 }, rect), false);
  });

  it("keeps a body's width away when asked to", () => {
    assert.equal(crossesRect({ x: 0, z: 0.95 }, { x: 4, z: 0.95 }, rect), false);
    assert.equal(crossesRect({ x: 0, z: 0.95 }, { x: 4, z: 0.95 }, rect, 0.1), true);
  });
});
