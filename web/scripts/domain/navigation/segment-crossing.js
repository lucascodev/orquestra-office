const TOUCH = 1e-9;

export const containsPoint = ({ x, z, w, d }, point) => point.x > x && point.x < x + w && point.z > z && point.z < z + d;

// Liang-Barsky clipping against the rectangle grown by the clearance; a segment that only runs along an edge does not cross it.
export function crossesRect(from, to, { x, z, w, d }, clearance = 0) {
  const delta = { x: to.x - from.x, z: to.z - from.z };
  const limits = [
    [-delta.x, from.x - (x - clearance)],
    [delta.x, x + w + clearance - from.x],
    [-delta.z, from.z - (z - clearance)],
    [delta.z, z + d + clearance - from.z],
  ];
  let enter = 0;
  let leave = 1;
  for (const [direction, room] of limits) {
    if (Math.abs(direction) < TOUCH) {
      if (room <= TOUCH) return false;
      continue;
    }
    const at = room / direction;
    if (direction < 0) enter = Math.max(enter, at);
    else leave = Math.min(leave, at);
  }
  return leave - enter > TOUCH;
}
