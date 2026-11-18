import { hashOf, pick, rect as r } from "./pixels.js";

const SHIRTS = ["#f4f6f8", "#5b8cff", "#f2a65a", "#b28cff", "#f07a4a", "#36c9b8", "#e3c13b", "#f070b0", "#6fd27a", "#2b2f3a", "#ff6b6b", "#8fb3ff"];
const HAIR = ["#1a1a1a", "#2a1d14", "#3a2a1a", "#6b4a2a", "#a0522d", "#e8c060", "#8a8a8a", "#c84a7a"];
const SKIN = ["#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#ffdbac"];
const DARK = "#1b1f2b";

export function looksOf(seedText) {
  const seed = hashOf(seedText);
  return { shirt: pick(SHIRTS, seed), hair: pick(HAIR, seed >>> 4), skin: pick(SKIN, seed >>> 8), long: (seed >>> 12) % 3 === 0, pants: (seed >>> 16) % 2 ? "#2b2f3a" : "#3a4a6a" };
}

const ICONS = {
  working: r(3, 4, 2, 2, DARK, 'class="dot d1"') + r(7, 4, 2, 2, DARK, 'class="dot d2"') + r(11, 4, 2, 2, DARK, 'class="dot d3"'),
  reviewing: `<rect x="4" y="2" width="5" height="5" fill="none" stroke="#7a52d8" stroke-width="1"/>` + r(9, 7, 2, 2, "#7a52d8"),
  needs_you: r(7, 1, 2, 5, "#d89a00") + r(7, 7, 2, 2, "#d89a00"),
  waiting: r(5, 1, 7, 7, "#f2a65a") + r(8, 2, 1, 3, DARK) + r(8, 4, 2, 1, DARK),
  break: r(4, 3, 6, 5, "#8a5a3a") + r(10, 4, 2, 3, "#8a5a3a") + r(5, 1, 1, 2, "#c9ced9") + r(8, 0, 1, 2, "#c9ced9"),
  blocked: r(5, 2, 2, 2, "#e04848") + r(7, 4, 2, 2, "#e04848") + r(9, 6, 2, 2, "#e04848") + r(9, 2, 2, 2, "#e04848") + r(5, 6, 2, 2, "#e04848"),
  idle: `<text x="5" y="8" font-size="7" font-family="Silkscreen,monospace" fill="#626b80">z</text>`,
};

function bubble(status) {
  const border = status === "needs_you" ? "#d89a00" : DARK;
  return `<g class="bubble" transform="translate(-8 -44)">${r(0, 0, 16, 10, border)}${r(1, 1, 14, 8, "#ffffff")}${r(3, 10, 3, 2, border)}${ICONS[status] ?? ICONS.idle}</g>`;
}

function front(look) {
  const hair = r(-5, -31, 10, 4, look.hair) + r(-6, -29, 2, look.long ? 11 : 5, look.hair) + r(4, -29, 2, look.long ? 11 : 5, look.hair);
  const face = r(-4, -28, 8, 8, look.skin) + r(-2, -25, 1, 2, DARK) + r(1, -25, 1, 2, DARK) + r(-1, -21, 2, 1, "#c9786a");
  const body = r(-5, -20, 10, 10, look.shirt) + r(-1, -20, 2, 3, look.shirt === "#f4f6f8" ? "#2b2f3a" : "#ffffff55");
  const arms = `<g class="arms">${r(-7, -18, 2, 7, look.shirt)}${r(5, -18, 2, 7, look.shirt)}${r(-7, -11, 3, 2, look.skin)}${r(4, -11, 3, 2, look.skin)}</g>`;
  return body + arms + hair + face;
}

function back(look) {
  const head = r(-5, -31, 10, 11, look.hair) + (look.long ? r(-5, -20, 10, 3, look.hair) : r(-4, -21, 8, 1, look.skin));
  const body = r(-5, -20, 10, 10, look.shirt) + r(-5, -12, 10, 2, "#00000025");
  const arms = `<g class="arms">${r(-7, -18, 2, 6, look.shirt)}${r(5, -18, 2, 6, look.shirt)}</g>`;
  return body + arms + head;
}

export function seatedAgent(agent, sx, sy, facing, status) {
  const look = looksOf(agent.key);
  const legs = facing === "viewer" ? r(-4, -10, 8, 3, look.pants) : "";
  return `<g class="person" transform="translate(${sx} ${sy})">${legs}${facing === "viewer" ? front(look) : back(look)}${bubble(status)}</g>`;
}
