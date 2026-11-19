export const LANE_OFFSET = 1.15;

export function teamsOf(project) {
  const agents = Object.values(project.agents);
  const mains = agents.filter((a) => a.kind !== "subagent").sort((a, b) => a.startedAt - b.startedAt);
  return mains.map((main) => [main, ...agents.filter((a) => a.parentKey === main.key).sort((a, b) => a.startedAt - b.startedAt)]);
}

const podWidth = (seatCount, shape) => Math.max(shape.minWidth, Math.ceil(seatCount / 2) * shape.seatWidth + 2 * shape.sideMargin);

export function podAt(x, z, occupants, capacity, shape) {
  const seats = Array.from({ length: capacity }, (_, i) => ({
    agent: occupants[i]?.agent ?? null,
    role: occupants[i]?.role ?? null,
    cx: x + shape.sideMargin + shape.seatWidth / 2 + Math.floor(i / 2) * shape.seatWidth,
    direction: i % 2 === 0 ? 1 : -1,
  }));
  return { desk: { x, z, w: podWidth(capacity, shape), d: shape.depth }, seats };
}
