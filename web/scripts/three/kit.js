import * as THREE from "../../vendor/three.module.min.js";

export { THREE };

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_CYLINDER = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
const materials = new Map();
const textures = new Map();

export function mat(color, glow = false) {
  const key = `${color}|${glow}`;
  if (!materials.has(key)) {
    materials.set(key, glow ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshLambertMaterial({ color }));
  }
  return materials.get(key);
}

function place(parent, mesh, glow, shadow) {
  mesh.castShadow = shadow && !glow;
  mesh.receiveShadow = !glow;
  parent.add(mesh);
  return mesh;
}

export function box(parent, [w, h, d], [x, y, z], color, { glow = false, shadow = true } = {}) {
  const mesh = new THREE.Mesh(UNIT_BOX, mat(color, glow));
  mesh.scale.set(w, h, d);
  mesh.position.set(x + w / 2, y + h / 2, z + d / 2);
  return place(parent, mesh, glow, shadow);
}

export function cyl(parent, radius, height, [cx, y, cz], color, { glow = false, shadow = true, axis = "y" } = {}) {
  const mesh = new THREE.Mesh(UNIT_CYLINDER, mat(color, glow));
  mesh.scale.set(radius * 2, height, radius * 2);
  if (axis === "z") mesh.rotation.x = Math.PI / 2;
  mesh.position.set(cx, y + (axis === "y" ? height / 2 : 0), cz + (axis === "z" ? height / 2 : 0));
  return place(parent, mesh, glow, shadow);
}

export function group(parent, x = 0, y = 0, z = 0, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  parent.add(g);
  return g;
}

export function shade(hex, amount) {
  const n = parseInt(hex.slice(1, 7), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * (1 + amount))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, "0")).join("")}`;
}

const CELL_PX = 16;
const PATTERN_CELLS = 2;
const PATTERN_PX = CELL_PX * PATTERN_CELLS;
const ROW_PX = CELL_PX / 2;
const PLANK_JOINTS = [0, 16, 8, 24];
const SPECKLES = [[3, 5], [11, 2], [20, 7], [27, 3], [6, 14], [15, 12], [24, 15], [30, 11], [2, 22], [10, 19], [18, 24], [26, 21], [5, 29], [13, 27], [22, 30], [29, 26]];

const PATTERNS = {
  plain: () => {},
  grid: (ctx) => {
    for (let at = 0; at < PATTERN_PX; at += CELL_PX) {
      ctx.fillRect(0, at, PATTERN_PX, 1);
      ctx.fillRect(at, 0, 1, PATTERN_PX);
    }
  },
  plank: (ctx) => {
    PLANK_JOINTS.forEach((joint, row) => {
      ctx.fillRect(0, row * ROW_PX, PATTERN_PX, 1);
      ctx.fillRect(joint, row * ROW_PX, 1, ROW_PX);
    });
  },
  brick: (ctx) => {
    for (let row = 0; row < PATTERN_PX / ROW_PX; row += 1) {
      ctx.fillRect(0, row * ROW_PX, PATTERN_PX, 1);
      for (let joint = row % 2 ? ROW_PX : 0; joint < PATTERN_PX; joint += CELL_PX) ctx.fillRect(joint, row * ROW_PX, 1, ROW_PX);
    }
  },
  speckle: (ctx) => {
    for (const [x, y] of SPECKLES) ctx.fillRect(x, y, 1, 2);
  },
};

function patternTexture({ pattern = "grid", base, line }) {
  const key = `${pattern}|${base}|${line}`;
  if (!textures.has(key)) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = PATTERN_PX;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, PATTERN_PX, PATTERN_PX);
    ctx.fillStyle = line;
    (PATTERNS[pattern] ?? PATTERNS.grid)(ctx);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.set(key, texture);
  }
  return textures.get(key);
}

export function tiledSlab(parent, [w, h, d], [x, y, z], surface, cellsU, cellsV) {
  const texture = patternTexture(surface).clone();
  texture.needsUpdate = true;
  texture.repeat.set(cellsU / PATTERN_CELLS, cellsV / PATTERN_CELLS);
  const mesh = new THREE.Mesh(UNIT_BOX, new THREE.MeshLambertMaterial({ map: texture }));
  mesh.scale.set(w, h, d);
  mesh.position.set(x + w / 2, y + h / 2, z + d / 2);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
