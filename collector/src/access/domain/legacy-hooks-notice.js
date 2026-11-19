const RENOTICE_MS = 60_000;
const NOTICE_WINDOW_MS = 10 * 60_000;

// Old hooks fire on every tool call; the page only needs to hear about them now and then, not on each event.
// The notice ends ten minutes after the last one, so it goes away once every configuration folder is reinstalled.
export function createLegacyHooksNotice({ now = Date.now } = {}) {
  let lastSeenAt = null;
  let isAnnounced = false;
  const listeners = new Set();
  const emit = () => listeners.forEach((listener) => listener());

  const isRecent = () => lastSeenAt !== null && now() - lastSeenAt < NOTICE_WINDOW_MS;

  function see() {
    const at = now();
    const isNews = !isAnnounced || at - lastSeenAt >= RENOTICE_MS;
    lastSeenAt = at;
    isAnnounced = true;
    if (isNews) emit();
  }

  // Run by the collector's periodic sweep: the page hears that the notice ended even with no event coming in.
  function sweep() {
    if (!isAnnounced || isRecent()) return;
    isAnnounced = false;
    emit();
  }

  return {
    see,
    sweep,
    seenAt: () => (isRecent() ? lastSeenAt : null),
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
