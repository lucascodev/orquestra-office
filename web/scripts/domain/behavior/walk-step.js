export function walkStep({ position, path, distance }) {
  let { x, z } = position;
  let budget = distance;
  let heading = null;
  let reached = 0;
  while (budget > 0 && reached < path.length) {
    const next = path[reached];
    const dx = next.x - x;
    const dz = next.z - z;
    const gap = Math.hypot(dx, dz);
    if (gap <= budget) {
      x = next.x;
      z = next.z;
      reached += 1;
      budget -= gap;
    } else {
      x += (dx / gap) * budget;
      z += (dz / gap) * budget;
      heading = Math.atan2(dx, dz);
      budget = 0;
    }
  }
  return { position: { x, z }, path: path.slice(reached), heading };
}
