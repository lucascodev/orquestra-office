import { HEADQUARTERS_PALETTE } from "../../data/headquarters-palette.js";
import { hashOf, pickWith, rng } from "../../domain/shared/seeded-random.js";
import { box, cyl, group, shade } from "../kit.js";
import { chair } from "./furniture.js";
import { pixelLettering } from "./monument-sign.js";
import { cabinet, DARK, HANDLE, plant, rug } from "./parts.js";

const { furniture: COLORS, accent: ACCENT } = HEADQUARTERS_PALETTE;
const FACING = { front: 0, back: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 };
const TOP = 0.05;
const LEG = 0.06;
const LEG_INSET = 0.08;
const METAL = "#8a96a3";
const WHITE = "#ffffff";
const PAPER = "#f4f1e6";
const SCREEN_ON = "#bfe6ff";
const MUG_RADIUS = 0.04;
const MUG_HEIGHT = 0.09;
const PLANT_SIZE_PER_HEIGHT = 1.25;
const MARKERS = ["#5b8cff", "#f07a4a", "#47e09b"];
const CUPS = ["#ffffff", "#e85a3a", "#3a6ab0"];
const LOUNGE_RUG = { x: 20.8, z: 0.7, w: 4, d: 3.9, color: "#d9b98f" };
const CORRIDOR_RUNNER = { x: 0.6, z: 6.55, w: 24.8, d: 0.9, color: "#cfc4ae" };
const LOUNGE_FRAMES = [[21.2, 1.25, 0.6, 0.7], [22.1, 1.4, 0.5, 0.5], [22.9, 1.2, 0.8, 0.8]];
const FRAME_ART = ["#3a6ab0", "#e3c13b", "#47b85e"];
const BACK_WALL_FACE = 0.2;
const GAMES_NEON = { x: 14.4, w: 4.2, y: 2.05 };

const centerOf = ({ x, z, w, d }) => [x + w / 2, z + d / 2];

function legs(parent, { x, z, w, d }, height, color) {
  for (const [lx, lz] of [[x + LEG_INSET, z + LEG_INSET], [x + w - LEG_INSET - LEG, z + LEG_INSET], [x + LEG_INSET, z + d - LEG_INSET - LEG], [x + w - LEG_INSET - LEG, z + d - LEG_INSET - LEG]]) {
    box(parent, [LEG, height, LEG], [lx, 0, lz], color);
  }
}

function tableTop(parent, item, color) {
  box(parent, [item.w, TOP, item.d], [item.x, item.height - TOP, item.z], color);
  legs(parent, item, item.height - TOP, METAL);
}

function mug(parent, x, y, z, color) {
  cyl(parent, MUG_RADIUS, MUG_HEIGHT, [x, y, z], color);
}

function laptop(parent, x, y, z, isOpen) {
  box(parent, [0.32, 0.02, 0.22], [x, y, z], "#c9ced6");
  if (!isOpen) return;
  box(parent, [0.32, 0.22, 0.015], [x, y, z - 0.015], "#c9ced6");
  box(parent, [0.28, 0.18, 0.005], [x + 0.02, y + 0.02, z], SCREEN_ON, { glow: true });
}

function meetingTable(parent, item) {
  tableTop(parent, item, COLORS.meetingTable);
  const y = item.height;
  laptop(parent, item.x + 0.6, y, item.z + 0.35, true);
  laptop(parent, item.x + item.w - 1.0, y, item.z + 0.3, false);
  box(parent, [0.2, 0.01, 0.28], [item.x + 2.0, y, item.z + item.d - 0.5], WHITE, { shadow: false });
  box(parent, [0.2, 0.01, 0.28], [item.x + 2.05, y + 0.01, item.z + item.d - 0.47], PAPER, { shadow: false });
  mug(parent, item.x + 1.3, y, item.z + item.d - 0.35, CUPS[1]);
  cyl(parent, 0.09, 0.03, [item.x + item.w / 2, y, item.z + item.d / 2], DARK);
}

function seatChair(parent, item) {
  const [cx, cz] = centerOf(item);
  chair(group(parent, cx, 0, cz, FACING[item.faces]), COLORS);
}

function whiteboard(parent, item) {
  box(parent, [item.w, item.height, item.d], [item.x, item.y, item.z], METAL);
  box(parent, [item.w - 0.1, item.height - 0.1, 0.01], [item.x + 0.05, item.y + 0.05, item.z + item.d], COLORS.whiteboard, { shadow: false });
  MARKERS.forEach((color, i) => {
    box(parent, [item.w * (0.55 - i * 0.12), 0.05, 0.005], [item.x + 0.25, item.y + item.height - 0.3 - i * 0.2, item.z + item.d + 0.01], color, { shadow: false });
  });
  box(parent, [0.3, 0.3, 0.005], [item.x + item.w - 0.6, item.y + 0.3, item.z + item.d + 0.01], "#ffe066", { shadow: false });
  box(parent, [item.w * 0.6, 0.04, 0.08], [item.x + item.w * 0.2, item.y - 0.02, item.z + item.d], METAL);
}

function coffeeCounter(parent, item) {
  const body = item.height - 0.08;
  cabinet(group(parent, item.x, 0, item.z), item.w, body, item.d, COLORS.coffeeCounter);
  const y = item.height;
  box(parent, [0.4, 0.45, 0.35], [item.x + 0.3, y, item.z + 0.1], "#2b2f3a");
  box(parent, [0.26, 0.08, 0.06], [item.x + 0.37, y + 0.24, item.z + 0.45], "#c9ced6");
  mug(parent, item.x + 0.5, y, item.z + 0.55, WHITE);
  box(parent, [0.6, 0.03, 0.45], [item.x + 1.6, y - 0.02, item.z + 0.15], "#9aa2b4", { shadow: false });
  CUPS.forEach((color, i) => mug(parent, item.x + 3.0 + i * 0.16, y, item.z + 0.5, color));
  cyl(parent, 0.16, 0.08, [item.x + 4.2, y, item.z + 0.4], "#e8ecf3");
  box(parent, [0.1, 0.08, 0.1], [item.x + 4.12, y + 0.06, item.z + 0.33], "#f2c94c", { shadow: false });
  box(parent, [0.08, 0.07, 0.08], [item.x + 4.24, y + 0.06, item.z + 0.38], "#e85a3a", { shadow: false });
  const upperX = item.x + 3.0;
  const upperW = item.w - 3.0;
  box(parent, [upperW, 0.55, 0.32], [upperX, 1.6, BACK_WALL_FACE], COLORS.coffeeCounter);
  for (let i = 1; i < 3; i += 1) box(parent, [0.012, 0.5, 0.01], [upperX + (upperW * i) / 3, 1.62, BACK_WALL_FACE + 0.32], shade(COLORS.coffeeCounter, -0.3), { shadow: false });
}

function fridge(parent, item) {
  box(parent, [item.w, item.height, item.d], [item.x, 0, item.z], COLORS.fridge);
  box(parent, [item.w, 0.015, 0.01], [item.x, 1.2, item.z + item.d], shade(COLORS.fridge, -0.25), { shadow: false });
  for (const [y, h] of [[1.35, 0.4], [0.5, 0.55]]) box(parent, [0.04, h, 0.04], [item.x + item.w - 0.12, y, item.z + item.d], HANDLE, { shadow: false });
  box(parent, [0.16, 0.2, 0.005], [item.x + 0.15, 1.45, item.z + item.d], "#ffe066", { shadow: false });
}

function highTable(parent, item, random) {
  const [cx, cz] = centerOf(item);
  box(parent, [item.w, TOP, item.d], [item.x, item.height - TOP, item.z], COLORS.highTable);
  cyl(parent, 0.05, item.height - TOP, [cx, 0, cz], METAL);
  cyl(parent, 0.28, 0.03, [cx, 0, cz], DARK);
  mug(parent, cx + 0.2, item.height, cz - 0.15, pickWith(random, CUPS));
}

function backWallWindow(parent, item) {
  box(parent, [item.w, item.height, item.d], [item.x, item.y, item.z], METAL);
  box(parent, [item.w - 0.1, item.height - 0.1, 0.01], [item.x + 0.05, item.y + 0.05, item.z + item.d], SCREEN_ON, { glow: true });
  box(parent, [0.04, item.height - 0.1, 0.02], [item.x + item.w / 2 - 0.02, item.y + 0.05, item.z + item.d], METAL, { shadow: false });
  box(parent, [item.w + 0.1, 0.04, 0.12], [item.x - 0.05, item.y - 0.04, item.z], "#c9ced6");
}

function pingpongTable(parent, item) {
  const y = item.height;
  box(parent, [item.w, TOP, item.d], [item.x, y - TOP, item.z], COLORS.pingpongTable);
  legs(parent, item, y - TOP, DARK);
  const line = 0.03;
  for (const z of [item.z, item.z + item.d - line]) box(parent, [item.w, 0.004, line], [item.x, y, z], WHITE, { shadow: false });
  for (const x of [item.x, item.x + item.w - line]) box(parent, [line, 0.004, item.d], [x, y, item.z], WHITE, { shadow: false });
  box(parent, [item.w, 0.004, 0.02], [item.x, y, item.z + item.d / 2 - 0.01], WHITE, { shadow: false });
  box(parent, [0.02, 0.16, item.d + 0.1], [item.x + item.w / 2 - 0.01, y, item.z - 0.05], COLORS.net);
  box(parent, [0.16, 0.012, 0.1], [item.x + 0.3, y, item.z + 0.4], "#e04848", { shadow: false });
  box(parent, [0.05, 0.05, 0.05], [item.x + 2.1, y, item.z + 1.0], WHITE, { shadow: false });
}

function arcade(parent, item) {
  const side = COLORS.arcade;
  const front = "#2a1550";
  box(parent, [item.w, 1.0, item.d], [item.x, 0, item.z], side);
  box(parent, [item.w - 0.08, 0.9, 0.01], [item.x + 0.04, 0.05, item.z + item.d], front, { shadow: false });
  box(parent, [item.w, 0.8, item.d * 0.55], [item.x, 1.0, item.z], side);
  box(parent, [item.w - 0.14, 0.5, 0.01], [item.x + 0.07, 1.12, item.z + item.d * 0.55], "#4fe3ff", { glow: true });
  box(parent, [item.w, 0.06, item.d * 0.45], [item.x, 1.0, item.z + item.d * 0.55], DARK);
  box(parent, [0.05, 0.1, 0.05], [item.x + 0.2, 1.06, item.z + item.d * 0.75], "#ff6b6b");
  cyl(parent, 0.035, 0.03, [item.x + 0.5, 1.06, item.z + item.d * 0.75], "#ffe04f");
  box(parent, [item.w, 0.16, 0.04], [item.x, item.height - 0.2, item.z + item.d * 0.55], "#ffe04f", { glow: true });
}

function puff(parent, item) {
  const [cx, cz] = centerOf(item);
  const radius = Math.min(item.w, item.d) / 2;
  cyl(parent, radius, item.height - 0.06, [cx, 0, cz], COLORS.puff);
  cyl(parent, radius * 0.85, 0.06, [cx, item.height - 0.06, cz], shade(COLORS.puff, 0.2));
}

function sofa(parent, item) {
  const color = COLORS.sofa;
  const arm = 0.2;
  const back = 0.25;
  box(parent, [item.w, 0.3, item.d], [item.x, 0.06, item.z], shade(color, -0.15));
  const cushionW = (item.w - arm * 2) / 3;
  for (let i = 0; i < 3; i += 1) {
    box(parent, [cushionW - 0.04, 0.14, item.d - back - 0.05], [item.x + arm + i * cushionW + 0.02, 0.36, item.z + back], color);
  }
  box(parent, [item.w, 0.5, back], [item.x, 0.36, item.z], shade(color, -0.08));
  for (const x of [item.x, item.x + item.w - arm]) box(parent, [arm, 0.28, item.d], [x, 0.36, item.z], shade(color, -0.22));
  box(parent, [0.4, 0.3, 0.12], [item.x + 0.35, 0.5, item.z + back], "#f2c94c");
}

function coffeeTable(parent, item) {
  tableTop(parent, item, COLORS.coffeeTable);
  box(parent, [0.3, 0.012, 0.22], [item.x + 0.25, item.height, item.z + 0.3], "#3a6ab0", { shadow: false });
  mug(parent, item.x + item.w - 0.35, item.height, item.z + 0.5, CUPS[1]);
}

function pottedPlant(parent, item, random) {
  const [cx, cz] = centerOf(item);
  plant(parent, cx, cz, item.height * PLANT_SIZE_PER_HEIGHT, random);
}

function receptionCounter(parent, item) {
  const wood = COLORS.receptionCounter;
  box(parent, [item.w, item.height - TOP, item.d], [item.x, 0, item.z], wood);
  box(parent, [item.w + 0.1, TOP, item.d + 0.1], [item.x - 0.05, item.height - TOP, item.z - 0.05], shade(wood, 0.35));
  box(parent, [item.w - 0.4, 0.12, 0.01], [item.x + 0.2, item.height - 0.35, item.z + item.d], ACCENT, { shadow: false });
  box(parent, [item.w, 0.04, 0.35], [item.x, 0.75, item.z - 0.35], shade(wood, 0.2));
  const screenX = item.x + item.w / 2 - 0.3;
  box(parent, [0.6, 0.36, 0.04], [screenX, item.height, item.z + 0.15], DARK);
  box(parent, [0.54, 0.3, 0.01], [screenX + 0.03, item.height + 0.03, item.z + 0.14], SCREEN_ON, { glow: true });
  box(parent, [0.06, 0.1, 0.06], [screenX + 0.27, item.height - 0.02, item.z + 0.2], DARK);
  mug(parent, item.x + 0.4, item.height, item.z + 0.4, CUPS[0]);
}

function receptionSign(parent, item) {
  const postW = 0.08;
  for (const x of [item.x + 0.3, item.x + item.w - 0.3 - postW]) box(parent, [postW, item.y, postW], [x, 0, item.z - 0.02], METAL);
  box(parent, [item.w, item.height, item.d], [item.x, item.y, item.z], COLORS.sign);
  const inset = 0.1;
  pixelLettering(parent, item.text, { x: item.x + inset, y: item.y + inset, z: item.z + item.d, w: item.w - inset * 2, h: item.height - inset * 2 }, WHITE);
}

function bench(parent, item) {
  const color = COLORS.bench;
  box(parent, [item.w, 0.08, item.d - 0.15], [item.x, item.height - 0.08, item.z], shade(color, 0.25));
  box(parent, [item.w, 0.4, 0.12], [item.x, item.height - 0.05, item.z + item.d - 0.15], color);
  for (const x of [item.x + 0.1, item.x + item.w - 0.18]) box(parent, [0.08, item.height - 0.08, item.d - 0.2], [x, 0, item.z + 0.05], DARK);
}

function waterCooler(parent, item) {
  const isWide = item.w >= item.d;
  const unit = 0.42;
  const unitX = isWide ? item.x + 0.1 : item.x + (item.w - unit) / 2;
  const unitZ = isWide ? item.z + (item.d - unit) / 2 : item.z + 0.1;
  const body = item.height - 0.38;
  box(parent, [unit, body, unit], [unitX, 0, unitZ], COLORS.waterCooler);
  cyl(parent, 0.16, 0.38, [unitX + unit / 2, body, unitZ + unit / 2], "#8fd0ff");
  box(parent, [0.1, 0.05, 0.04], [unitX + 0.16, body - 0.25, unitZ + unit], "#5b8cff", { shadow: false });
  const [tableX, tableZ] = isWide ? [item.x + 0.65, item.z + 0.15] : [item.x + 0.15, item.z + 0.65];
  box(parent, [0.45, 0.04, 0.45], [tableX, 0.7, tableZ], COLORS.highTable);
  box(parent, [0.06, 0.7, 0.06], [tableX + 0.2, 0, tableZ + 0.2], METAL);
  CUPS.forEach((color, i) => mug(parent, tableX + 0.1 + i * 0.12, 0.74, tableZ + 0.2, color));
}

const DECOR = {
  meetingTable, chair: seatChair, whiteboard, coffeeCounter, fridge, highTable, window: backWallWindow, pingpongTable, arcade, puff,
  sofa, coffeeTable, plant: pottedPlant, receptionCounter, sign: receptionSign, bench, waterCooler,
};

function loungeWall(parent) {
  LOUNGE_FRAMES.forEach(([x, y, w, h], i) => {
    box(parent, [w, h, 0.04], [x, y, BACK_WALL_FACE], DARK);
    box(parent, [w - 0.08, h - 0.08, 0.01], [x + 0.04, y + 0.04, BACK_WALL_FACE + 0.04], WHITE, { shadow: false });
    box(parent, [w - 0.2, h - 0.24, 0.01], [x + 0.1, y + 0.12, BACK_WALL_FACE + 0.046], FRAME_ART[i], { shadow: false });
  });
}

function gamesWall(parent) {
  box(parent, [GAMES_NEON.w, 0.05, 0.03], [GAMES_NEON.x, GAMES_NEON.y, BACK_WALL_FACE], COLORS.arcade, { glow: true });
  box(parent, [GAMES_NEON.w, 0.05, 0.03], [GAMES_NEON.x, GAMES_NEON.y - 0.12, BACK_WALL_FACE], "#4fe3ff", { glow: true });
}

export function buildCommonRooms(parent, layout) {
  const random = rng(hashOf("headquarters|common-rooms"));
  rug(parent, LOUNGE_RUG.x, LOUNGE_RUG.z, LOUNGE_RUG.w, LOUNGE_RUG.d, LOUNGE_RUG.color);
  rug(parent, CORRIDOR_RUNNER.x, CORRIDOR_RUNNER.z, CORRIDOR_RUNNER.w, CORRIDOR_RUNNER.d, CORRIDOR_RUNNER.color);
  loungeWall(parent);
  gamesWall(parent);
  for (const item of layout.decor) DECOR[item.kind](parent, item, random);
}
