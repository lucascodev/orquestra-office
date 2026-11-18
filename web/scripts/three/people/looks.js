import { hashOf, pick } from "../../domain/shared/seeded-random.js";

const SHIRTS = ["#f4f6f8", "#5b8cff", "#f2a65a", "#b28cff", "#f07a4a", "#36c9b8", "#e3c13b", "#f070b0", "#6fd27a", "#2b2f3a", "#ff6b6b", "#8fb3ff"];
const HAIR = ["#1a1a1a", "#2a1d14", "#3a2a1a", "#6b4a2a", "#a0522d", "#e8c060", "#8a8a8a", "#c84a7a"];
const SKIN = ["#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#ffdbac"];

export function looksOf(key) {
  const seed = hashOf(key);
  return { shirt: pick(SHIRTS, seed), hair: pick(HAIR, seed >>> 4), skin: pick(SKIN, seed >>> 8), long: (seed >>> 12) % 3 === 0, pants: (seed >>> 16) % 2 ? "#2b2f3a" : "#3a4a6a" };
}
