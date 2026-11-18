const RENOTICE_MS = 60_000;

// Old hooks fire on every tool call; the page only needs to hear about them now and then, not on each event.
export function createLegacyHooksNotice({ now = Date.now } = {}) {
  let seenAt = null;
  const listeners = new Set();

  function see() {
    const at = now();
    const isNews = seenAt === null || at - seenAt >= RENOTICE_MS;
    seenAt = at;
    if (isNews) listeners.forEach((listener) => listener());
  }

  return {
    see,
    seenAt: () => seenAt,
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
