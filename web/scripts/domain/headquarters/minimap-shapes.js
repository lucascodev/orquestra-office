import { HEADQUARTERS_PALETTE } from "../../data/headquarters-palette.js";
import { ISOMETRIC_VIEW, screenToGround } from "../camera/viewpoint.js";

export const MINIMAP_SIZE = { width: 132, height: 84 };
const NEEDS_YOU = "needs_you";

// Seen from above with the back wall on top, the whole map fits the minimap without stretching and is centered in it.
export function minimapFrame({ minX, maxX, minZ, maxZ }, size = MINIMAP_SIZE) {
  const scale = Math.min(size.width / (maxX - minX), size.height / (maxZ - minZ));
  return { scale, minX, minZ, left: (size.width - (maxX - minX) * scale) / 2, top: (size.height - (maxZ - minZ) * scale) / 2 };
}

export const toMinimap = (frame, { x, z }) => ({ x: frame.left + (x - frame.minX) * frame.scale, y: frame.top + (z - frame.minZ) * frame.scale });

export const fromMinimap = (frame, { x, y }) => ({ x: frame.minX + (x - frame.left) / frame.scale, z: frame.minZ + (y - frame.top) / frame.scale });

function rectOn(frame, { x, z, w, d }) {
  const corner = toMinimap(frame, { x, z });
  return { x: corner.x, y: corner.y, w: w * frame.scale, h: d * frame.scale };
}

const needsYou = (island) => island.seats.some((seat) => seat.agent?.status === NEEDS_YOU);

export function minimapShapes(layout, size = MINIMAP_SIZE) {
  const frame = minimapFrame(layout.bounds, size);
  const { minX, maxX, minZ, maxZ } = layout.bounds;
  const { floors, minimap, yard } = HEADQUARTERS_PALETTE;
  const shapes = [
    { kind: "ground", color: minimap.ground, ...rectOn(frame, { x: minX, z: minZ, w: maxX - minX, d: maxZ - minZ }) },
    { kind: "building", color: minimap.building, ...rectOn(frame, { x: 0, z: 0, w: layout.size.W, d: layout.size.D }) },
    ...layout.areas.map((area) => ({ kind: "area", areaId: area.id, color: floors[area.id], ...rectOn(frame, area) })),
    ...layout.islands.map((island) => ({
      kind: "island", projectKey: island.projectKey, color: island.theme.rug, isAlert: needsYou(island), ...rectOn(frame, island.rug),
    })),
    { kind: "sign", color: yard.signBlock, ...rectOn(frame, layout.yard.sign.block) },
  ];
  return { frame, shapes };
}

// The four corners of the screen seen on the ground; in the isometric view they make a diamond.
export function cameraFootprint(viewpoint, viewport, view = ISOMETRIC_VIEW) {
  const { width, height } = viewport;
  return [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }].map((corner) => screenToGround(viewpoint, corner, viewport, view));
}
