import { layoutRoom } from "../domain/room/room-layout.js";
import { seatStop } from "../domain/room/room-spots.js";
import { wallWidthOf } from "../domain/room/wall-plan.js";
import { hashOf, rng } from "../domain/shared/seeded-random.js";
import { loungeSet, meetingSet } from "./commons.js";
import { prop, shelfUnit, wallItem } from "./decor.js";
import { bin, desk, station, vacantStation } from "./furniture.js";
import { box, shade, THREE, tiledSlab } from "./kit.js";
import { rug } from "./parts.js";
import { createPerson } from "./people.js";

const WALL_T = 0.15;
const WALL_CAP = 0.04;
const WALL_CELLS_PER_UNIT = 2;
const CURB_HEIGHT = 0.14;
const PARTITION_HEIGHT = 0.9;
const RUG_MARGIN_X = 0.3;
const RUG_MARGIN_Z = 1.0;
const LIT = new Set(["working", "reviewing", "needs_you", "waiting"]);

function shell(root, theme, W, D) {
  const H = theme.wallHeight;
  const outerW = W + WALL_T * 2;
  const trim = shade(theme.wall, -0.25);
  const floor = { pattern: theme.floorPattern, base: theme.floor, line: theme.floorLine };
  const wall = { pattern: theme.wallPattern, base: theme.wall, line: theme.wallLine };
  tiledSlab(root, [outerW, 0.12, D + WALL_T * 2], [-WALL_T, -0.12, -WALL_T], floor, outerW, D + WALL_T * 2);
  tiledSlab(root, [outerW, H, WALL_T], [-WALL_T, 0, -WALL_T], wall, outerW * WALL_CELLS_PER_UNIT, H * WALL_CELLS_PER_UNIT);
  box(root, [outerW, WALL_CAP, WALL_T], [-WALL_T, H, -WALL_T], trim, { shadow: false });
  for (const x of [-WALL_T, W]) box(root, [WALL_T, H + WALL_CAP, D], [x, 0, 0], trim);
  box(root, [outerW, CURB_HEIGHT, WALL_T], [-WALL_T, 0, D], trim);
  box(root, [W, 0.1, 0.03], [0, 0, 0], trim, { shadow: false });
}

function partitions(root, theme, rects) {
  for (const { x, z, w, d } of rects) {
    box(root, [w, PARTITION_HEIGHT, d], [x, 0, z], theme.divider);
    box(root, [w + 0.04, 0.05, d + 0.04], [x - 0.02, PARTITION_HEIGHT, z - 0.02], shade(theme.divider, -0.25));
  }
}

function furnishWalls(root, theme, zones, random) {
  const shelfHeight = Math.min(2.0, theme.wallHeight - 0.5);
  const onBackWall = ({ name, x, width }) => {
    if (name === "shelf") shelfUnit(root, x, 0.02, 0, width, shelfHeight, theme, random);
    else wallItem(root, name, x, 0, 0, width, theme, random);
  };
  const meetingWidth = wallWidthOf(theme.meetingWall);
  onBackWall({ name: "door", x: zones.door.x, width: zones.door.width });
  zones.wallItems.forEach(onBackWall);
  onBackWall({ name: theme.meetingWall, x: zones.meeting.x - meetingWidth / 2, width: meetingWidth });
}

function furnishCommons(root, theme, zones, random) {
  partitions(root, theme, zones.partitions);
  meetingSet(root, zones.meeting.x, zones.meeting.z, theme);
  loungeSet(root, zones.lounge.x, zones.lounge.z, theme, random);
  prop(root, "coatRack", zones.coatRack.x, zones.coatRack.z, 0, theme, random);
  for (const item of [...zones.corners, ...zones.spots]) prop(root, item.prop, item.x, item.z, 0, theme, random);
}

function workstations(root, pods, theme, roomKey) {
  const people = new Map();
  const nameplates = [];
  for (const pod of pods) {
    const d = pod.desk;
    const podKey = pod.seats.find((seat) => seat.agent)?.agent.key ?? `${roomKey}|${d.x}|${d.z}`;
    rug(root, d.x - RUG_MARGIN_X, d.z - RUG_MARGIN_Z, d.w + RUG_MARGIN_X * 2, d.d + RUG_MARGIN_Z * 2, theme.rug);
    desk(root, d.x, d.z, d.w, d.d, theme, rng(hashOf(`desk|${podKey}`)));
    bin(root, d.x - 0.32, d.z + d.d / 2);
    for (const seat of pod.seats) {
      const edgeZ = seat.direction === 1 ? d.z : d.z + d.d;
      if (!seat.agent) {
        vacantStation(root, seat.cx, edgeZ, seat.direction, theme);
        if (seat.role) nameplates.push({ role: seat.role, ...seatStop(pod, seat) });
        continue;
      }
      station(root, seat.cx, edgeZ, seat.direction, theme, LIT.has(seat.agent.status), rng(hashOf(seat.agent.key)));
      people.set(seat.agent.key, createPerson(root, seat.agent));
    }
  }
  return { people, nameplates };
}

export function buildRoom(project, theme) {
  const layout = layoutRoom(project, theme);
  const { W, D, pods, zones } = layout;
  const root = new THREE.Group();
  const random = rng(hashOf(`${project.key}|${theme.id}`));

  shell(root, theme, W, D);
  furnishWalls(root, theme, zones, random);
  furnishCommons(root, theme, zones, random);
  const { people, nameplates } = workstations(root, pods, theme, project.key);
  return { root, people, nameplates, layout, size: { W, D, H: theme.wallHeight } };
}
