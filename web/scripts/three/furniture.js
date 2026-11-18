import { box, cyl, group, shade } from "./kit.js";
import { DARK, HANDLE } from "./parts.js";

const DESK_TOP = 0.76;
const PARTITION_HEIGHT = 0.42;
const CLUTTER_X = 0.44;
const NOTE_COLORS = ["#ffe066", "#ff9ec4", "#8fd0ff", "#b6f09c"];
const PAPER = "#ffffff";

const pickOf = (list, random) => list[Math.floor(random() * list.length)];

function pedestal(g, w, d, theme) {
  const x = w - 0.5;
  const front = x + 0.4;
  box(g, [0.4, 0.58, d - 0.4], [x, 0.04, 0.2], theme.cabinet);
  for (const y of [0.24, 0.43]) box(g, [0.01, 0.012, d - 0.44], [front, y, 0.22], shade(theme.cabinet, -0.3), { shadow: false });
  for (const y of [0.13, 0.33, 0.52]) box(g, [0.02, 0.025, 0.14], [front, y, d / 2 - 0.07], HANDLE, { shadow: false });
}

function partition(g, w, d, theme, random) {
  const z = d / 2 - 0.02;
  box(g, [w - 0.08, PARTITION_HEIGHT, 0.04], [0.04, DESK_TOP, z], theme.partition);
  box(g, [w - 0.08, 0.03, 0.06], [0.04, DESK_TOP + PARTITION_HEIGHT, z - 0.01], shade(theme.partition, -0.25));
  for (let x = 0.16 + random() * 0.3; x < w - 0.3; x += 0.4 + random() * 0.5) {
    box(g, [0.1, 0.1, 0.008], [x, DESK_TOP + 0.12 + random() * 0.16, z + 0.04], pickOf(NOTE_COLORS, random), { shadow: false });
  }
}

export function desk(parent, x, z, w, d, theme, random) {
  const g = group(parent, x, 0, z);
  box(g, [w, 0.06, d], [0, DESK_TOP - 0.06, 0], theme.desk);
  box(g, [w - 0.12, 0.05, d - 0.12], [0.06, DESK_TOP - 0.11, 0.06], shade(theme.desk, -0.22));
  for (const [lx, lz] of [[0.05, 0.05], [w - 0.11, 0.05], [0.05, d - 0.11], [w - 0.11, d - 0.11]]) {
    box(g, [0.06, DESK_TOP - 0.11, 0.06], [lx, 0, lz], theme.leg);
  }
  pedestal(g, w, d, theme);
  partition(g, w, d, theme, random);
  return g;
}

export function bin(parent, x, z) {
  cyl(parent, 0.13, 0.3, [x, 0, z], "#4a5060");
  cyl(parent, 0.11, 0.02, [x, 0.29, z], DARK, { shadow: false });
  box(parent, [0.09, 0.06, 0.08], [x - 0.07, 0.28, z - 0.03], PAPER, { shadow: false });
}

export function chair(g, theme) {
  box(g, [0.5, 0.04, 0.07], [-0.25, 0.03, -0.055], "#555a66");
  box(g, [0.07, 0.04, 0.5], [-0.035, 0.03, -0.27], "#555a66");
  cyl(g, 0.035, 0.34, [0, 0.06, -0.02], "#555a66");
  box(g, [0.48, 0.08, 0.46], [-0.24, 0.39, -0.26], theme.chair);
  box(g, [0.46, 0.56, 0.08], [-0.23, 0.47, -0.34], theme.chair);
  box(g, [0.05, 0.04, 0.3], [-0.29, 0.6, -0.26], shade(theme.chair, 0.5));
  box(g, [0.05, 0.04, 0.3], [0.24, 0.6, -0.26], shade(theme.chair, 0.5));
}

function monitor(g, theme, lit) {
  box(g, [0.24, 0.02, 0.16], [-0.12, DESK_TOP, 0.36], DARK);
  box(g, [0.05, 0.18, 0.04], [-0.025, DESK_TOP + 0.02, 0.43], DARK);
  box(g, [0.62, 0.38, 0.045], [-0.31, DESK_TOP + 0.14, 0.4], DARK);
  box(g, [0.56, 0.32, 0.012], [-0.28, DESK_TOP + 0.17, 0.39], lit ? theme.screen : "#3a4152", { glow: lit });
  if (!lit) return;
  const line = shade(theme.screen, 0.55);
  [[0.3, 0.42], [0.2, 0.36], [0.36, 0.3], [0.14, 0.24]].forEach(([len, y]) => {
    box(g, [len, 0.025, 0.006], [-0.24, DESK_TOP + y, 0.384], line, { glow: true });
  });
}

function mug(g, x, pickColor) {
  cyl(g, 0.04, 0.09, [x, DESK_TOP, 0.16], pickColor());
}

function papers(g, x) {
  box(g, [0.2, 0.012, 0.27], [x - 0.1, DESK_TOP, 0.06], PAPER);
  box(g, [0.2, 0.012, 0.27], [x - 0.07, DESK_TOP + 0.012, 0.09], "#f4f1e6");
}

function pottedPlant(g, x) {
  box(g, [0.1, 0.09, 0.1], [x - 0.05, DESK_TOP, 0.3], "#c0663a");
  box(g, [0.16, 0.12, 0.05], [x - 0.08, DESK_TOP + 0.09, 0.325], "#47b85e");
  box(g, [0.05, 0.18, 0.16], [x - 0.025, DESK_TOP + 0.09, 0.27], "#3f9a52");
}

function deskLamp(g, x, pickColor) {
  cyl(g, 0.06, 0.02, [x, DESK_TOP, 0.34], DARK);
  box(g, [0.025, 0.3, 0.025], [x - 0.012, DESK_TOP, 0.33], "#c9ced6");
  box(g, [0.14, 0.05, 0.1], [x - 0.07, DESK_TOP + 0.28, 0.24], pickColor());
}

function phone(g, x) {
  box(g, [0.17, 0.04, 0.2], [x - 0.085, DESK_TOP, 0.2], DARK);
  box(g, [0.05, 0.035, 0.2], [x - 0.085, DESK_TOP + 0.04, 0.2], "#3a3f4a");
  box(g, [0.07, 0.008, 0.1], [x - 0.01, DESK_TOP + 0.04, 0.24], "#c9ced6", { shadow: false });
}

function paperTray(g, x) {
  for (const level of [0, 0.09]) {
    box(g, [0.22, 0.02, 0.3], [x - 0.11, DESK_TOP + level, 0.14], "#555a66");
    box(g, [0.19, 0.02, 0.27], [x - 0.095, DESK_TOP + level + 0.02, 0.155], PAPER, { shadow: false });
  }
  for (const [px, pz] of [[x - 0.11, 0.14], [x + 0.09, 0.14], [x - 0.11, 0.42], [x + 0.09, 0.42]]) {
    box(g, [0.02, 0.09, 0.02], [px, DESK_TOP + 0.02, pz], "#555a66", { shadow: false });
  }
}

const CLUTTER = [mug, papers, pottedPlant, deskLamp, phone, paperTray];

function clutter(g, theme, random) {
  const side = random() > 0.5 ? 1 : -1;
  const pickColor = () => pickOf(theme.items, random);
  pickOf(CLUTTER, random)(g, side * CLUTTER_X, pickColor);
  if (random() > 0.55) box(g, [0.12, 0.2, 0.03], [-side * CLUTTER_X - 0.06, DESK_TOP, 0.34], pickColor());
}

function workstation(parent, cx, deskEdgeZ, direction, theme, lit) {
  const g = group(parent, cx, 0, deskEdgeZ, direction === 1 ? 0 : Math.PI);
  box(g, [0.44, 0.025, 0.15], [-0.22, DESK_TOP, 0.1], theme.keyboard);
  box(g, [0.07, 0.03, 0.1], [0.28, DESK_TOP, 0.12], theme.keyboard);
  monitor(g, theme, lit);
  const seat = group(g, 0, 0, -0.32);
  chair(seat, theme);
  return { g, seat };
}

export function station(parent, cx, deskEdgeZ, direction, theme, lit, random) {
  const { g, seat } = workstation(parent, cx, deskEdgeZ, direction, theme, lit);
  clutter(g, theme, random);
  return seat;
}

export function vacantStation(parent, cx, deskEdgeZ, direction, theme) {
  workstation(parent, cx, deskEdgeZ, direction, theme, false);
}
