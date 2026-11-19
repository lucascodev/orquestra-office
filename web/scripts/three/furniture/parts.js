import { box, group, shade } from "../kit.js";

export const DARK = "#22252e";
const POT = "#c0663a";
const GREENS = ["#3f9a52", "#47b85e", "#57c46a", "#358a48"];
export const HANDLE = "#8a96a3";

const RUG_HEIGHT = 0.014;
const RUG_BORDER = 0.08;

export function plant(parent, x, z, size, random) {
  const g = group(parent, x, 0, z);
  const pot = 0.22 * size;
  box(g, [pot, pot * 0.9, pot], [-pot / 2, 0, -pot / 2], POT);
  box(g, [pot * 1.15, pot * 0.2, pot * 1.15], [-pot * 0.575, pot * 0.8, -pot * 0.575], shade(POT, -0.15));
  const fronds = 6 + Math.floor(random() * 3);
  for (let i = 0; i < fronds; i += 1) {
    const arm = group(g, 0, pot, 0, (i / fronds) * Math.PI * 2 + random());
    const length = (0.34 + random() * 0.3) * size;
    const leaf = box(arm, [0.09 * size, length, 0.035 * size], [-0.045 * size, 0, 0], GREENS[i % GREENS.length]);
    leaf.rotation.x = 0.35 + random() * 0.45;
    leaf.position.z += Math.sin(leaf.rotation.x) * length / 2;
    leaf.position.y -= (1 - Math.cos(leaf.rotation.x)) * length / 2;
  }
  box(g, [0.08 * size, 0.5 * size, 0.08 * size], [-0.04 * size, pot, -0.04 * size], GREENS[1]);
  return g;
}

export function cabinet(g, w, h, d, color) {
  box(g, [w, h, d], [0, 0.04, 0], color);
  box(g, [w + 0.03, 0.04, d + 0.03], [-0.015, h + 0.04, -0.015], shade(color, -0.12));
  const rows = Math.max(2, Math.round(h / 0.26));
  for (let i = 0; i < rows; i += 1) {
    const y = 0.04 + (i * h) / rows;
    box(g, [w - 0.06, 0.012, 0.01], [0.03, y + h / rows - 0.02, d], shade(color, -0.3), { shadow: false });
    box(g, [0.14, 0.025, 0.02], [w / 2 - 0.07, y + h / rows / 2, d], HANDLE, { shadow: false });
  }
}

export function rug(parent, x, z, w, d, color) {
  box(parent, [w, RUG_HEIGHT, d], [x, 0, z], shade(color, -0.2), { shadow: false });
  box(parent, [w - RUG_BORDER * 2, RUG_HEIGHT, d - RUG_BORDER * 2], [x + RUG_BORDER, 0.004, z + RUG_BORDER], color, { shadow: false });
}
