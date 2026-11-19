import { CORRIDOR_WALK_Z, MAIN_DOOR_PATH, RECEPTION_WALK_X, WALK_PATHS } from "../../data/headquarters-areas.js";
import { atDepth } from "../headquarters/facade-offsets.js";
import { headquartersSpots } from "../headquarters/headquarters-spots.js";
import { ISLAND_LANES_EAST_X, ISLAND_SPINES_X, islandLaneZs } from "../headquarters/island-grid.js";
import { containsPoint, crossesRect } from "./segment-crossing.js";
import { shortestWalk, walkGraphOf } from "./walk-graph.js";

const SAME_POINT = 0.01;

const centerX = (door) => door.x + door.w / 2;
const doorsBetween = (layout, from, to) => layout.doors.filter((door) => door.from === from && door.to === to);

// The walkways of the work area depend on the number of rows: two lanes per row, the spines between columns and the passages.
function workAreaPaths(layout) {
  const laneZs = islandLaneZs(layout.rows);
  const [firstLaneZ] = laneZs;
  const lanes = laneZs.map((z) => [{ x: ISLAND_SPINES_X[0], z }, { x: ISLAND_LANES_EAST_X, z }]);
  const spines = ISLAND_SPINES_X.map((x) => laneZs.map((z) => ({ x, z })));
  const fromCorridor = doorsBetween(layout, "corridor", "work").map((door) => [{ x: centerX(door), z: CORRIDOR_WALK_Z }, { x: centerX(door), z: firstLaneZ }]);
  const toReception = doorsBetween(layout, "work", "reception").flatMap((door) => laneZs
    .filter((z) => z > door.z && z < door.z + door.d)
    .map((z) => [{ x: ISLAND_LANES_EAST_X, z }, { x: RECEPTION_WALK_X, z }]));
  return [...lanes, ...spines, ...fromCorridor, ...toReception];
}

// Someone stopped halfway along a way in, behind a table, has no straight line to a walkway: each way in is a dead end of its own.
function waysIn(layout) {
  const { freeTime } = headquartersSpots(layout);
  return [...freeTime.values()].flat().map((stop) => [accessOf(stop), ...(stop.approach ?? []), { x: stop.x, z: stop.z }]);
}

function walkPaths(layout) {
  const at = (point) => atDepth(point, layout.size.D);
  const toTheYard = [...MAIN_DOOR_PATH.map(at), layout.yard.exit, layout.yard.arrival];
  return [...WALK_PATHS, ...workAreaPaths(layout), toTheYard, ...waysIn(layout)];
}

function obstaclesOf(layout) {
  return [...layout.walls, ...layout.islands.map((island) => island.desk), ...layout.decor.filter((item) => !item.y)];
}

const accessOf = (stop) => (stop.laneZ === undefined ? { x: stop.x, z: stop.z } : { x: stop.laneX ?? stop.x, z: stop.laneZ });
const isSamePoint = (a, b) => Math.abs(a.x - b.x) < SAME_POINT && Math.abs(a.z - b.z) < SAME_POINT;

function withoutRepeats(points, start) {
  const path = [];
  let last = start;
  for (const point of points) {
    if (isSamePoint(point, last)) continue;
    path.push({ x: point.x, z: point.z });
    last = point;
  }
  return path;
}

// The whole way: out of the origin's own way in, along the walkways, into the destination's way in.
export function headquartersRoutes(layout) {
  const graph = walkGraphOf(walkPaths(layout));
  const obstacles = obstaclesOf(layout);
  const isClear = (from, to) => obstacles.every((rect) => containsPoint(rect, from) || !crossesRect(from, to, rect));

  function routeFor(from, to) {
    const walk = shortestWalk(graph, accessOf(from), accessOf(to), isClear);
    if (walk.length === 0) return [];
    const outOfOrigin = [...(from.approach ?? [])].reverse();
    const points = [...outOfOrigin, accessOf(from), ...walk, accessOf(to), ...(to.approach ?? []), { x: to.x, z: to.z }];
    return withoutRepeats(points, from);
  }

  return { graph, routeFor };
}
