const MESSAGE_LIMIT = 4_000;
const QUEUE_LIMIT = 10;

export function createOutbox() {
  const queues = new Map();
  const listeners = new Set();
  const emit = () => listeners.forEach((listener) => listener());

  function queue(agentKey, text) {
    const message = typeof text === "string" ? text.trim().slice(0, MESSAGE_LIMIT) : "";
    const waiting = queues.get(agentKey) ?? [];
    if (!message || waiting.length >= QUEUE_LIMIT) return false;
    queues.set(agentKey, [...waiting, message]);
    emit();
    return true;
  }

  function take(agentKey) {
    const waiting = queues.get(agentKey) ?? [];
    if (waiting.length === 0) return waiting;
    queues.delete(agentKey);
    emit();
    return waiting;
  }

  return {
    queue,
    take,
    counts: () => Object.fromEntries([...queues].map(([agentKey, waiting]) => [agentKey, waiting.length])),
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
