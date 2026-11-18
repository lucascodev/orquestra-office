import { randomUUID } from "node:crypto";

const DEFAULT_HOLD_MS = 120_000;

export function createPendingDecisions({ holdMs = DEFAULT_HOLD_MS, now = Date.now } = {}) {
  const pending = new Map();
  const listeners = new Set();
  const emit = () => listeners.forEach((listener) => listener());

  function settle(id, answer) {
    const entry = pending.get(id);
    if (!entry) return false;
    clearTimeout(entry.timer);
    pending.delete(id);
    entry.resolve(answer);
    emit();
    return true;
  }

  function hold(request) {
    const id = randomUUID();
    const createdAt = now();
    const answer = new Promise((resolve) => {
      const timer = setTimeout(() => settle(id, null), holdMs);
      timer.unref?.();
      pending.set(id, { request: { ...request, id, createdAt, expiresAt: createdAt + holdMs }, resolve, timer });
    });
    emit();
    return { id, answer };
  }

  return {
    hold,
    settle,
    get: (id) => pending.get(id)?.request ?? null,
    list: () => [...pending.values()].map((entry) => entry.request),
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
