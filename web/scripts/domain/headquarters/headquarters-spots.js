import { CONVIVENCE_SPOTS, FREE_TIME_SPOTS, RECEPTION_WATER_SPOT, RECEPTIONIST } from "../../data/headquarters-areas.js";
import { CHAIR_HIP, PUFF_HIP, SOFA_HIP, STANDING_HIP } from "../room/room-dimensions.js";
import { seatStop } from "../room/room-spots.js";
import { atDepth } from "./facade-offsets.js";

export const HEADQUARTERS_ACTIVITIES = ["coffee", "water", "window", "board", "meeting", "pingpong", "arcade", "puff", "sofa", "plant"];

const FACING = { front: 0, back: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 };
const POSTURES = {
  standing: { isSeat: false, hipY: STANDING_HIP },
  chair: { isSeat: true, hipY: CHAIR_HIP },
  sofa: { isSeat: true, hipY: SOFA_HIP },
  puff: { isSeat: true, hipY: PUFF_HIP },
};
const DEFAULT_POSTURE = "standing";

function stopOf({ x, z, faces, posture = DEFAULT_POSTURE, access = { x, z }, approach = [] }) {
  return { x, z, facing: FACING[faces], ...POSTURES[posture], isDesk: false, laneX: access.x, laneZ: access.z, approach };
}

const atFront = (spot, depth) => ({
  ...atDepth(spot, depth), access: atDepth(spot.access, depth), approach: (spot.approach ?? []).map((point) => atDepth(point, depth)),
});

const offsetBy = (slot) => ({ dx, dz, access, ...spot }) => ({
  ...spot, x: slot.x + dx, z: slot.z + dz, access: { x: slot.x + access.dx, z: slot.z + access.dz },
});

function placedSpots(layout) {
  const corners = layout.corners.flatMap((slot, corner) => CONVIVENCE_SPOTS[corner].map(offsetBy(slot)));
  const water = corners.length > 0 ? [] : [atFront(RECEPTION_WATER_SPOT, layout.size.D)];
  return [...FREE_TIME_SPOTS, ...corners, ...water];
}

function freeTimeSpots(layout) {
  const byActivity = new Map(HEADQUARTERS_ACTIVITIES.map((id) => [id, []]));
  const counts = new Map();
  for (const spot of placedSpots(layout)) {
    const name = `${spot.areaId}:${spot.activityId}`;
    const number = counts.get(name) ?? 0;
    counts.set(name, number + 1);
    byActivity.get(spot.activityId).push({ id: `${name}:${number}`, areaId: spot.areaId, activityId: spot.activityId, ...stopOf(spot) });
  }
  return byActivity;
}

function deskStops(layout) {
  const desks = new Map();
  for (const island of layout.islands) {
    for (const seat of island.seats) if (seat.agent) desks.set(seat.agent.key, seatStop(island, seat));
  }
  return desks;
}

export function headquartersSpots(layout) {
  return {
    desks: deskStops(layout),
    freeTime: freeTimeSpots(layout),
    exit: stopOf({ ...layout.yard.exit, faces: "front" }),
    arrival: stopOf({ ...layout.yard.arrival, faces: "back" }),
    receptionist: stopOf(RECEPTIONIST),
    activities: HEADQUARTERS_ACTIVITIES,
  };
}
