import { LANE_OFFSET } from "./desk-islands.js";
import {
  CHAIR_HIP, DESK_SEAT_INSET, MEETING_SEAT_ROWS_Z, MEETING_SEAT_X, SOFA_HIP, SOFA_SEAT_Z, SOFA_SEATS_X, STANDING_HIP,
} from "./room-dimensions.js";

const COFFEE_SPOTS = 3;
const ROOM_ACTIVITIES = ["coffee", "water", "window", "books", "filing", "copier", "board", "meeting", "sofa", "plant"];
const FACING_CAMERA = 0;
const FACING_WALL = Math.PI;
const FACING_RIGHT = Math.PI / 2;
const FACING_LEFT = -Math.PI / 2;
const MEETING_DOOR_OFFSET = 0.55;
const MEETING_AISLE_OFFSET = 1.45;
const [MEETING_SEAT_ROW] = MEETING_SEAT_ROWS_Z;
const BESIDE_SEAT_OFFSET = 0.62;

const standing = (x, z, laneZ, facing, extra = {}) => ({ x, z, laneZ, facing, isSeat: false, hipY: STANDING_HIP, spine: null, ...extra });

export function seatStop(pod, seat) {
  const { desk } = pod;
  const isNorthSide = seat.direction === 1;
  return {
    x: seat.cx,
    z: isNorthSide ? desk.z - DESK_SEAT_INSET : desk.z + desk.d + DESK_SEAT_INSET,
    laneZ: isNorthSide ? desk.z - LANE_OFFSET : desk.z + desk.d + LANE_OFFSET,
    facing: isNorthSide ? FACING_CAMERA : FACING_WALL,
    isSeat: true, isDesk: true, hipY: CHAIR_HIP, spine: null,
  };
}

const WALL_SPOTS = {
  copa: (item, laneZ) => Array.from({ length: COFFEE_SPOTS }, (_, i) => ["coffee", standing(item.x + 0.3 + i * 0.5, laneZ, laneZ, FACING_CAMERA)]),
  cooler: (item, laneZ) => [["water", standing(item.x + item.width / 2, laneZ, laneZ, FACING_CAMERA)]],
  window: (item, laneZ) => [["window", standing(item.x + item.width / 2, 0.72, laneZ, FACING_WALL)]],
  shelf: (item, laneZ) => [["books", standing(item.x + item.width / 2, 0.9, laneZ, FACING_WALL)]],
  filing: (item, laneZ) => [["filing", standing(item.x + item.width / 2, 0.98, laneZ, FACING_WALL)]],
  copier: (item, laneZ) => [["copier", standing(item.x + 0.72, laneZ, laneZ, FACING_WALL)]],
};

// The meeting room is walled off: people go in through its doorway and around the chairs, never through the partition.
function meetingStops({ zones }) {
  const { x, z } = zones.meeting;
  const { meetingLaneZ } = zones.lanes;
  const insideZ = meetingLaneZ - 0.8;
  const through = (side, lastZ) => ({
    laneX: x + side * MEETING_DOOR_OFFSET, spine: "right",
    approach: [{ x: x + side * MEETING_DOOR_OFFSET, z: insideZ }, { x: x + side * MEETING_AISLE_OFFSET, z: insideZ }, { x: x + side * MEETING_AISLE_OFFSET, z: lastZ }],
  });
  const chair = (side) => ({
    x: x + side * MEETING_SEAT_X, z: z + MEETING_SEAT_ROW, laneZ: meetingLaneZ, facing: side === -1 ? FACING_RIGHT : FACING_LEFT,
    isSeat: true, hipY: CHAIR_HIP, ...through(side, z + MEETING_SEAT_ROW),
  });
  return [["board", standing(x + 0.45, 0.82, meetingLaneZ, FACING_WALL, through(1, 0.95))], ["meeting", chair(-1)], ["meeting", chair(1)]];
}

function loungeStops({ zones }) {
  const { x, z } = zones.lounge;
  const sofaSeat = (seatX) => ["sofa", { x: seatX, z: z + SOFA_SEAT_Z, laneZ: z + 0.92, facing: FACING_CAMERA, isSeat: true, hipY: SOFA_HIP, spine: "right" }];
  return SOFA_SEATS_X.map((offset) => sofaSeat(x + offset));
}

function plantStops({ zones }) {
  return zones.plants.map((plant) => ["plant", standing(plant.x, plant.z, zones.lanes.bottomLaneZ, FACING_CAMERA)]);
}

function freeTimeSpots(layout) {
  const { zones } = layout;
  const wall = zones.wallItems.flatMap((item) => WALL_SPOTS[item.name]?.(item, zones.lanes.topLaneZ) ?? []);
  const spots = new Map();
  for (const [activityId, stop] of [...wall, ...meetingStops(layout), ...loungeStops(layout), ...plantStops(layout)]) {
    const listed = spots.get(activityId) ?? [];
    spots.set(activityId, [...listed, { id: `${activityId}:${listed.length}`, activityId, ...stop }]);
  }
  return spots;
}

export function exitStop({ zones }) {
  return standing(zones.door.x + zones.door.width / 2, 0.72, zones.lanes.topLaneZ, FACING_WALL);
}

function seatStops(layout) {
  const stops = new Map();
  for (const pod of layout.pods) {
    for (const seat of pod.seats) if (seat.agent) stops.set(seat.agent.key, seatStop(pod, seat));
  }
  return stops;
}

export function besideDeskStop(desk, side) {
  return standing(desk.x + side * BESIDE_SEAT_OFFSET, desk.z, desk.laneZ, side === 1 ? FACING_LEFT : FACING_RIGHT);
}

export function roomSpots(layout) {
  return { desks: seatStops(layout), freeTime: freeTimeSpots(layout), exit: exitStop(layout), activities: ROOM_ACTIVITIES };
}
