const SAME_POINT = 0.01;

const isSamePoint = (a, b) => Math.abs(a.x - b.x) < SAME_POINT && Math.abs(a.z - b.z) < SAME_POINT;

function spineFor(from, to, lanes) {
  const preferred = to.spine ?? from.spine;
  if (preferred) return lanes[preferred];
  const fromX = from.laneX ?? from.x;
  const toX = to.laneX ?? to.x;
  const detour = (spineX) => Math.abs(fromX - spineX) + Math.abs(toX - spineX);
  return detour(lanes.left) <= detour(lanes.right) ? lanes.left : lanes.right;
}

// A spot behind an obstacle lists its own way in ("approach"), walked backwards on the way out.
export function routeBetween(from, to, lanes) {
  const points = [...[...(from.approach ?? [])].reverse(), { x: from.laneX ?? from.x, z: from.laneZ }];
  if (Math.abs(from.laneZ - to.laneZ) > SAME_POINT) {
    const spineX = spineFor(from, to, lanes);
    points.push({ x: spineX, z: from.laneZ }, { x: spineX, z: to.laneZ });
  }
  points.push({ x: to.laneX ?? to.x, z: to.laneZ }, ...(to.approach ?? []), { x: to.x, z: to.z });

  const path = [];
  let last = { x: from.x, z: from.z };
  for (const point of points) {
    if (isSamePoint(point, last)) continue;
    path.push(point);
    last = point;
  }
  return path;
}

export function nearestLaneZ(z, laneZs) {
  return laneZs.reduce((best, laneZ) => (Math.abs(laneZ - z) < Math.abs(best - z) ? laneZ : best), laneZs[0]);
}

// A loose point, where someone was caught mid-walk or last seen, has no lane of its own and joins the nearest one.
export function routeWithin(lanes) {
  const onLane = (from) => (from.laneZ === undefined ? { ...from, laneZ: nearestLaneZ(from.z, lanes.laneZs), spine: null } : from);
  return (from, to) => routeBetween(onLane(from), to, lanes);
}
