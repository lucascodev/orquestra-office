const MS_PER_SECOND = 1_000;
const NO_FRAMES = { perSecond: 0, averageMs: 0, worstMs: 0 };

export function frameStats({ frames, now, windowMs }) {
  const recent = frames.filter((frame) => frame.at > now - windowMs && frame.at <= now);
  if (recent.length === 0) return NO_FRAMES;
  const total = recent.reduce((sum, frame) => sum + frame.workMs, 0);
  return {
    perSecond: recent.length / (windowMs / MS_PER_SECOND),
    averageMs: total / recent.length,
    worstMs: Math.max(...recent.map((frame) => frame.workMs)),
  };
}
