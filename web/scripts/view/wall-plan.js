const WALL_WIDTHS = {
  shelf: 2.2, clock: 1.0, board: 1.7, chalkboard: 1.7, window: 1.4, pegboard: 1.6, shutter: 2.0, porthole: 1.4, console: 1.6, neon: 1.7, arcade: 1.3, hedge: 2.2,
  ac: 1.2, tv: 1.7, corkboard: 1.7, frames: 1.5, filing: 1.3, copier: 1.2, copa: 1.6, cooler: 0.6,
};
const DEFAULT_WALL_WIDTH = 1.6;
const WALL_GAP = 0.35;
const FIT_TOLERANCE = 0.001;

export const wallWidthOf = (name) => WALL_WIDTHS[name] ?? DEFAULT_WALL_WIDTH;

// First fit, in the theme's order: an item that does not fit is skipped so a shorter one further down the list can take the space.
export function planWall(names, { start, end }) {
  const placed = [];
  let at = start;
  for (const name of names) {
    const width = wallWidthOf(name);
    if (at + width > end + FIT_TOLERANCE) continue;
    placed.push({ name, x: at, width });
    at += width + WALL_GAP;
  }
  return placed;
}
