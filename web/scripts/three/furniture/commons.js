import { box, cyl, group } from "../kit.js";
import { prop } from "./decor.js";
import { chair } from "./furniture.js";
import { DARK, rug } from "./parts.js";

const TABLE_TOP = 0.74;
const TABLE_W = 0.95;
const TABLE_D = 1.9;
const CHAIR_OFFSET_X = 0.82;
const CHAIR_ROWS_Z = [-0.45, 0.45];
const LAPTOP = "#c9ced6";
const COFFEE_TABLE_TOP = 0.38;

function laptop(g, x, z, lidX, theme, isScreenVisible) {
  box(g, [0.2, 0.015, 0.26], [x, TABLE_TOP, z], LAPTOP);
  box(g, [0.012, 0.17, 0.26], [lidX, TABLE_TOP, z], LAPTOP);
  if (isScreenVisible) box(g, [0.004, 0.14, 0.22], [lidX + 0.012, TABLE_TOP + 0.015, z + 0.02], theme.screen, { glow: true });
}

export function meetingSet(parent, cx, cz, theme) {
  const g = group(parent, cx, 0, cz);
  rug(g, -1.4, -1.3, 2.8, 2.6, theme.rug);
  box(g, [TABLE_W, 0.06, TABLE_D], [-TABLE_W / 2, TABLE_TOP - 0.06, -TABLE_D / 2], theme.desk);
  for (const z of [-0.65, 0.55]) box(g, [0.5, TABLE_TOP - 0.06, 0.1], [-0.25, 0, z], theme.leg);
  for (const side of [-1, 1]) {
    for (const z of CHAIR_ROWS_Z) chair(group(g, side * CHAIR_OFFSET_X, 0, z, -side * Math.PI / 2), theme);
  }
  laptop(g, -0.4, -0.58, -0.2, theme, false);
  laptop(g, 0.2, 0.32, 0.19, theme, true);
  cyl(g, 0.09, 0.03, [0, TABLE_TOP, 0], DARK);
  box(g, [0.03, 0.01, 0.03], [-0.015, TABLE_TOP + 0.03, -0.015], "#47e09b", { glow: true });
  box(g, [0.2, 0.01, 0.27], [-0.4, TABLE_TOP, 0.3], "#ffffff", { shadow: false });
  cyl(g, 0.04, 0.09, [0.3, TABLE_TOP, -0.42], theme.items[1]);
  return g;
}

export function loungeSet(parent, cx, z, theme, random) {
  const g = group(parent, cx, 0, z);
  rug(g, -1.15, -0.15, 2.3, 2.1, theme.rug);
  prop(g, "sofa", -0.8, 0, 0, theme, random);
  box(g, [0.9, 0.05, 0.5], [-0.45, COFFEE_TABLE_TOP - 0.05, 1.1], theme.desk);
  for (const [lx, lz] of [[-0.42, 1.13], [0.38, 1.13], [-0.42, 1.53], [0.38, 1.53]]) {
    box(g, [0.04, COFFEE_TABLE_TOP - 0.05, 0.04], [lx, 0, lz], theme.leg);
  }
  box(g, [0.22, 0.012, 0.3], [-0.32, COFFEE_TABLE_TOP, 1.18], theme.items[0]);
  cyl(g, 0.04, 0.09, [0.22, COFFEE_TABLE_TOP, 1.36], "#ffffff");
  return g;
}
