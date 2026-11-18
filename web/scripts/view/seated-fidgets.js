import { hashOf, rng } from "../domain/shared/seeded-random.js";

const FIDGET_SECONDS = 2.6;

export const FIDGETS = [
  { pose: "glancing", prop: null },
  { pose: "neckRolling", prop: null },
  { pose: "headScratching", prop: null },
  { pose: "deskSipping", prop: "mug" },
  { pose: "leaningBack", prop: null },
  { pose: "eyeRubbing", prop: null },
];

export function fidgetAt(agentKey, seconds, everySeconds) {
  const cycle = Math.floor(seconds / everySeconds);
  const random = rng(hashOf(`fidget|${agentKey}|${cycle}`));
  const start = random() * Math.max(0, everySeconds - FIDGET_SECONDS);
  const into = seconds - cycle * everySeconds - start;
  if (into < 0 || into > FIDGET_SECONDS) return null;
  return { ...FIDGETS[Math.floor(random() * FIDGETS.length)], progress: into / FIDGET_SECONDS };
}
