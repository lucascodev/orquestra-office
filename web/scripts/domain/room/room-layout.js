import { DESK_D, deskRows, FIRST_DESK_Z, POD_GAP, ROW_STEP, vacantPods } from "./desk-islands.js";
import { AISLE, COMMONS_W, zonesOf } from "./room-zones.js";

const MIN_W = 12;
const MIN_D = 7;

export function layoutRoom(project, theme) {
  const rows = deskRows(project);
  const podsEnd = Math.max(...rows.map((row) => row.nextX - POD_GAP));
  const W = Math.max(MIN_W, Math.ceil(podsEnd + AISLE + COMMONS_W));
  const rightLimit = W - COMMONS_W - AISLE + 0.01;
  const pods = rows.flatMap((row) => [...row.pods, ...vacantPods(row.nextX, row.pods[0]?.desk.z ?? FIRST_DESK_Z, rightLimit)]);
  const lastDeskZ = FIRST_DESK_Z + (rows.length - 1) * ROW_STEP;
  const D = Math.max(MIN_D, Math.ceil(lastDeskZ + DESK_D + 2.2));
  return { W, D, pods, zones: zonesOf(W, D, rows.length, theme) };
}
