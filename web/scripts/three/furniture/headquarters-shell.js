import { HEADQUARTERS_PALETTE } from "../../data/headquarters-palette.js";
import { box, shade, THREE, tiledSlab } from "../kit.js";

const FLOOR_THICKNESS = 0.04;
const PLINTH_BOTTOM = -0.12;
const CELLS_PER_UNIT = 2;
const CAP_HEIGHT = 0.04;
const CAP_OVERHANG = 0.02;
const BASEBOARD_HEIGHT = 0.1;
const BASEBOARD_DEPTH = 0.03;
const MULLION_WIDTH = 0.06;
const RAIL_HEIGHT = 0.05;
const POST_WIDTH = 0.1;
const POST_RISE = 0.12;
const MAIN_DOOR_POST_HEIGHT = 2.2;
const DOORMAT_DEPTH = 0.9;
const DOORMAT_INSET = 0.25;
const DOORMAT_HEIGHT = 0.012;
const DOORMAT = "#4a4f5c";
const YARD = "yard";
const ROOMS_BEHIND_LOW_WALLS = new Set(["work", "reception"]);
const GLASS_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);

const FLOOR_PATTERNS = { meeting: "grid", pantry: "grid", games: "speckle", lounge: "plank", corridor: "plain", work: "grid", reception: "plank" };
const FLOOR_LINE_SHADE = -0.07;
const WALL_LINE_SHADE = -0.05;

function floors(parent, areas) {
  for (const area of areas) {
    const base = HEADQUARTERS_PALETTE.floors[area.id];
    const surface = { pattern: FLOOR_PATTERNS[area.id], base, line: shade(base, FLOOR_LINE_SHADE) };
    tiledSlab(parent, [area.w, FLOOR_THICKNESS, area.d], [area.x, -FLOOR_THICKNESS, area.z], surface, area.w, area.d);
  }
}

function plinth(parent, { W, D }) {
  box(parent, [W, -PLINTH_BOTTOM - FLOOR_THICKNESS, D], [0, PLINTH_BOTTOM, 0], HEADQUARTERS_PALETTE.slab, { shadow: false });
}

function cap(parent, { x, z, w, d }, top, color) {
  box(parent, [w + CAP_OVERHANG * 2, CAP_HEIGHT, d + CAP_OVERHANG * 2], [x - CAP_OVERHANG, top, z - CAP_OVERHANG], shade(color, -0.22), { shadow: false });
}

function fullWall(parent, wall) {
  const { wall: color } = HEADQUARTERS_PALETTE;
  const surface = { pattern: "brick", base: color, line: shade(color, WALL_LINE_SHADE) };
  const along = Math.max(wall.w, wall.d);
  tiledSlab(parent, [wall.w, wall.height, wall.d], [wall.x, 0, wall.z], surface, along * CELLS_PER_UNIT, wall.height * CELLS_PER_UNIT);
  cap(parent, wall, wall.height, color);
  const isAlongX = wall.w > wall.d;
  const baseboard = isAlongX ? [wall.w, BASEBOARD_HEIGHT, BASEBOARD_DEPTH] : [BASEBOARD_DEPTH, BASEBOARD_HEIGHT, wall.d];
  const at = isAlongX ? [wall.x, 0, wall.z + wall.d] : [wall.x + wall.w, 0, wall.z];
  box(parent, baseboard, at, shade(color, -0.3), { shadow: false });
}

function lowWall(parent, wall) {
  const { wall: color } = HEADQUARTERS_PALETTE;
  box(parent, [wall.w, wall.height, wall.d], [wall.x, 0, wall.z], color);
  cap(parent, wall, wall.height, color);
}

function glassPane(parent, [w, h, d], [x, y, z]) {
  const { glass, glassOpacity } = HEADQUARTERS_PALETTE;
  const material = new THREE.MeshLambertMaterial({ color: glass, transparent: true, opacity: glassOpacity, depthWrite: false });
  const pane = new THREE.Mesh(GLASS_GEOMETRY, material);
  pane.scale.set(w, h, d);
  pane.position.set(x + w / 2, y + h / 2, z + d / 2);
  parent.add(pane);
}

function facade(parent, wall) {
  lowWall(parent, wall);
  const frame = shade(HEADQUARTERS_PALETTE.wall, -0.35);
  const paneDepth = wall.d / 2;
  glassPane(parent, [wall.w, wall.glassTop - wall.height, paneDepth], [wall.x, wall.height, wall.z + paneDepth / 2]);
  for (const x of [wall.x, wall.x + wall.w - MULLION_WIDTH]) {
    box(parent, [MULLION_WIDTH, wall.glassTop - wall.height, wall.d], [x, wall.height, wall.z], frame);
  }
  box(parent, [wall.w, RAIL_HEIGHT, wall.d], [wall.x, wall.glassTop, wall.z], frame);
}

const WALL_BUILDERS = { wall: fullWall, partition: lowWall, lowWall, facade };

function doorPosts(parent, door, height) {
  const color = shade(HEADQUARTERS_PALETTE.wall, -0.35);
  const isAlongX = door.w > door.d;
  const ends = isAlongX ? [door.x - POST_WIDTH / 2, door.x + door.w - POST_WIDTH / 2] : [door.z - POST_WIDTH / 2, door.z + door.d - POST_WIDTH / 2];
  for (const end of ends) {
    const at = isAlongX ? [end, 0, door.z] : [door.x, 0, end];
    const size = isAlongX ? [POST_WIDTH, height, door.d] : [door.w, height, POST_WIDTH];
    box(parent, size, at, color);
  }
}

function mainDoor(parent, door) {
  doorPosts(parent, door, MAIN_DOOR_POST_HEIGHT);
  box(parent, [door.w, RAIL_HEIGHT * 2, door.d], [door.x, MAIN_DOOR_POST_HEIGHT - RAIL_HEIGHT * 2, door.z], HEADQUARTERS_PALETTE.accent);
  box(parent, [door.w - DOORMAT_INSET * 2, DOORMAT_HEIGHT, DOORMAT_DEPTH], [door.x + DOORMAT_INSET, 0, door.z - DOORMAT_DEPTH], DOORMAT, { shadow: false });
}

const isLowWallPassage = (door) => door.from === "corridor" && ROOMS_BEHIND_LOW_WALLS.has(door.to);

function doors(parent, layout) {
  const partitionHeight = Math.max(...layout.walls.filter((wall) => wall.kind === "partition").map((wall) => wall.height));
  for (const door of layout.doors) {
    if (door.to === YARD) mainDoor(parent, door);
    else if (!isLowWallPassage(door)) doorPosts(parent, door, partitionHeight + POST_RISE);
  }
}

export function buildHeadquartersShell(parent, layout) {
  plinth(parent, layout.size);
  floors(parent, layout.areas);
  for (const wall of layout.walls) WALL_BUILDERS[wall.kind](parent, wall);
  doors(parent, layout);
}
