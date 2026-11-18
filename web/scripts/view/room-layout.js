import { planWall } from "./wall-plan.js";

export const LANE_OFFSET = 1.15;
const SIDE_CORRIDOR_X = 0.7;
const SEAT_W = 1.25;
const DESK_D = 1.2;
const ROW_STEP = 3.5;
const FIRST_DESK_Z = 2.2;
const LEFT_X = 1.6;
const POD_GAP = 1.4;
const AISLE = 0.6;
const COMMONS_W = 3.4;
const MIN_W = 12;
const MIN_D = 7;
const MIN_POD_W = 1.6;
const ISLAND_SEATS = 6;
const VACANT_POD_SEATS = [6, 4, 2];

const DOOR_X = 0.9;
const DOOR_W = 1.1;
const DOOR_CLEARANCE = 0.5;
const MEETING_Z = 2.0;
const MEETING_ROOM_D = 3.5;
const PARTITION_T = 0.1;
const PARTITION_STUB_W = 0.9;
const LOUNGE_FROM_FRONT = 2.6;
const SPOT_FROM_FRONT = 0.95;
const SPOT_W = 1.4;
const SPOT_STEP = 2.6;
const ROOMY_D = 10;
const FILLER_PROP = "plant";
const PLANT_PROPS = new Set(["plant", "bigPlant"]);
const PLANT_STRIP_DEPTH = 1.2;
const WATERING_FROM_FRONT = 1.3;
const MEETING_DOORWAY_CLEARANCE = 0.45;

function teamsOf(project) {
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

const podWidth = (seatCount) => Math.max(MIN_POD_W, Math.ceil(seatCount / 2) * SEAT_W + 0.2);
const deskCapacity = (occupants) => Math.max(2, Math.ceil(occupants / 2) * 2);

function podAt(x, z, occupants, capacity) {
  const seats = Array.from({ length: capacity }, (_, i) => ({
    agent: occupants[i]?.agent ?? null,
    role: occupants[i]?.role ?? null,
    cx: x + 0.1 + SEAT_W / 2 + Math.floor(i / 2) * SEAT_W,
    direction: i % 2 === 0 ? 1 : -1,
  }));
  return { desk: { x, z, w: podWidth(capacity), d: DESK_D }, seats };
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

function vacantPods(fromX, z, rightLimit) {
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

function lanesOf(commonsX, rowCount, loungeZ) {
  const rowLanes = Array.from({ length: rowCount }, (_, row) => FIRST_DESK_Z + row * ROW_STEP)
    .flatMap((deskZ) => [deskZ - LANE_OFFSET, deskZ + DESK_D + LANE_OFFSET]);
  const meetingLaneZ = MEETING_ROOM_D + MEETING_DOORWAY_CLEARANCE;
  const laneZs = [...new Set([...rowLanes, meetingLaneZ, loungeZ + 0.92].map((z) => Math.round(z * 100) / 100))];
  return {
    left: SIDE_CORRIDOR_X, right: commonsX - AISLE / 2, laneZs, meetingLaneZ,
    topLaneZ: FIRST_DESK_Z - LANE_OFFSET,
    bottomLaneZ: FIRST_DESK_Z + (rowCount - 1) * ROW_STEP + DESK_D + LANE_OFFSET,
  };
}

function plantsToWater(corners, spots, D) {
  const frontPlants = [...corners, ...spots].filter((item) => PLANT_PROPS.has(item.prop) && item.z > D - PLANT_STRIP_DEPTH);
  return frontPlants.map((item) => ({ x: item.x + 0.3, z: D - WATERING_FROM_FRONT }));
}

function zonesOf(W, D, rowCount, theme) {
  const commonsX = W - COMMONS_W;
  const centerX = commonsX + COMMONS_W / 2;
  const loungeZ = D - LOUNGE_FROM_FRONT;
  const backWall = { start: DOOR_X + DOOR_W + DOOR_CLEARANCE, end: commonsX - 0.1 };

  const spotPoints = [];
  for (let x = LEFT_X + 0.6; x + SPOT_W < commonsX; x += SPOT_STEP) spotPoints.push({ x, z: D - SPOT_FROM_FRONT });
  if (D >= ROOMY_D) spotPoints.push({ x: centerX - 0.5, z: (MEETING_ROOM_D + loungeZ) / 2 });
  const spots = spotPoints.map((point, i) => ({ ...point, prop: theme.floorProps[i] ?? FILLER_PROP }));
  const cornerPoints = [{ x: W - 0.75, z: 0.15 }, { x: W - 0.8, z: loungeZ - 0.1 }, { x: 0.2, z: D - 0.9 }];
  const corners = cornerPoints.map((point, i) => ({ ...point, prop: theme.corner[i % theme.corner.length] }));

  return {
    door: { x: DOOR_X, width: DOOR_W },
    coatRack: { x: 0.25, z: 0.2 },
    wallItems: planWall(theme.backWall, backWall),
    lanes: lanesOf(commonsX, rowCount, loungeZ),
    meeting: { x: centerX, z: MEETING_Z },
    lounge: { x: centerX, z: loungeZ },
    partitions: [
      { x: commonsX, z: 0, w: PARTITION_T, d: MEETING_ROOM_D + PARTITION_T },
      { x: commonsX, z: MEETING_ROOM_D, w: PARTITION_STUB_W, d: PARTITION_T },
      { x: W - PARTITION_STUB_W, z: MEETING_ROOM_D, w: PARTITION_STUB_W, d: PARTITION_T },
    ],
    corners,
    spots,
    plants: plantsToWater(corners, spots, D),
  };
}

export function layoutRoom(project, theme) {
  const rows = rowsOf([...islandsOf(teamsOf(project)), ...reservedIslands(project)]).map((islands, i) => placeRow(islands, FIRST_DESK_Z + i * ROW_STEP));
  const podsEnd = Math.max(...rows.map((row) => row.nextX - POD_GAP));
  const W = Math.max(MIN_W, Math.ceil(podsEnd + AISLE + COMMONS_W));
  const rightLimit = W - COMMONS_W - AISLE + 0.01;
  const pods = rows.flatMap((row) => [...row.pods, ...vacantPods(row.nextX, row.pods[0]?.desk.z ?? FIRST_DESK_Z, rightLimit)]);
  const lastDeskZ = FIRST_DESK_Z + (rows.length - 1) * ROW_STEP;
  const D = Math.max(MIN_D, Math.ceil(lastDeskZ + DESK_D + 2.2));
  return { W, D, pods, zones: zonesOf(W, D, rows.length, theme) };
}
