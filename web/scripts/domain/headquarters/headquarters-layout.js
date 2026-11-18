import { AREAS, CONVIVENCE_CORNERS, DOORS, FURNITURE, HEADQUARTERS_WIDTH, RECEPTION_WATER_COOLER, WALLS } from "../../data/headquarters-areas.js";
import { NEUTRAL_ISLAND_THEME } from "../../data/headquarters-palette.js";
import { MAP_MARGIN, YARD, YARD_DEPTH } from "../../data/headquarters-yard.js";
import { themeById } from "../../data/themes.js";
import { podAt } from "../room/desk-islands.js";
import { atDepth } from "./facade-offsets.js";
import { convivenceSlots, depthFor, FREE_ISLANDS, ISLAND_POD, ISLAND_RUG, ISLAND_SEATS, islandSlot, rowCountFor } from "./island-grid.js";
import { projectIslands } from "./project-islands.js";

const CORNER_AREA = "work";

function islandAt(index, owner) {
  const slot = islandSlot(index);
  const { desk, seats } = podAt(slot.x, slot.z, owner?.occupants ?? [], ISLAND_SEATS, ISLAND_POD);
  return {
    ...slot,
    projectKey: owner?.project.key ?? null,
    projectName: owner?.project.name ?? null,
    theme: owner ? themeById(owner.project.template) : NEUTRAL_ISLAND_THEME,
    desk,
    seats,
    rug: { x: slot.x + ISLAND_RUG.dx, z: slot.z + ISLAND_RUG.dz, w: ISLAND_RUG.w, d: ISLAND_RUG.d },
  };
}

function cornerDecor(slots) {
  return slots.flatMap((slot, corner) => CONVIVENCE_CORNERS[corner].map(({ dx, dz, ...item }, part) => ({
    id: `corner-${slot.index}-${part}`, areaId: CORNER_AREA, ...item, x: slot.x + dx, z: slot.z + dz,
  })));
}

function yardAt(depth) {
  const at = (item) => atDepth(item, depth);
  return {
    path: at(YARD.path),
    parking: at(YARD.parking),
    parkingStripes: YARD.parkingStripes.map(at),
    cars: YARD.cars.map(at),
    sign: { base: at(YARD.sign.base), block: at(YARD.sign.block), text: YARD.sign.text },
    flagpole: at(YARD.flagpole),
    trees: YARD.trees.map(at),
    benches: YARD.benches.map(at),
    arrival: at(YARD.arrival),
    exit: at(YARD.exit),
  };
}

export function layoutHeadquarters(projects) {
  const owned = projectIslands(projects);
  const rows = rowCountFor(owned.length);
  const depth = depthFor(rows);
  const at = (item) => atDepth(item, depth);
  const corners = convivenceSlots(rows, owned.length, CONVIVENCE_CORNERS.length);
  const receptionWater = corners.length > 0 ? [] : [RECEPTION_WATER_COOLER];
  return {
    size: { W: HEADQUARTERS_WIDTH, D: depth },
    rows,
    bounds: { minX: -MAP_MARGIN, maxX: HEADQUARTERS_WIDTH + MAP_MARGIN, minZ: -MAP_MARGIN, maxZ: depth + YARD_DEPTH },
    areas: AREAS.map(at),
    walls: WALLS.map(at),
    doors: DOORS.map(at),
    decor: [...[...FURNITURE, ...receptionWater].map(at), ...cornerDecor(corners)],
    islands: Array.from({ length: owned.length + FREE_ISLANDS }, (_, index) => islandAt(index, owned[index])),
    corners,
    yard: yardAt(depth),
  };
}
