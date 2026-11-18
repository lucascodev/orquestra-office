import { hashOf, pick, rect as r } from "./pixels.js";

const SHIRTS = ["#5b8cff", "#f2a65a", "#b28cff", "#f07a4a", "#e3c13b", "#36c9b8", "#53b8f0", "#f070b0", "#6fd27a", "#ff6b6b", "#9c7af2", "#8fb3ff"];
const HAIR = ["#3a2a1a", "#1a1a1a", "#6b4a2a", "#c84a7a", "#a0522d", "#e8c060", "#8a8a8a", "#2a2a5a"];
const SKIN = ["#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#ffdbac"];
const DARK = "#0b0d13";

export function looksOf(seedText) {
  const seed = hashOf(seedText);
  return { shirt: pick(SHIRTS, seed), hair: pick(HAIR, seed >>> 4), skin: pick(SKIN, seed >>> 8), glasses: (seed >>> 12) % 4 === 0 };
}

function head(look, dy) {
  return r(9, 4 + dy, 9, 8, look.skin) + r(9, 3 + dy, 9, 3, look.hair) + r(9, 6 + dy, 2, 4, look.hair) + r(16, 7 + dy, 1, 2, DARK)
    + (look.glasses ? r(14, 7 + dy, 4, 1, DARK) + r(14, 8 + dy, 1, 1, DARK) + r(17, 8 + dy, 1, 1, DARK) : "");
}

function body(look, dy) {
  return r(9, 12 + dy, 8, 9, look.shirt) + r(9, 18 + dy, 8, 3, "#00000040") + r(10, 21, 3, 5, "#2b3245") + r(14, 21, 3, 5, "#2b3245");
}

export function deskScene(template, look, source) {
  const { desk, chair } = template;
  const screen = source === "codex" ? "#10212e" : "#0e2a24";
  const line = source === "codex" ? "#6fc3ff" : look.shirt;
  const lines = [0, 4, 8, 12, 16].map((y) => r(0, y, y % 8 ? 7 : 10, 1, line) + r(0, y + 2, 6, 1, `${line}99`)).join("");
  return `<svg viewBox="0 0 56 36" aria-hidden="true" shape-rendering="crispEdges">
    ${r(2, 26, 52, 2, desk.top)}${r(2, 28, 52, 1, desk.edge)}${r(3, 29, 2, 7, desk.leg)}${r(51, 29, 2, 7, desk.leg)}
    ${r(4, 10, 4, 18, chair)}${r(3, 9, 6, 2, chair)}${r(5, 28, 2, 6, chair)}
    ${r(31, 6, 18, 14, DARK)}${r(32, 7, 16, 12, screen)}
    <svg x="33" y="8" width="14" height="10" viewBox="0 0 14 10"><g class="scroll">${lines}</g></svg>
    ${r(38, 20, 4, 4, DARK)}${r(35, 24, 10, 2, DARK)}${r(20, 24, 10, 2, "#c9ced9")}
    <g class="body-up">${body(look, 0)}${head(look, 0)}
      <g class="pose pose-typing">${r(17, 15, 5, 3, look.shirt, 'class="arm-a"')}${r(22, 17, 2, 2, look.skin, 'class="arm-a"')}${r(17, 16, 6, 3, look.shirt, 'class="arm-b"')}${r(23, 19, 2, 2, look.skin, 'class="arm-b"')}</g>
      <g class="pose pose-review">${r(17, 15, 5, 3, look.shirt)}${r(22, 12, 2, 4, look.skin)}<rect x="22" y="6" width="6" height="6" fill="none" stroke="#b28cff" stroke-width="1"/>${r(21, 11, 2, 2, "#b28cff")}</g>
      <g class="pose pose-hand">${r(17, 2, 3, 10, look.shirt)}${r(17, 0, 3, 2, look.skin)}${r(22, 0, 11, 7, "#ffffff")}<text x="25" y="6" font-size="6" font-family="Silkscreen,monospace" fill="#12141c">?</text></g>
      <g class="pose pose-coffee">${r(17, 15, 4, 3, look.shirt)}${r(20, 12, 4, 5, "#e8e8e8")}${r(24, 13, 1, 3, "#e8e8e8")}${r(21, 9, 1, 2, "#ffffff80")}${r(23, 8, 1, 2, "#ffffff80")}</g>
      <g class="pose pose-wait">${r(17, 15, 4, 3, look.shirt)}<circle cx="27" cy="5" r="3.5" fill="#f2a65a"/>${r(27, 3, 1, 3, DARK)}${r(27, 5, 2, 1, DARK)}</g>
      <g class="pose pose-blocked">${r(13, -1, 2, 6, "#ff6b6b")}${r(13, 6, 2, 2, "#ff6b6b")}</g>
    </g>
    <g class="body-down">${body(look, 2)}${r(14, 14, 9, 7, look.skin)}${r(14, 13, 9, 3, look.hair)}${r(17, 24, 6, 2, look.shirt)}
      <g class="pose pose-sleep"><text class="zzz" x="24" y="10" font-size="7" font-family="Silkscreen,monospace" fill="#949db0">z</text></g></g>
  </svg>`;
}
