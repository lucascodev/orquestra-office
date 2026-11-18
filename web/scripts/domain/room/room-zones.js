import { DESK_D, FIRST_DESK_Z, LANE_OFFSET, LEFT_X, ROW_STEP } from "./desk-islands.js";
import { planWall } from "./wall-plan.js";

export const AISLE = 0.6;
export const COMMONS_W = 3.4;
const SIDE_CORRIDOR_X = 0.7;
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

export function zonesOf(W, D, rowCount, theme) {
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
