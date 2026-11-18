import { rect as r } from "./pixels.js";
import { box, faces, onPlaneX, onPlaneY, project, shade } from "./iso.js";

const DARK = "#1b1f2b";

export function desk(x, y, w, d, theme) {
  const leg = (lx, ly) => box({ x: lx, y: ly, z: 0, w: 0.08, d: 0.08, h: 16 }, faces(theme.leg));
  return leg(x + 0.05, y + 0.05) + leg(x + w - 0.13, y + 0.05) + leg(x + 0.05, y + d - 0.13) + leg(x + w - 0.13, y + d - 0.13)
    + box({ x, y, z: 16, w, d, h: 3 }, { top: theme.desk, left: theme.deskEdge, right: shade(theme.deskEdge, -0.15) });
}

export function chairSeat(x, y, theme) {
  return box({ x: x + 0.2, y: y + 0.2, z: 0, w: 0.1, d: 0.1, h: 9 }, faces("#555a66"))
    + box({ x, y, z: 9, w: 0.5, d: 0.5, h: 3 }, faces(theme.chair));
}

export function chairBack(x, y, theme, facing) {
  const backY = facing === "viewer" ? y - 0.08 : y + 0.42;
  return box({ x, y: backY, z: 12, w: 0.5, d: 0.08, h: 13 }, faces(theme.chair));
}

export function monitor(x, y, screenToViewer, glow) {
  const screen = glow ? "#9ff5d0" : "#2b3245";
  const body = box({ x: x + 0.25, y: y + 0.05, z: 19, w: 0.1, d: 0.1, h: 5 }, faces("#3a3f4a"))
    + box({ x, y, z: 24, w: 0.6, d: 0.1, h: 12 }, faces("#2b2f3a"));
  if (!screenToViewer) return body + box({ x: x + 0.1, y: y + 0.25, z: 19, w: 0.45, d: 0.18, h: 1 }, faces("#e8ecf3"));
  const lines = glow ? r(2, 3, 5, 1, "#2b8a6a", 'class="screen-line"') + r(2, 6, 3, 1, "#2b8a6a", 'class="screen-line"') : "";
  return body + onPlaneY(y + 0.1, x + 0.05, 35, r(0, 0, 8, 10, screen) + lines)
    + box({ x: x + 0.05, y: y - 0.32, z: 19, w: 0.5, d: 0.18, h: 1 }, faces("#e8ecf3"));
}

function shelfItems(theme, width, height, seed) {
  let out = "";
  const rows = Math.floor(height / 13);
  for (let row = 0; row < rows; row += 1) {
    const top = 2 + row * 13;
    out += r(0, top + 10, width, 2, shade(theme.shelf, -0.2));
    for (let i = 0, x = 2; x < width - 4; i += 1) {
      const w = 2 + ((seed + i * 7 + row * 3) % 3);
      const h = 6 + ((seed + i + row) % 4);
      out += r(x, top + 10 - h, w, h, theme.items[(seed + i * 3 + row) % theme.items.length]);
      x += w + 1 + ((i + row) % 4 === 3 ? 3 : 0);
    }
  }
  return out;
}

export function shelf(x, y, w, d, h, theme, along) {
  const frame = box({ x, y, z: 0, w, d, h }, faces(theme.shelf));
  const seed = Math.round(x * 7 + y * 13);
  if (along === "x") return frame + onPlaneY(y + d, x, h - 2, shelfItems(theme, w * 16, h - 4, seed));
  return frame + onPlaneX(x + w, y, h - 2, shelfItems(theme, d * 16, h - 4, seed));
}

export function cabinet(x, y, w, d, color = "#eef1f5") {
  const drawers = r(1, 3, w * 16 - 2, 1, "#c9ced6") + r(1, 9, w * 16 - 2, 1, "#c9ced6") + r(w * 8 - 2, 5, 4, 1, "#8a96a3") + r(w * 8 - 2, 11, 4, 1, "#8a96a3");
  return box({ x, y, z: 0, w, d, h: 16 }, faces(color)) + onPlaneY(y + d, x, 16, drawers);
}

function sprite(x, y, z, body) {
  const { sx, sy } = project(x, y, z);
  return `<g transform="translate(${sx} ${sy})">${body}</g>`;
}

const PLANT = r(-7, -14, 4, 10, "#3f9a52") + r(-3, -20, 5, 16, "#47b85e") + r(2, -16, 5, 12, "#3f9a52") + r(-9, -10, 4, 4, "#47b85e") + r(5, -11, 5, 4, "#57c46a") + r(-1, -23, 3, 4, "#57c46a");

const FLOOR_PROPS = {
  plant: (x, y) => box({ x, y, z: 0, w: 0.5, d: 0.5, h: 10 }, faces("#c0663a")) + sprite(x + 0.25, y + 0.25, 10, PLANT),
  cabinet: (x, y) => cabinet(x, y, 1.2, 0.6),
  printer: (x, y) => cabinet(x, y, 0.9, 0.7) + box({ x: x + 0.1, y: y + 0.1, z: 16, w: 0.7, d: 0.5, h: 7 }, faces("#d0d4dc")) + box({ x: x + 0.2, y: y + 0.15, z: 23, w: 0.5, d: 0.3, h: 1 }, faces("#ffffff")),
  cooler: (x, y) => box({ x, y, z: 0, w: 0.5, d: 0.5, h: 18 }, faces("#e8ecf3")) + box({ x: x + 0.08, y: y + 0.08, z: 18, w: 0.34, d: 0.34, h: 10 }, faces("#8fd0ff")),
  coffee: (x, y) => cabinet(x, y, 1, 0.6, "#7a4a2a") + box({ x: x + 0.15, y: y + 0.1, z: 16, w: 0.5, d: 0.4, h: 12 }, faces("#3a3a3a")) + box({ x: x + 0.7, y: y + 0.25, z: 16, w: 0.12, d: 0.12, h: 3 }, faces("#ffffff")),
  sofa: (x, y) => box({ x, y, z: 0, w: 1.8, d: 0.7, h: 7 }, faces("#b05a3a")) + box({ x, y, z: 7, w: 1.8, d: 0.2, h: 9 }, faces("#c96a46")),
  globe: (x, y) => box({ x, y, z: 0, w: 0.4, d: 0.4, h: 10 }, faces("#4a2f1e")) + sprite(x + 0.2, y + 0.2, 10, r(-6, -12, 12, 12, "#3a6ab0") + r(-4, -10, 4, 3, "#3a9a5a") + r(1, -6, 3, 3, "#3a9a5a")),
  armchair: (x, y) => box({ x, y, z: 0, w: 0.8, d: 0.8, h: 8 }, faces("#7a2a2a")) + box({ x, y, z: 8, w: 0.8, d: 0.2, h: 10 }, faces("#923636")),
  lamp: (x, y) => box({ x, y, z: 0, w: 0.1, d: 0.1, h: 30 }, faces("#4a2f1e")) + sprite(x + 0.05, y + 0.05, 30, r(-6, -6, 12, 7, "#f2d27a")),
  toolbox: (x, y) => box({ x, y, z: 0, w: 0.8, d: 0.5, h: 12 }, faces("#d23a2a")) + box({ x: x + 0.3, y: y + 0.2, z: 12, w: 0.2, d: 0.1, h: 3 }, faces("#3e4148")),
  tire: (x, y) => sprite(x + 0.3, y + 0.3, 0, r(-8, -14, 16, 14, "#1d1d1d") + r(-4, -10, 8, 6, "#8d9097")),
  barrel: (x, y) => box({ x, y, z: 0, w: 0.5, d: 0.5, h: 20 }, faces("#2b5ab0")),
  robot: (x, y) => box({ x, y, z: 0, w: 0.4, d: 0.4, h: 12 }, faces("#8d9097")) + box({ x: x + 0.05, y: y + 0.05, z: 12, w: 0.3, d: 0.3, h: 8 }, faces("#c9d1de")) + sprite(x + 0.2, y + 0.4, 16, r(-4, -2, 2, 2, "#6fc3ff") + r(1, -1, 2, 2, "#6fc3ff")),
  tank: (x, y) => box({ x, y, z: 0, w: 0.4, d: 0.4, h: 26 }, faces("#e8ecf3")) + box({ x, y, z: 26, w: 0.4, d: 0.4, h: 4 }, faces("#ff6b6b")),
  tree: (x, y) => box({ x: x + 0.2, y: y + 0.2, z: 0, w: 0.15, d: 0.15, h: 16 }, faces("#6a4a2a")) + sprite(x + 0.28, y + 0.28, 16, r(-12, -18, 24, 16, "#3f8a36") + r(-9, -22, 18, 6, "#4aa040") + r(-6, -12, 3, 3, "#ff6b6b") + r(4, -15, 3, 3, "#ff6b6b")),
  flowers: (x, y) => box({ x, y, z: 0, w: 1, d: 0.4, h: 6 }, faces("#6a4a2a")) + sprite(x + 0.5, y + 0.2, 6, r(-10, -5, 4, 4, "#ff8ad0") + r(-3, -6, 4, 4, "#ffe066") + r(4, -5, 4, 4, "#b28cff")),
  bench: (x, y) => box({ x, y, z: 6, w: 1.4, d: 0.4, h: 2 }, faces("#8a5a3a")) + box({ x, y, z: 0, w: 0.1, d: 0.4, h: 6 }, faces("#5a3a24")) + box({ x: x + 1.3, y, z: 0, w: 0.1, d: 0.4, h: 6 }, faces("#5a3a24")),
  arcade: (x, y) => box({ x, y, z: 0, w: 0.6, d: 0.6, h: 34 }, faces("#3a1f6a")) + onPlaneY(y + 0.6, x + 0.05, 30, r(0, 0, 8, 7, "#05070d") + r(1, 2, 4, 1, "#4fe3ff") + r(1, 10, 2, 2, "#ff4fd8") + r(5, 10, 2, 2, "#ffe04f")),
  claw: (x, y) => box({ x, y, z: 0, w: 0.7, d: 0.7, h: 14 }, faces("#2b9ab0")) + box({ x, y, z: 14, w: 0.7, d: 0.7, h: 18 }, { top: "#c8f6ffaa", left: "#c8f6ff88", right: "#a8e6ef88" }),
  pizza: (x, y) => box({ x, y, z: 0, w: 0.6, d: 0.6, h: 2 }, faces("#e8c590")) + box({ x: x + 0.05, y: y + 0.05, z: 2, w: 0.5, d: 0.5, h: 1 }, faces("#f2a65a")),
};

export const floorProp = (name, x, y) => (FLOOR_PROPS[name] ?? FLOOR_PROPS.plant)(x, y);

const WALL_ART = {
  clock: (w) => `<circle cx="${w / 2}" cy="16" r="9" fill="#2b2f3a"/><circle cx="${w / 2}" cy="16" r="7" fill="#ffffff"/>` + r(w / 2 - 0.5, 10, 1, 6, DARK) + r(w / 2, 15, 4, 1, DARK),
  board: (w) => r(2, 6, w - 4, 22, "#8a96a3") + r(3, 7, w - 6, 20, "#ffffff") + r(6, 11, w / 2, 2, "#5b8cff") + r(6, 16, w - 14, 2, "#f07a4a") + r(6, 21, w / 3, 2, "#47e09b"),
  window: (w) => r(2, 4, w - 4, 26, "#8a96a3") + r(4, 6, w - 8, 22, "#a9dcff") + r(w / 2 - 1, 6, 2, 22, "#8a96a3") + r(6, 8, 6, 2, "#ffffffaa"),
  chalkboard: (w) => r(2, 4, w - 4, 26, "#7a4a2a") + r(4, 6, w - 8, 22, "#2f3a33") + r(8, 10, w / 2, 2, "#e8e8e8") + r(8, 15, w - 20, 2, "#e8e8e8") + r(8, 20, w / 3, 2, "#f2a65a"),
  pegboard: (w) => r(2, 4, w - 4, 26, "#c9a46a") + r(8, 8, 2, 16, "#d0d4dc") + r(14, 8, 10, 3, "#d0d4dc") + r(w - 14, 8, 3, 14, "#e85a3a"),
  shutter: (w) => r(0, 0, w, 40, "#6c717a") + Array.from({ length: 10 }, (_, i) => r(0, 2 + i * 4, w, 1, "#555a62")).join(""),
  porthole: (w) => `<circle cx="${w / 2}" cy="18" r="12" fill="#8d97a8"/><circle cx="${w / 2}" cy="18" r="9" fill="#05070d"/><circle cx="${w / 2 + 2}" cy="20" r="4" fill="#b28cff"/>` + r(w / 2 - 5, 13, 1, 1, "#ffffff"),
  console: (w) => r(2, 6, w - 4, 22, "#0b0d13") + r(5, 10, w - 10, 2, "#47e09b") + r(5, 15, w / 2, 2, "#6fc3ff") + r(5, 20, w - 16, 2, "#47e09b"),
  hedge: (w) => r(0, 18, w, 22, "#3f8a36") + r(4, 14, 10, 6, "#4aa040") + r(w / 2, 12, 12, 8, "#4aa040") + r(8, 24, 3, 3, "#ff8ad0"),
  sun: (w) => `<circle cx="${w / 2}" cy="14" r="8" fill="#ffe066"/>` + r(2, 26, 18, 5, "#ffffff"),
  neon: (w) => `<rect x="3" y="7" width="${w - 6}" height="18" fill="none" stroke="#ff4fd8" stroke-width="1"/>` + r(8, 11, 6, 10, "#4fe3ff") + r(18, 11, 6, 10, "#ffe04f") + r(28, 11, 6, 10, "#ff4fd8"),
  arcade: (w) => r(6, 4, w - 12, 30, "#3a1f6a") + r(9, 7, w - 18, 12, "#05070d") + r(12, 10, 6, 2, "#4fe3ff") + r(12, 24, 3, 3, "#ff4fd8"),
};

export function wallArt(name, plane, along, wallTop, width) {
  const art = (WALL_ART[name] ?? WALL_ART.board)(width * 16);
  return plane === "back" ? onPlaneY(0, along, wallTop - 10, art) : onPlaneX(0, along, wallTop - 10, art);
}
