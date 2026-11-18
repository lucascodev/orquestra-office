import { box, cyl, group, shade } from "./kit.js";
import { cabinet, DARK, HANDLE, plant } from "./parts.js";

const GLASS = "#bfe6ff";
const METAL = "#d0d4dc";
const EXIT_GREEN = "#2fbf71";
const APPLIANCE = "#e3e7ee";
const RECYCLING = ["#3a6ab0", "#e3c13b", "#47b85e"];
const FULL_HEIGHT_WALL = 2.4;

const pickOf = (list, random) => list[Math.floor(random() * list.length)];

function gate(g, w, color) {
  const post = shade(color, -0.25);
  box(g, [0.1, 1.0, 0.1], [0, 0, 0.02], post);
  box(g, [0.1, 1.0, 0.1], [w - 0.1, 0, 0.02], post);
  for (const y of [0.25, 0.7]) box(g, [w - 0.2, 0.07, 0.04], [0.1, y, 0.05], post);
  for (let x = 0.16; x < w - 0.2; x += 0.16) box(g, [0.08, 0.8, 0.03], [x, 0.1, 0.08], color);
}

function fireExtinguisher(g, x) {
  cyl(g, 0.07, 0.34, [x, 0.75, 0.09], "#e04848");
  box(g, [0.05, 0.08, 0.05], [x - 0.025, 1.09, 0.065], DARK);
}

function door(g, theme, w) {
  if (theme.wallHeight < FULL_HEIGHT_WALL) {
    gate(g, w, theme.door);
    return;
  }
  box(g, [w, 2.14, 0.05], [0, 0, 0.01], shade(theme.door, -0.35));
  box(g, [w - 0.14, 2.06, 0.03], [0.07, 0, 0.05], theme.door);
  box(g, [0.3, 0.6, 0.01], [0.16, 1.3, 0.08], GLASS, { glow: true });
  box(g, [0.05, 0.05, 0.07], [w - 0.26, 1.0, 0.08], METAL, { shadow: false });
  box(g, [0.16, 0.035, 0.03], [w - 0.37, 1.01, 0.13], METAL, { shadow: false });
  box(g, [0.44, 0.17, 0.04], [w / 2 - 0.22, 2.24, 0.01], EXIT_GREEN, { glow: true });
  box(g, [0.2, 0.04, 0.005], [w / 2 - 0.1, 2.3, 0.05], "#ffffff", { glow: true });
  box(g, [w - 0.1, 0.02, 0.5], [0.05, 0, 0.12], "#3a3f4a", { shadow: false });
  fireExtinguisher(g, w + 0.17);
}

function recyclingBins(g) {
  RECYCLING.forEach((color, i) => {
    const x = 0.12 + i * 0.34;
    box(g, [0.28, 0.5, 0.3], [x, 0, 0.04], color);
    box(g, [0.3, 0.05, 0.32], [x - 0.01, 0.5, 0.03], shade(color, -0.25));
    box(g, [0.16, 0.03, 0.01], [x + 0.06, 0.4, 0.34], DARK, { shadow: false });
  });
}

function airConditioner(g, theme, w) {
  box(g, [w - 0.2, 0.3, 0.22], [0.1, 2.12, 0.01], "#f4f6f8");
  box(g, [w - 0.3, 0.04, 0.02], [0.15, 2.15, 0.23], "#c9ced6", { shadow: false });
  box(g, [0.05, 0.03, 0.01], [w - 0.25, 2.33, 0.23], "#47e09b", { glow: true });
  recyclingBins(g);
}

function tv(g, theme, w) {
  const screenW = w - 0.2;
  box(g, [screenW, 0.9, 0.06], [0.1, 1.15, 0.01], DARK);
  box(g, [screenW - 0.1, 0.8, 0.01], [0.15, 1.2, 0.07], "#1d2333", { glow: true });
  box(g, [screenW - 0.4, 0.035, 0.005], [0.25, 1.9, 0.08], "#ffffff", { glow: true });
  theme.items.slice(0, 5).forEach((color, i) => {
    box(g, [0.14, 0.16 + ((i * 7) % 5) * 0.1, 0.005], [0.3 + i * 0.22, 1.27, 0.08], color, { glow: true });
  });
}

function corkboard(g, theme, w, random) {
  box(g, [w, 1.0, 0.04], [0, 1.2, 0.01], "#8a5a3a");
  box(g, [w - 0.1, 0.9, 0.01], [0.05, 1.25, 0.05], "#c99a5b", { shadow: false });
  let x = 0.12;
  while (x < w - 0.36) {
    const size = 0.14 + random() * 0.1;
    const color = random() > 0.4 ? pickOf(theme.items, random) : "#ffffff";
    box(g, [size, size * (random() > 0.5 ? 1.3 : 1), 0.005], [x, 1.32 + random() * 0.45, 0.06], color, { shadow: false });
    x += size + 0.05 + random() * 0.08;
  }
}

function frames(g, theme) {
  [[0.05, 1.4, 0.4, 0.55], [0.55, 1.55, 0.36, 0.4], [1.0, 1.35, 0.42, 0.6]].forEach(([x, y, fw, fh], i) => {
    box(g, [fw, fh, 0.03], [x, y, 0.01], DARK);
    box(g, [fw - 0.08, fh - 0.08, 0.005], [x + 0.04, y + 0.04, 0.04], "#ffffff", { shadow: false });
    box(g, [fw - 0.2, fh - 0.24, 0.005], [x + 0.1, y + 0.12, 0.046], theme.items[i], { shadow: false });
  });
}

function filing(g, theme, w, random) {
  const unit = 0.42;
  const height = 1.3;
  const top = height + 0.08;
  const count = Math.floor(w / unit);
  for (let i = 0; i < count; i += 1) {
    cabinet(group(g, 0.02 + i * unit, 0, 0.02), unit - 0.02, height, 0.5, i % 2 ? shade(theme.cabinet, -0.08) : theme.cabinet);
  }
  box(g, [0.34, 0.22, 0.3], [0.08, top, 0.1], "#c9a46a");
  theme.items.slice(0, 4).forEach((color, i) => box(g, [0.06, 0.28, 0.24], [0.52 + i * 0.07, top, 0.12], color));
  plant(g, w - 0.24, 0.27, 0.6, random).position.y = top;
}

function copier(g, theme) {
  box(g, [0.8, 0.8, 0.6], [0.32, 0, 0.03], APPLIANCE);
  for (const y of [0.2, 0.4]) {
    box(g, [0.72, 0.012, 0.01], [0.36, y, 0.63], shade(APPLIANCE, -0.3), { shadow: false });
    box(g, [0.24, 0.025, 0.02], [0.6, y - 0.1, 0.63], HANDLE, { shadow: false });
  }
  box(g, [0.84, 0.1, 0.62], [0.3, 0.8, 0.02], "#3a3f4a");
  box(g, [0.24, 0.04, 0.14], [0.84, 0.9, 0.46], DARK);
  box(g, [0.1, 0.01, 0.07], [0.87, 0.94, 0.5], theme.screen, { glow: true });
  box(g, [0.28, 0.03, 0.34], [0.06, 0.58, 0.16], APPLIANCE);
  box(g, [0.22, 0.015, 0.26], [0.1, 0.61, 0.2], "#ffffff", { shadow: false });
}

function copa(g, theme, w) {
  const counterW = w - 0.2;
  const top = 0.9;
  cabinet(group(g, 0.1, 0, 0.02), counterW, top - 0.08, 0.55, theme.cabinet);
  box(g, [0.3, 0.4, 0.3], [0.2, top, 0.1], "#2b2f3a");
  box(g, [0.2, 0.05, 0.08], [0.25, top + 0.22, 0.4], "#c9ced6");
  box(g, [0.1, 0.1, 0.1], [0.3, top, 0.4], "#ffffff");
  box(g, [0.44, 0.28, 0.32], [0.62, top, 0.1], "#d8dde5");
  box(g, [0.28, 0.2, 0.01], [0.65, top + 0.04, 0.42], DARK, { shadow: false });
  box(g, [0.06, 0.2, 0.01], [0.97, top + 0.04, 0.42], HANDLE, { shadow: false });
  for (let i = 0; i < 3; i += 1) cyl(g, 0.04, 0.09, [1.2 + i * 0.11, top, 0.3], theme.items[i]);
  if (theme.wallHeight < FULL_HEIGHT_WALL) return;
  box(g, [counterW, 0.5, 0.3], [0.1, 1.65, 0.01], theme.cabinet);
  for (let i = 1; i < 3; i += 1) box(g, [0.012, 0.44, 0.01], [0.1 + (counterW * i) / 3, 1.68, 0.31], shade(theme.cabinet, -0.3), { shadow: false });
  for (let i = 0; i < 3; i += 1) box(g, [0.03, 0.12, 0.02], [0.1 + (counterW * (i + 0.8)) / 3, 1.72, 0.31], HANDLE, { shadow: false });
}

export const OFFICE_WALL = { door, ac: airConditioner, tv, corkboard, frames, filing, copier, copa };
