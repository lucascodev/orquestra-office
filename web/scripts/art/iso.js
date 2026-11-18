export const TILE_W = 32;
export const TILE_H = 16;

export const project = (x, y, z = 0) => ({ sx: (x - y) * (TILE_W / 2), sy: (x + y) * (TILE_H / 2) - z });

const pt = ({ sx, sy }) => `${sx},${sy}`;

export const polygon = (points, fill, extra = "") => `<polygon points="${points.map(pt).join(" ")}" fill="${fill}"${extra ? ` ${extra}` : ""}/>`;

export function box({ x, y, z = 0, w, d, h }, { top, left, right }) {
  const p = (px, py, pz) => project(px, py, pz);
  const zt = z + h;
  return polygon([p(x, y + d, zt), p(x + w, y + d, zt), p(x + w, y + d, z), p(x, y + d, z)], left)
    + polygon([p(x + w, y, zt), p(x + w, y + d, zt), p(x + w, y + d, z), p(x + w, y, z)], right)
    + polygon([p(x, y, zt), p(x + w, y, zt), p(x + w, y + d, zt), p(x, y + d, zt)], top);
}

export function onPlaneY(y, x0, zTop, body) {
  const { sx, sy } = project(x0, y, zTop);
  return `<g transform="matrix(1 0.5 0 1 ${sx} ${sy})">${body}</g>`;
}

export function onPlaneX(x, y0, zTop, body) {
  const { sx, sy } = project(x, y0, zTop);
  return `<g transform="matrix(-1 0.5 0 1 ${sx} ${sy})">${body}</g>`;
}

export function onFloor(x0, y0, z, body) {
  const { sx, sy } = project(x0, y0, z);
  return `<g transform="matrix(1 0.5 -1 0.5 ${sx} ${sy})">${body}</g>`;
}

export const shade = (hex, amount) => {
  const n = parseInt(hex.slice(1, 7), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * (1 + amount))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, "0")).join("")}`;
};

export const faces = (color) => ({ top: color, left: shade(color, -0.12), right: shade(color, -0.25) });
