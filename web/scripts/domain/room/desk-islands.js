export const LANE_OFFSET = 1.15;
export const DESK_D = 1.2;
export const ROW_STEP = 3.5;
export const FIRST_DESK_Z = 2.2;
export const LEFT_X = 1.6;
export const POD_GAP = 1.4;
const SEAT_W = 1.25;
const MIN_POD_W = 1.6;
const ISLAND_SEATS = 6;
const VACANT_POD_SEATS = [6, 4, 2];
const POD_SIDE_MARGIN = 0.1;
const ROOM_POD = { seatWidth: SEAT_W, sideMargin: POD_SIDE_MARGIN, depth: DESK_D, minWidth: MIN_POD_W };

export function teamsOf(project) {
  const agents = Object.values(project.agents);
  const mains = agents.filter((a) => a.kind !== "subagent").sort((a, b) => a.startedAt - b.startedAt);
  return mains.map((main) => [main, ...agents.filter((a) => a.parentKey === main.key).sort((a, b) => a.startedAt - b.startedAt)]);
}

function islandsOf(teams) {
  const islands = [];
  for (const team of teams) {
    const last = islands[islands.length - 1];
    const members = team.map((agent) => ({ agent }));
    if (last && last.length + members.length <= ISLAND_SEATS) last.push(...members);
    else islands.push(members);
  }
  return islands;
}

// Roles the project defines in .claude/agents that nobody is playing right now: they keep a named, empty desk.
function reservedIslands(project) {
  const present = new Set(Object.values(project.agents).filter((agent) => !agent.endedAt).map((agent) => agent.label));
  const reserved = (project.team ?? []).filter((role) => !present.has(role)).map((role) => ({ role }));
  return Array.from({ length: Math.ceil(reserved.length / ISLAND_SEATS) }, (_, i) => reserved.slice(i * ISLAND_SEATS, (i + 1) * ISLAND_SEATS));
}

function rowsOf(islands) {
  const rowCount = Math.max(1, Math.ceil(Math.sqrt(islands.length / 2)));
  const perRow = Math.max(1, Math.ceil(islands.length / rowCount));
  return Array.from({ length: rowCount }, (_, i) => islands.slice(i * perRow, (i + 1) * perRow));
}

const podWidth = (seatCount, shape = ROOM_POD) => Math.max(shape.minWidth, Math.ceil(seatCount / 2) * shape.seatWidth + 2 * shape.sideMargin);
const deskCapacity = (occupants) => Math.max(2, Math.ceil(occupants / 2) * 2);

export function podAt(x, z, occupants, capacity, shape = ROOM_POD) {
  const seats = Array.from({ length: capacity }, (_, i) => ({
    agent: occupants[i]?.agent ?? null,
    role: occupants[i]?.role ?? null,
    cx: x + shape.sideMargin + shape.seatWidth / 2 + Math.floor(i / 2) * shape.seatWidth,
    direction: i % 2 === 0 ? 1 : -1,
  }));
  return { desk: { x, z, w: podWidth(capacity, shape), d: shape.depth }, seats };
}

function placeRow(islands, z) {
  const pods = [];
  let x = LEFT_X;
  for (const occupants of islands) {
    const pod = podAt(x, z, occupants, deskCapacity(occupants.length));
    pods.push(pod);
    x += pod.desk.w + POD_GAP;
  }
  return { pods, nextX: x };
}

export function deskRows(project) {
  return rowsOf([...islandsOf(teamsOf(project)), ...reservedIslands(project)]).map((islands, i) => placeRow(islands, FIRST_DESK_Z + i * ROW_STEP));
}

export function vacantPods(fromX, z, rightLimit) {
  const pods = [];
  let x = fromX;
  for (const capacity of VACANT_POD_SEATS) {
    while (x + podWidth(capacity) <= rightLimit) {
      pods.push(podAt(x, z, [], capacity));
      x += podWidth(capacity) + POD_GAP;
    }
  }
  return pods;
}
