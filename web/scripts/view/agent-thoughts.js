import { hashOf, rng } from "../domain/shared/seeded-random.js";
import { THOUGHTS } from "../data/thoughts.js";

const FIRST_THOUGHT_DELAY_SECONDS = 0.8;
const THOUGHT_SECONDS = 4.5;
const MAX_VISIBLE_THOUGHTS = 3;
const SUBJECT_SLOT = "{alvo}";
const SUBJECT_PATTERNS = [/^(?:editando|lendo) (\S+\.\S+)$/, /^rodando (\S+)$/, /^delegou para (\S+)$/, /^usando (\S+)$/];

function subjectOf(action) {
  for (const pattern of SUBJECT_PATTERNS) {
    const match = pattern.exec(action ?? "");
    if (match) return match[1];
  }
  return null;
}

function linesFor(reactionId, action) {
  const lines = THOUGHTS[reactionId] ?? [];
  const subject = subjectOf(action);
  return subject ? lines.map((line) => line.replace(SUBJECT_SLOT, subject)) : lines.filter((line) => !line.includes(SUBJECT_SLOT));
}

export function thoughtAt({ agentKey, reactionId, action, sinceSeconds, nowSeconds, gapSeconds }) {
  const lines = linesFor(reactionId, action);
  const elapsed = nowSeconds - sinceSeconds - FIRST_THOUGHT_DELAY_SECONDS;
  if (lines.length === 0 || elapsed < 0) return null;
  const period = THOUGHT_SECONDS + gapSeconds;
  const cycle = Math.floor(elapsed / period);
  if (elapsed - cycle * period > THOUGHT_SECONDS) return null;
  const random = rng(hashOf(`thought|${agentKey}|${reactionId}|${cycle}`));
  return { text: lines[Math.floor(random() * lines.length)], startedAt: sinceSeconds + FIRST_THOUGHT_DELAY_SECONDS + cycle * period };
}

export function freshestThoughts(entries) {
  const freshest = [...entries].sort(([, a], [, b]) => b.startedAt - a.startedAt).slice(0, MAX_VISIBLE_THOUGHTS);
  return new Set(freshest.map(([key]) => key));
}
