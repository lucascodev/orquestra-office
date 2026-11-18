import { HEADQUARTERS_PALETTE } from "../../data/headquarters-palette.js";
import { box, cyl, shade, tiledSlab } from "../kit.js";

const { yard: COLORS } = HEADQUARTERS_PALETTE;
const GROUND = -0.1;
const LAWN_THICKNESS = 0.3;
const PAVING = 0.02;
const STRIPE_HEIGHT = 0.004;
const LAWN_LINE_SHADE = 0.12;
const PATH_LINE_SHADE = -0.12;
const WHEEL_RADIUS = 0.15;
const WHEEL_INSET = 0.3;
const CAR_CLEARANCE = 0.1;
const CAR_BODY = 0.32;
const WINDOW = "#9fc6e8";
const HEADLIGHT = "#fff2b0";
const TAILLIGHT = "#e04848";
const TIRE = "#1d1d22";
const POLE_WIDTH = 0.12;
const POLE_BASE = 0.4;
const FLAG_HEIGHT = 0.7;
const FLAG_THICKNESS = 0.04;
const TREE_SPAN = 0.9;
const TRUNK = 0.2;
const TRUNK_HEIGHT = 0.7;
const CANOPY = [[TREE_SPAN, 0.7, 0], [0.66, 0.45, 0.25], [0.4, 0.3, 0.45]];
const BUSH = "#4f8a3f";
const ENTRANCE_BUSHES = [{ x: 20.3, w: 1 }, { x: 24.1, w: 1 }];
const BUSH_FROM_FACADE = 0.35;
const BUSH_DEPTH = 0.6;
const BUSH_HEIGHT = 0.45;

function lawn(parent, bounds) {
  const w = bounds.maxX - bounds.minX;
  const d = bounds.maxZ - bounds.minZ;
  const surface = { pattern: "speckle", base: COLORS.lawn, line: shade(COLORS.lawn, LAWN_LINE_SHADE) };
  tiledSlab(parent, [w, LAWN_THICKNESS, d], [bounds.minX, GROUND - LAWN_THICKNESS, bounds.minZ], surface, w, d);
}

function walkway(parent, path) {
  const surface = { pattern: "grid", base: COLORS.path, line: shade(COLORS.path, PATH_LINE_SHADE) };
  tiledSlab(parent, [path.w, PAVING, path.d], [path.x, GROUND, path.z], surface, path.w * 2, path.d * 2);
}

function parkingLot(parent, parking, stripes) {
  box(parent, [parking.w, PAVING, parking.d], [parking.x, GROUND, parking.z], COLORS.asphalt, { shadow: false });
  for (const stripe of stripes) box(parent, [stripe.w, STRIPE_HEIGHT, stripe.d], [stripe.x, GROUND + PAVING, stripe.z], COLORS.stripe, { shadow: false });
}

function car(parent, { x, z, w, d, height, colorIndex }) {
  const color = COLORS.cars[colorIndex % COLORS.cars.length];
  const bodyTop = CAR_CLEARANCE + CAR_BODY;
  for (const axle of [x + WHEEL_INSET, x + w - WHEEL_INSET]) cyl(parent, WHEEL_RADIUS, d + 0.04, [axle, WHEEL_RADIUS, z - 0.02], TIRE, { axis: "z" });
  box(parent, [w, CAR_BODY, d], [x, CAR_CLEARANCE, z], color);
  const cabinX = x + w * 0.22;
  const cabinW = w * 0.55;
  box(parent, [cabinW, height - bodyTop, d - 0.12], [cabinX, bodyTop, z + 0.06], shade(color, 0.12));
  box(parent, [cabinW - 0.12, height - bodyTop - 0.08, d - 0.08], [cabinX + 0.06, bodyTop + 0.02, z + 0.04], WINDOW, { shadow: false });
  box(parent, [0.02, 0.08, 0.2], [x + w, bodyTop - 0.14, z + 0.1], HEADLIGHT, { glow: true });
  box(parent, [0.02, 0.08, 0.2], [x + w, bodyTop - 0.14, z + d - 0.3], HEADLIGHT, { glow: true });
  box(parent, [0.02, 0.08, 0.2], [x - 0.02, bodyTop - 0.14, z + 0.1], TAILLIGHT, { glow: true });
  box(parent, [0.02, 0.08, 0.2], [x - 0.02, bodyTop - 0.14, z + d - 0.3], TAILLIGHT, { glow: true });
}

function flagpole(parent, { x, z, height, flagWidth }) {
  box(parent, [POLE_BASE, 0.12, POLE_BASE], [x - (POLE_BASE - POLE_WIDTH) / 2, GROUND, z - (POLE_BASE - POLE_WIDTH) / 2], "#9aa2b4");
  box(parent, [POLE_WIDTH, height, POLE_WIDTH], [x, 0, z], COLORS.pole);
  box(parent, [0.16, 0.16, 0.16], [x - 0.02, height, z - 0.02], "#e3c13b");
  box(parent, [FLAG_THICKNESS, FLAG_HEIGHT, flagWidth], [x + (POLE_WIDTH - FLAG_THICKNESS) / 2, height - FLAG_HEIGHT - 0.05, z + POLE_WIDTH], COLORS.flag);
}

function tree(parent, { x, z }) {
  const middle = (TREE_SPAN - TRUNK) / 2;
  box(parent, [TRUNK, TRUNK_HEIGHT, TRUNK], [x + middle, GROUND, z + middle], COLORS.trunk);
  let y = TRUNK_HEIGHT + GROUND;
  CANOPY.forEach(([span, height, lighter]) => {
    const inset = (TREE_SPAN - span) / 2;
    box(parent, [span, height, span], [x + inset, y, z + inset], shade(COLORS.leaves, lighter));
    y += height;
  });
}

function parkBench(parent, { x, z, w, d, height }) {
  box(parent, [w, 0.07, d], [x, height - 0.07, z], COLORS.bench);
  box(parent, [w, 0.3, 0.06], [x, height + 0.05, z + d - 0.06], shade(COLORS.bench, -0.1));
  for (const legX of [x + 0.1, x + w - 0.18]) box(parent, [0.08, height - 0.07, d - 0.06], [legX, 0, z + 0.03], "#3b3f47");
}

function entranceBushes(parent, depth) {
  for (const { x, w } of ENTRANCE_BUSHES) {
    box(parent, [w, BUSH_HEIGHT, BUSH_DEPTH], [x, GROUND, depth + BUSH_FROM_FACADE], BUSH);
  }
}

export function buildYard(parent, layout) {
  const { yard, bounds, size } = layout;
  lawn(parent, bounds);
  walkway(parent, yard.path);
  parkingLot(parent, yard.parking, yard.parkingStripes);
  yard.cars.forEach((item) => car(parent, item));
  flagpole(parent, yard.flagpole);
  yard.trees.forEach((item) => tree(parent, item));
  yard.benches.forEach((item) => parkBench(parent, item));
  entranceBushes(parent, size.D);
}
