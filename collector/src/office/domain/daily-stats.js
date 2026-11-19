export function freshStats(day) {
  return { day, prompts: 0, tools: 0, turns: 0, tokens: 0, costUsd: 0 };
}

// A counter that drops below its last reading was reset (for example by /clear), so the new value is all new spend.
export function growthOf(previous, current) {
  return current >= previous ? current - previous : current;
}
