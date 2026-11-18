import { encode } from "../../../vendor/uqr.js";
import { esc } from "./escape-html.js";

const QUIET_ZONE = 4;
// Dark on light whatever the page theme: phone cameras read an inverted code poorly.
const LIGHT = "#fff";
const DARK = "#000";

// One path with a square per dark module, drawn from the matrix the library returns, so no markup from it reaches the page.
export function qrSvg(text, { label }) {
  const { data, size } = encode(text, { border: QUIET_ZONE, ecc: "M" });
  const squares = data.flatMap((row, y) => row.map((isDark, x) => (isDark ? `M${x} ${y}h1v1h-1z` : ""))).join("");
  return `<svg class="qr" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${LIGHT}"/><path fill="${DARK}" d="${squares}"/></svg>`;
}
