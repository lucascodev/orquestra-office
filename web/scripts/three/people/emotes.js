import { THREE } from "../kit.js";

const SIZE = 12;
const INK = "#1b1f2b";
const PAPER = "#ffffff";
const COLORS = { warn: "#b07a00", ok: "#2b8a4f", bad: "#d64545", info: "#2f6db0", soft: "#8a93a6" };
const DOT_XS = [2, 5, 8];

const diagonal = (p, points, color) => points.forEach(([x, y]) => p(x, y, 1, 2, color));

const ICONS = {
  dots: (p, frame) => DOT_XS.forEach((x, i) => p(x, 5, 2, 2, i === frame % DOT_XS.length ? INK : COLORS.soft)),
  alert: (p) => { p(5, 2, 2, 5, COLORS.warn); p(5, 8, 2, 2, COLORS.warn); },
  question: (p) => { p(4, 2, 4, 1, COLORS.info); p(7, 3, 2, 2, COLORS.info); p(5, 5, 2, 2, COLORS.info); p(5, 8, 2, 2, COLORS.info); },
  check: (p) => diagonal(p, [[2, 5], [3, 6], [4, 7], [5, 6], [6, 5], [7, 4], [8, 3], [9, 2]], COLORS.ok),
  cross: (p) => diagonal(p, [[3, 2], [4, 3], [5, 4], [6, 5], [7, 6], [8, 7], [8, 2], [7, 3], [6, 4], [5, 5], [4, 6], [3, 7]], COLORS.bad),
  zzz: (p, frame) => { const y = frame % 2; p(3, 3 - y + 1, 5, 1, COLORS.info); p(6, 4 - y + 1, 1, 1, COLORS.info); p(5, 5 - y + 1, 1, 1, COLORS.info); p(4, 6 - y + 1, 1, 1, COLORS.info); p(3, 7 - y + 1, 5, 1, COLORS.info); },
  terminal: (p, frame) => { p(2, 3, 1, 1, INK); p(3, 4, 1, 1, INK); p(4, 5, 1, 1, INK); p(3, 6, 1, 1, INK); p(2, 7, 1, 1, INK); if (frame % 2 === 0) p(6, 7, 4, 1, COLORS.ok); },
  globe: (p) => { p(4, 2, 4, 1, COLORS.info); p(2, 4, 1, 3, COLORS.info); p(9, 4, 1, 3, COLORS.info); p(3, 3, 1, 1, COLORS.info); p(8, 3, 1, 1, COLORS.info); p(3, 7, 1, 1, COLORS.info); p(8, 7, 1, 1, COLORS.info); p(4, 8, 4, 1, COLORS.info); p(3, 5, 6, 1, COLORS.info); p(5, 3, 2, 5, COLORS.info); },
  arrow: (p) => { p(2, 5, 6, 1, INK); p(6, 3, 1, 1, INK); p(7, 4, 1, 1, INK); p(8, 5, 1, 1, INK); p(7, 6, 1, 1, INK); p(6, 7, 1, 1, INK); },
  talk: (p, frame) => { p(2, 3, frame % 2 ? 8 : 6, 1, INK); p(2, 5, frame % 2 ? 5 : 8, 1, INK); p(2, 7, 6, 1, COLORS.soft); },
  list: (p) => [3, 5, 7].forEach((y, i) => { p(2, y, 1, 1, i === 0 ? COLORS.ok : COLORS.soft); p(4, y, 6, 1, INK); }),
};

function drawEmote(canvas, name, frame) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, SIZE, SIZE);
  const p = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  p(1, 0, 10, 11, INK);
  p(0, 1, 12, 9, INK);
  p(1, 1, 10, 9, PAPER);
  p(5, 10, 2, 2, INK);
  ICONS[name](p, frame);
}

export function createEmote(parent) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.scale.set(0.34, 0.34, 1);
  sprite.renderOrder = 10;
  sprite.visible = false;
  parent.add(sprite);
  let drawn = "";

  return {
    sprite,
    show(name, frame) {
      sprite.visible = Boolean(name && ICONS[name]);
      const key = `${name}|${frame}`;
      if (!sprite.visible || key === drawn) return;
      drawn = key;
      drawEmote(canvas, name, frame);
      texture.needsUpdate = true;
    },
  };
}
