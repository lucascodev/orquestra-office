import { SOFA_WIDTH } from "../../domain/room/room-dimensions.js";
import { box, cyl, group, shade } from "../kit.js";
import { OFFICE_WALL } from "./office-walls.js";
import { cabinet, DARK, GREENS, plant, POT } from "./parts.js";

const SOFA_ARM = 0.18;

function shelfRow(g, y, w, d, gap, theme, random) {
  let x = 0.07;
  while (x < w - 0.2) {
    const roll = random();
    const color = () => theme.items[Math.floor(random() * theme.items.length)];
    if (roll < 0.55) {
      const count = 2 + Math.floor(random() * 5);
      for (let i = 0; i < count && x < w - 0.12; i += 1) {
        const bw = 0.045 + random() * 0.035;
        box(g, [bw, gap * (0.6 + random() * 0.28), d * 0.62], [x, y, d * 0.22], color(), { shadow: false });
        x += bw + 0.006;
      }
    } else if (roll < 0.85) {
      const bw = 0.16 + random() * 0.14;
      box(g, [bw, gap * (0.35 + random() * 0.35), d * 0.7], [x, y, d * 0.18], color(), { shadow: false });
      x += bw;
    } else {
      box(g, [0.1, 0.08, 0.1], [x, y, d * 0.4], POT, { shadow: false });
      box(g, [0.16, 0.14, 0.14], [x - 0.03, y + 0.08, d * 0.36], GREENS[Math.floor(random() * 4)], { shadow: false });
      x += 0.16;
    }
    x += 0.03 + random() * 0.08;
  }
}

export function shelfUnit(parent, x, z, rotY, w, h, theme, random) {
  const d = 0.42;
  const gap = 0.4;
  const g = group(parent, x, 0, z, rotY);
  box(g, [w, h, 0.03], [0, 0, 0], shade(theme.shelf, -0.1));
  box(g, [0.04, h, d], [0, 0, 0], theme.shelf);
  box(g, [0.04, h, d], [w - 0.04, 0, 0], theme.shelf);
  for (let y = 0.06; y <= h - 0.02; y += gap) {
    box(g, [w, 0.035, d], [0, y, 0], theme.shelf);
    if (y + gap <= h) shelfRow(g, y + 0.035, w, d, gap - 0.04, theme, random);
  }
  box(g, [w, 0.04, d], [0, h, 0], theme.shelf);
  plant(g, 0.3 + random() * 0.2, d / 2, 0.75, random).position.y = h + 0.04;
  if (w > 1.6) {
    box(g, [0.34, 0.2, 0.3], [w - 0.9, h + 0.04, 0.06], theme.items[Math.floor(random() * theme.items.length)]);
    plant(g, w - 0.3, d / 2, 0.6, random).position.y = h + 0.04;
  }
  return g;
}

const PROPS = {
  plant: (g, theme, random) => plant(g, 0.3, 0.3, 1.2, random),
  bigPlant: (g, theme, random) => plant(g, 0.35, 0.35, 1.9, random),
  cabinet: (g, theme, random) => {
    cabinet(g, 1.0, 0.7, 0.5, theme.cabinet);
    box(g, [0.3, 0.16, 0.24], [0.1, 0.78, 0.12], theme.items[2]);
    box(g, [0.22, 0.02, 0.3], [0.6, 0.78, 0.1], "#ffffff");
    if (random() > 0.4) cyl(g, 0.04, 0.1, [0.5, 0.78, 0.3], theme.items[1]);
  },
  boxes: (g, theme, random) => {
    box(g, [0.5, 0.34, 0.42], [0, 0, 0], "#c9a46a");
    box(g, [0.5, 0.02, 0.06], [0, 0.34, 0.18], "#e8d9b8");
    box(g, [0.38, 0.28, 0.34], [0.06 + random() * 0.08, 0.36, 0.04], "#d8b47a");
    box(g, [0.34, 0.24, 0.3], [0.56, 0, 0.1], "#b8935a");
  },
  suitcase: (g) => {
    box(g, [0.36, 0.62, 0.22], [0, 0.05, 0], "#ff7aa8");
    box(g, [0.36, 0.02, 0.23], [0, 0.36, 0], "#e05a8a");
    box(g, [0.14, 0.14, 0.03], [0.11, 0.67, 0.1], DARK);
    cyl(g, 0.03, 0.05, [0.06, 0, 0.11], DARK);
    cyl(g, 0.03, 0.05, [0.3, 0, 0.11], DARK);
  },
  cooler: (g) => {
    box(g, [0.34, 0.9, 0.34], [0, 0, 0], "#e8ecf3");
    cyl(g, 0.13, 0.36, [0.17, 0.9, 0.17], "#8fd0ff");
    box(g, [0.08, 0.05, 0.04], [0.13, 0.62, 0.34], "#5b8cff");
  },
  coatRack: (g, theme) => {
    cyl(g, 0.16, 0.04, [0.2, 0, 0.2], DARK);
    box(g, [0.04, 1.7, 0.04], [0.18, 0.04, 0.18], DARK);
    box(g, [0.36, 0.03, 0.03], [0.02, 1.62, 0.185], DARK);
    box(g, [0.03, 0.03, 0.36], [0.185, 1.62, 0.02], DARK);
    box(g, [0.14, 0.6, 0.2], [0.02, 1.0, 0.1], theme.items[0]);
    box(g, [0.2, 0.1, 0.2], [0.1, 1.74, 0.1], theme.items[1]);
  },
  printer: (g, theme) => {
    cabinet(g, 0.8, 0.5, 0.7, theme.cabinet);
    for (const [px, pz] of [[0.06, 0.06], [0.7, 0.06], [0.06, 0.6], [0.7, 0.6]]) box(g, [0.04, 0.8, 0.04], [px, 0.58, pz], DARK);
    box(g, [0.68, 0.04, 0.04], [0.06, 1.34, 0.06], DARK);
    box(g, [0.68, 0.04, 0.04], [0.06, 1.34, 0.6], DARK);
    box(g, [0.04, 0.04, 0.58], [0.06, 1.34, 0.06], DARK);
    box(g, [0.04, 0.04, 0.58], [0.7, 1.34, 0.06], DARK);
    box(g, [0.56, 0.03, 0.5], [0.12, 0.64, 0.1], "#3a3f4a");
    box(g, [0.16, 0.2, 0.16], [0.32, 0.67, 0.27], theme.accent);
    box(g, [0.6, 0.05, 0.08], [0.1, 1.1, 0.3], "#555a66");
    box(g, [0.1, 0.12, 0.1], [0.35, 0.98, 0.29], "#e85a3a");
  },
  sofa: (g, theme) => {
    const c = theme.items[1];
    box(g, [SOFA_WIDTH, 0.34, 0.7], [0, 0.06, 0], c);
    box(g, [SOFA_WIDTH, 0.5, 0.2], [0, 0.4, 0], shade(c, -0.12));
    box(g, [SOFA_ARM, 0.2, 0.7], [0, 0.4, 0], shade(c, -0.2));
    box(g, [SOFA_ARM, 0.2, 0.7], [SOFA_WIDTH - SOFA_ARM, 0.4, 0], shade(c, -0.2));
    box(g, [0.4, 0.14, 0.3], [0.3, 0.4, 0.22], theme.items[4]);
  },
  coffeeBar: (g, theme) => {
    cabinet(g, 1.4, 0.86, 0.55, theme.cabinet);
    box(g, [0.4, 0.44, 0.36], [0.12, 0.94, 0.1], "#3a3a3a");
    box(g, [0.3, 0.1, 0.08], [0.17, 1.2, 0.46], "#c9ced6");
    box(g, [0.1, 0.1, 0.1], [0.27, 0.94, 0.4], "#ffffff");
    for (let i = 0; i < 3; i += 1) cyl(g, 0.04, 0.09, [0.75 + i * 0.16, 0.94, 0.3], "#ffffff");
  },
  armchair: (g) => {
    box(g, [0.8, 0.3, 0.74], [0, 0.06, 0], "#7a2a2a");
    box(g, [0.8, 0.52, 0.2], [0, 0.36, 0], "#923636");
    box(g, [0.16, 0.24, 0.74], [0, 0.36, 0], "#5a1e1e");
    box(g, [0.16, 0.24, 0.74], [0.64, 0.36, 0], "#5a1e1e");
  },
  globe: (g) => {
    box(g, [0.4, 0.7, 0.4], [0, 0, 0], "#4a2f1e");
    cyl(g, 0.03, 0.14, [0.2, 0.7, 0.2], "#e3c13b");
    box(g, [0.34, 0.34, 0.34], [0.03, 0.84, 0.03], "#3a6ab0");
    box(g, [0.36, 0.14, 0.2], [0.02, 0.96, 0.05], "#3a9a5a");
    box(g, [0.16, 0.18, 0.36], [0.16, 0.88, 0.02], "#3a9a5a");
  },
  lamp: (g) => {
    cyl(g, 0.16, 0.04, [0.2, 0, 0.2], "#4a2f1e");
    box(g, [0.04, 1.5, 0.04], [0.18, 0.04, 0.18], "#4a2f1e");
    box(g, [0.4, 0.3, 0.4], [0, 1.5, 0], "#f2d27a", { glow: true });
  },
  tires: (g) => {
    for (let i = 0; i < 3; i += 1) { cyl(g, 0.3, 0.18, [0.32, i * 0.19, 0.32], "#1d1d1d"); cyl(g, 0.14, 0.02, [0.32, i * 0.19 + 0.18, 0.32], "#8d9097"); }
  },
  barrel: (g) => {
    cyl(g, 0.26, 0.86, [0.28, 0, 0.28], "#2b5ab0");
    cyl(g, 0.275, 0.05, [0.28, 0.2, 0.28], "#1d3d7a");
    cyl(g, 0.275, 0.05, [0.28, 0.62, 0.28], "#1d3d7a");
  },
  robot: (g) => {
    box(g, [0.36, 0.44, 0.3], [0.02, 0.16, 0.02], "#8d97a8");
    box(g, [0.14, 0.16, 0.2], [0, 0, 0.07], "#3a4456");
    box(g, [0.14, 0.16, 0.2], [0.26, 0, 0.07], "#3a4456");
    box(g, [0.32, 0.26, 0.28], [0.04, 0.62, 0.03], "#c9d1de");
    box(g, [0.07, 0.07, 0.01], [0.09, 0.72, 0.31], "#6fc3ff", { glow: true });
    box(g, [0.07, 0.07, 0.01], [0.24, 0.72, 0.31], "#6fc3ff", { glow: true });
    box(g, [0.03, 0.14, 0.03], [0.185, 0.88, 0.15], "#8d97a8");
    box(g, [0.07, 0.07, 0.07], [0.165, 1.0, 0.13], "#ff6b6b", { glow: true });
  },
  tank: (g) => {
    cyl(g, 0.22, 1.5, [0.25, 0, 0.25], "#e8ecf3");
    cyl(g, 0.23, 0.14, [0.25, 1.2, 0.25], "#ff6b6b");
    cyl(g, 0.08, 0.14, [0.25, 1.5, 0.25], "#8d97a8");
  },
  tree: (g, theme, random) => {
    box(g, [0.18, 1.0, 0.18], [0.36, 0, 0.36], "#6a4a2a");
    box(g, [0.9, 0.7, 0.9], [0, 0.9, 0], "#3f8a36");
    box(g, [0.66, 0.4, 0.66], [0.12, 1.55, 0.12], "#4aa040");
    box(g, [0.5, 0.36, 0.3], [0.6, 1.1, 0.5], "#4aa040");
    for (let i = 0; i < 4; i += 1) box(g, [0.1, 0.1, 0.1], [random() * 0.8, 1 + random() * 0.6, 0.86], "#ff6b6b");
  },
  flowers: (g, theme, random) => {
    box(g, [1.2, 0.24, 0.44], [0, 0, 0], "#8a5a3a");
    box(g, [1.12, 0.04, 0.36], [0.04, 0.24, 0.04], "#4a3020");
    for (let i = 0; i < 7; i += 1) {
      const fx = 0.1 + i * 0.15;
      box(g, [0.03, 0.2, 0.03], [fx + 0.03, 0.26, 0.2], "#3f8a36");
      box(g, [0.1, 0.1, 0.1], [fx, 0.44 + random() * 0.08, 0.16], theme.items[i % 5]);
    }
  },
  bench: (g) => {
    box(g, [1.4, 0.07, 0.42], [0, 0.4, 0], "#8a5a3a");
    box(g, [1.4, 0.34, 0.06], [0, 0.55, 0], "#8a5a3a");
    box(g, [0.08, 0.4, 0.4], [0.1, 0, 0.01], "#5a3a24");
    box(g, [0.08, 0.4, 0.4], [1.22, 0, 0.01], "#5a3a24");
  },
  arcade: (g, theme) => {
    box(g, [0.7, 1.0, 0.66], [0, 0, 0], "#3a1f6a");
    box(g, [0.7, 0.8, 0.44], [0, 1.0, 0], "#3a1f6a");
    box(g, [0.56, 0.44, 0.02], [0.07, 1.2, 0.44], theme.items[1], { glow: true });
    box(g, [0.3, 0.05, 0.02], [0.12, 1.5, 0.455], "#ffffff", { glow: true });
    box(g, [0.2, 0.1, 0.02], [0.3, 1.3, 0.455], theme.items[2], { glow: true });
    box(g, [0.7, 0.14, 0.03], [0, 1.82, 0.44], theme.accent, { glow: true });
    box(g, [0.06, 0.1, 0.06], [0.16, 1.0, 0.52], "#ff6b6b");
    cyl(g, 0.035, 0.03, [0.42, 1.0, 0.56], theme.items[2]);
    cyl(g, 0.035, 0.03, [0.54, 1.0, 0.56], theme.items[0]);
  },
};

export function prop(parent, name, x, z, rotY, theme, random) {
  const g = group(parent, x, 0, z, rotY);
  (PROPS[name] ?? PROPS.plant)(g, theme, random);
  return g;
}

const BLIND_SLATS = 4;

const WALL = {
  ...OFFICE_WALL,
  cooler: (g, theme, w) => PROPS.cooler(group(g, (w - 0.34) / 2, 0, 0.04)),
  clock: (g) => {
    cyl(g, 0.26, 0.05, [0.5, 1.9, 0.01], DARK, { axis: "z" });
    cyl(g, 0.21, 0.02, [0.5, 1.9, 0.05], "#ffffff", { axis: "z", shadow: false });
    box(g, [0.025, 0.16, 0.01], [0.488, 1.9, 0.07], DARK, { shadow: false });
    box(g, [0.12, 0.025, 0.01], [0.5, 1.888, 0.07], DARK, { shadow: false });
  },
  board: (g, theme, w) => {
    box(g, [w, 1.0, 0.04], [0, 1.2, 0.01], "#8a96a3");
    box(g, [w - 0.1, 0.9, 0.01], [0.05, 1.25, 0.05], "#ffffff", { shadow: false });
    [["#5b8cff", 0.6, 1.9], ["#f07a4a", 0.8, 1.7], ["#47e09b", 0.4, 1.5]].forEach(([c, len, y]) => box(g, [w * len * 0.8, 0.06, 0.005], [0.15, y, 0.06], c, { shadow: false }));
    box(g, [0.24, 0.24, 0.005], [w - 0.45, 1.36, 0.06], "#ffe066", { shadow: false });
  },
  chalkboard: (g, theme, w) => {
    box(g, [w, 1.0, 0.04], [0, 1.2, 0.01], "#7a4a2a");
    box(g, [w - 0.1, 0.9, 0.01], [0.05, 1.25, 0.05], "#2f3a33", { shadow: false });
    [[0.5, 1.9], [0.7, 1.7], [0.35, 1.5]].forEach(([len, y]) => box(g, [w * len * 0.8, 0.05, 0.005], [0.15, y, 0.06], "#e8e8e8", { shadow: false }));
  },
  window: (g, theme, w, random) => {
    box(g, [w, 1.3, 0.05], [0, 1.0, 0.01], "#8a96a3");
    box(g, [w - 0.12, 1.18, 0.01], [0.06, 1.06, 0.06], "#bfe6ff", { glow: true });
    for (let x = 0.08; x < w - 0.26; x += 0.2) {
      box(g, [0.17, 0.2 + random() * 0.4, 0.003], [x, 1.06, 0.07], "#9cc9e8", { glow: true });
    }
    for (let i = 0; i < BLIND_SLATS; i += 1) {
      box(g, [w - 0.12, 0.05, 0.02], [0.06, 2.19 - i * 0.07, 0.075], "#f4f6f8", { shadow: false });
    }
    box(g, [0.05, 1.18, 0.02], [w / 2 - 0.025, 1.06, 0.06], "#8a96a3", { shadow: false });
    box(g, [w - 0.12, 0.05, 0.02], [0.06, 1.62, 0.06], "#8a96a3", { shadow: false });
    box(g, [w + 0.1, 0.05, 0.14], [-0.05, 0.96, 0.01], "#c9ced6");
  },
  pegboard: (g, theme, w) => {
    box(g, [w, 1.0, 0.04], [0, 1.2, 0.01], "#c9a46a");
    box(g, [0.06, 0.6, 0.03], [0.2, 1.4, 0.05], "#d0d4dc");
    box(g, [0.4, 0.08, 0.03], [0.4, 1.9, 0.05], "#d0d4dc");
    box(g, [0.08, 0.5, 0.03], [w - 0.4, 1.5, 0.05], "#e85a3a");
    box(g, [0.3, 0.3, 0.03], [0.5, 1.4, 0.05], "#3e4148");
  },
  shutter: (g, theme, w) => {
    box(g, [w, 2.2, 0.06], [0, 0, 0.01], "#6c717a");
    for (let y = 0.15; y < 2.2; y += 0.2) box(g, [w, 0.03, 0.02], [0, y, 0.07], "#555a62", { shadow: false });
  },
  porthole: (g) => {
    cyl(g, 0.5, 0.06, [0.7, 1.6, 0.01], "#8d97a8", { axis: "z" });
    cyl(g, 0.4, 0.02, [0.7, 1.6, 0.06], "#05070d", { axis: "z", shadow: false });
    cyl(g, 0.14, 0.01, [0.8, 1.52, 0.08], "#b28cff", { axis: "z", glow: true });
    box(g, [0.03, 0.03, 0.005], [0.5, 1.75, 0.085], "#ffffff", { glow: true });
    box(g, [0.03, 0.03, 0.005], [0.86, 1.82, 0.085], "#ffffff", { glow: true });
  },
  console: (g, theme, w) => {
    box(g, [w, 1.0, 0.08], [0, 1.1, 0.01], "#0b0d13");
    [["#47e09b", 0.8, 1.85], ["#6fc3ff", 0.5, 1.65], ["#47e09b", 0.65, 1.45], ["#ff6b6b", 0.2, 1.25]].forEach(([c, len, y]) => box(g, [(w - 0.3) * len, 0.07, 0.005], [0.15, y, 0.09], c, { glow: true }));
  },
  neon: (g, theme, w) => {
    const c = theme.accent;
    box(g, [w, 0.04, 0.03], [0, 2.1, 0.02], c, { glow: true });
    box(g, [w, 0.04, 0.03], [0, 1.3, 0.02], c, { glow: true });
    box(g, [0.04, 0.84, 0.03], [0, 1.3, 0.02], c, { glow: true });
    box(g, [0.04, 0.84, 0.03], [w - 0.04, 1.3, 0.02], c, { glow: true });
    theme.items.slice(1, 4).forEach((color, i) => box(g, [0.26, 0.5, 0.02], [0.2 + i * 0.42, 1.46, 0.02], color, { glow: true }));
  },
  arcade: (g, theme) => PROPS.arcade(group(g, 0.3, 0, 0.02), theme),
  hedge: (g, theme, w, random) => {
    box(g, [w, 0.9, 0.5], [0, 0, 0.02], "#3f8a36");
    for (let i = 0; i < 4; i += 1) box(g, [0.4 + random() * 0.3, 0.3, 0.4], [random() * (w - 0.7), 0.8, 0.06], "#4aa040");
    for (let i = 0; i < 5; i += 1) box(g, [0.09, 0.09, 0.04], [0.1 + random() * (w - 0.3), 0.2 + random() * 0.6, 0.52], theme.items[i % 4]);
  },
};

export function wallItem(parent, name, x, z, rotY, width, theme, random) {
  const g = group(parent, x, 0, z, rotY);
  (WALL[name] ?? WALL.board)(g, theme, width, random);
  return g;
}
