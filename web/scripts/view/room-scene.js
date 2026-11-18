import { seatedAgent } from "../art/characters.js";
import { box, onFloor, onPlaneX, onPlaneY, project, shade } from "../art/iso.js";
import { rect as r } from "../art/pixels.js";
import { chairBack, chairSeat, desk, floorProp, monitor, shelf, wallArt } from "../art/props.js";
import { layoutRoom } from "./room-layout.js";

const WALL_H = 66;
const SHELF_H = 46;
const LIT = new Set(["working", "reviewing"]);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function grid(width, height, color) {
  let lines = "";
  for (let x = 0; x <= width; x += 12) lines += r(x, 0, 1, height, color);
  for (let y = 0; y <= height; y += 12) lines += r(0, y, width, 1, color);
  return lines;
}

function walls(theme, W, D) {
  const back = box({ x: 0, y: -0.3, z: 0, w: W, d: 0.3, h: WALL_H }, { top: shade(theme.wallRight, 0.05), left: theme.wallRight, right: shade(theme.wallRight, -0.2) });
  const left = box({ x: -0.3, y: -0.3, z: 0, w: 0.3, d: D + 0.3, h: WALL_H }, { top: shade(theme.wallLeft, 0.05), left: shade(theme.wallLeft, -0.2), right: theme.wallLeft });
  return left + back + onPlaneY(0, 0, WALL_H, grid(W * 16, WALL_H, theme.grout)) + onPlaneX(0, 0, WALL_H, grid(D * 16, WALL_H, theme.grout));
}

function floor(theme, W, D) {
  let tiles = r(0, 0, W * 16, D * 16, theme.floor);
  for (let i = 0; i <= W; i += 1) tiles += r(i * 16, 0, 0.6, D * 16, theme.floorLine);
  for (let j = 0; j <= D; j += 1) tiles += r(0, j * 16, W * 16, 0.6, theme.floorLine);
  return onFloor(0, 0, 0, tiles);
}

function wallDecor(theme, W, D, add) {
  let x = 0.4;
  for (const item of theme.backWall) {
    const width = item === "shelf" ? 2.6 : 1.8;
    if (x + width > W - 0.3) break;
    if (item === "shelf") add(x + width / 2 + 0.35, shelf(x, 0.02, width, 0.7, SHELF_H, theme, "x"));
    else add(-50, wallArt(item, "back", x, WALL_H, width));
    x += width + 0.5;
  }
  let y = 0.9;
  for (const item of theme.leftWall) {
    const length = item === "shelf" ? 2.4 : 1.8;
    if (y + length > D - 2.2) break;
    if (item === "shelf") add(0.35 + y + length / 2, shelf(0.02, y, 0.7, length, SHELF_H, theme, "y"));
    else add(-50, wallArt(item, "left", y, WALL_H, length));
    y += length + 0.6;
  }
}

function floorProps(theme, W, D, add) {
  const slots = [[W - 1.3, 1.2], [W - 1.6, D / 2], [W - 1.5, D - 1.3], [0.5, D - 1.3], [W / 2, D - 1.1]];
  slots.forEach(([x, y], i) => add(x + y + 0.5, floorProp(theme.props[i % theme.props.length], x, y)));
}

function pods(layout, theme, add) {
  for (const pod of layout.pods) {
    const d = pod.desk;
    const deskKey = d.x + d.w / 2 + d.y + d.d / 2;
    add(deskKey, desk(d.x, d.y, d.w, d.d, theme));
    for (const seat of pod.seats) {
      const status = seat.agent.status;
      const personKey = seat.x + 0.25 + seat.y + 0.25;
      const viewer = seat.facing === "viewer";
      const monitorY = viewer ? d.y + 0.15 : d.y + d.d - 0.3;
      add(deskKey + 0.01, monitor(seat.x - 0.05, monitorY, !viewer, LIT.has(status)));
      add(personKey - 0.02, chairSeat(seat.x, seat.y, theme));
      add(viewer ? personKey - 0.01 : personKey + 0.01, chairBack(seat.x, seat.y, theme, seat.facing));
      const { sx, sy } = project(seat.x + 0.25, seat.y + 0.25, 12);
      add(personKey, `<g class="agent" data-agent="${esc(seat.agent.key)}" data-status="${esc(status)}" tabindex="0" role="button"
        aria-label="${esc(seat.agent.label)}: ${esc(seat.agent.action || status)}"><title>${esc(seat.agent.label)}: ${esc(seat.agent.action || "")}</title>
        ${seatedAgent(seat.agent, sx, sy, seat.facing, status)}</g>`);
    }
  }
}

export function renderRoom(project, theme) {
  const layout = layoutRoom(project);
  const { W, D } = layout;
  const drawables = [];
  const add = (key, markup) => drawables.push({ key, markup, order: drawables.length });

  add(-1000, floor(theme, W, D));
  add(-900, walls(theme, W, D));
  wallDecor(theme, W, D, add);
  floorProps(theme, W, D, add);
  pods(layout, theme, add);
  drawables.sort((a, b) => a.key - b.key || a.order - b.order);

  const minX = -D * 16 - 12;
  const maxX = W * 16 + 12;
  const minY = -WALL_H - 14;
  const maxY = (W + D) * 8 + 12;
  return `<svg class="room" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" shape-rendering="crispEdges" role="img"
    aria-label="Escritório ${esc(project.name)}">${drawables.map((d) => d.markup).join("")}</svg>`;
}
