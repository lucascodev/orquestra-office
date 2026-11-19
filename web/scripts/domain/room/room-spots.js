import { LANE_OFFSET } from "./desk-islands.js";
import { CHAIR_HIP, DESK_SEAT_INSET, STANDING_HIP } from "./room-dimensions.js";

const FACING_CAMERA = 0;
const FACING_WALL = Math.PI;
const FACING_RIGHT = Math.PI / 2;
const FACING_LEFT = -Math.PI / 2;
const BESIDE_SEAT_OFFSET = 0.62;

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

export function besideDeskStop(desk, side) {
  return {
    x: desk.x + side * BESIDE_SEAT_OFFSET, z: desk.z, laneZ: desk.laneZ, facing: side === 1 ? FACING_LEFT : FACING_RIGHT,
    isSeat: false, hipY: STANDING_HIP, spine: null,
  };
}
