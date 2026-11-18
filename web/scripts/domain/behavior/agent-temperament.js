import { hashOf, rng } from "../shared/seeded-random.js";

const LINGER_MS = [6_000, 16_000];
const FREE_TIME_SLOT_MS = [30_000, 55_000];
const WALK_PACE = [0.85, 1.15];
const FIDGET_EVERY_SECONDS = [9, 22];
const THOUGHT_GAP_SECONDS = [10, 24];
const PHASE_SECONDS = [0, 10];

const between = (random, [min, max]) => min + random() * (max - min);
const cache = new Map();

export function temperamentOf(agentKey) {
  if (cache.has(agentKey)) return cache.get(agentKey);
  const random = rng(hashOf(`temperament|${agentKey}`));
  const temperament = Object.freeze({
    lingerMs: between(random, LINGER_MS),
    freeTimeSlotMs: between(random, FREE_TIME_SLOT_MS),
    walkPace: between(random, WALK_PACE),
    fidgetEverySeconds: between(random, FIDGET_EVERY_SECONDS),
    thoughtGapSeconds: between(random, THOUGHT_GAP_SECONDS),
    phaseSeconds: between(random, PHASE_SECONDS),
  });
  cache.set(agentKey, temperament);
  return temperament;
}
