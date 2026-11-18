import {
  AT_DESK_WITH_NOTHING_TO_DO, busyReactionOf, freeTimePreferences, freeTimeReaction, HANDING_OVER, isHandingOver, isWindingDown, JUST_FINISHED,
} from "./agent-reactions.js";
import { LANE_OFFSET } from "./room-layout.js";

const SEAT_INSET = 0.4;
const CHAIR_HIP = 0.54;
const SOFA_HIP = 0.47;
const STANDING_HIP = 0.91;
const COFFEE_SPOTS = 3;
const FACING_CAMERA = 0;
const FACING_WALL = Math.PI;
const FACING_RIGHT = Math.PI / 2;
const FACING_LEFT = -Math.PI / 2;
const MEETING_DOOR_OFFSET = 0.55;
const MEETING_AISLE_OFFSET = 1.45;
const MEETING_SEAT_OFFSET = 0.9;
const MEETING_SEAT_ROW = -0.45;
const BESIDE_SEAT_OFFSET = 0.62;

const standing = (x, z, laneZ, facing, extra = {}) => ({ x, z, laneZ, facing, isSeat: false, hipY: STANDING_HIP, spine: null, ...extra });

export function seatStop(pod, seat) {
  const { desk } = pod;
  const isNorthSide = seat.direction === 1;
  return {
    x: seat.cx,
    z: isNorthSide ? desk.z - SEAT_INSET : desk.z + desk.d + SEAT_INSET,
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
    x: x + side * MEETING_SEAT_OFFSET, z: z + MEETING_SEAT_ROW, laneZ: meetingLaneZ, facing: side === -1 ? FACING_RIGHT : FACING_LEFT,
    isSeat: true, hipY: CHAIR_HIP, ...through(side, z + MEETING_SEAT_ROW),
  });
  return [["board", standing(x + 0.45, 0.82, meetingLaneZ, FACING_WALL, through(1, 0.95))], ["meeting", chair(-1)], ["meeting", chair(1)]];
}

function loungeStops({ zones }) {
  const { x, z } = zones.lounge;
  const sofaSeat = (seatX) => ["sofa", { x: seatX, z: z + 0.42, laneZ: z + 0.92, facing: FACING_CAMERA, isSeat: true, hipY: SOFA_HIP, spine: "right" }];
  return [sofaSeat(x - 0.42), sofaSeat(x + 0.42)];
}

function plantStops({ zones }) {
  return zones.plants.map((plant) => ["plant", standing(plant.x, plant.z, zones.lanes.bottomLaneZ, FACING_CAMERA)]);
}

function freeTimeSpots(layout) {
  const { zones } = layout;
  const wall = zones.wallItems.flatMap((item) => WALL_SPOTS[item.name]?.(item, zones.lanes.topLaneZ) ?? []);
  const spots = {};
  for (const [activity, stop] of [...wall, ...meetingStops(layout), ...loungeStops(layout), ...plantStops(layout)]) {
    spots[activity] = [...(spots[activity] ?? []), stop];
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

// Shared spots go out in key order, so the same people keep the same spot between redraws.
export function assignPlaces(agents, now, layout, freeSince) {
  const desks = seatStops(layout);
  const free = freeTimeSpots(layout);
  const exit = exitStop(layout);
  const places = new Map();
  for (const agent of [...agents].sort((a, b) => a.key.localeCompare(b.key))) {
    const desk = desks.get(agent.key);
    const busy = busyReactionOf(agent);
    if (busy) {
      const isLeaving = busy === "leaving";
      places.set(agent.key, { stop: isLeaving ? exit : desk, reaction: busy, isUrgent: !isLeaving });
      continue;
    }
    const since = freeSince.get(agent.key) ?? agent.updatedAt;
    if (isWindingDown(agent, now, since)) {
      places.set(agent.key, { stop: desk, reaction: JUST_FINISHED, isUrgent: false });
      continue;
    }
    const activity = freeTimePreferences(agent, now, since).find((id) => free[id]?.length > 0);
    places.set(agent.key, activity
      ? { stop: free[activity].shift(), reaction: freeTimeReaction(activity), isUrgent: false, isFreeTime: true }
      : { stop: desk, reaction: AT_DESK_WITH_NOTHING_TO_DO, isUrgent: false });
  }
  for (const agent of agents) {
    const handoff = isHandingOver(agent, now) ? handoffPlace(places.get(agent.parentKey), desks.get(agent.key)) : null;
    if (handoff) places.set(agent.key, handoff);
  }
  return places;
}

function handoffPlace(parentPlace, ownDesk) {
  const parentDesk = parentPlace?.stop;
  if (!parentDesk?.isDesk) return null;
  const side = (ownDesk?.x ?? parentDesk.x) >= parentDesk.x ? 1 : -1;
  const stop = standing(parentDesk.x + side * BESIDE_SEAT_OFFSET, parentDesk.z, parentDesk.laneZ, side === 1 ? FACING_LEFT : FACING_RIGHT);
  return { stop, reaction: HANDING_OVER, isUrgent: false };
}
