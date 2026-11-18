const CODE_TTL_MS = 120_000;
const PENDING_LIMIT = 20;

export function createPairingCodes({ newCode, now = Date.now, ttlMs = CODE_TTL_MS, limit = PENDING_LIMIT }) {
  const pending = new Map();

  function dropExpired() {
    const at = now();
    for (const [code, expiresAt] of pending) if (expiresAt <= at) pending.delete(code);
  }

  function issue() {
    dropExpired();
    if (pending.size >= limit) return null;
    const code = newCode();
    const expiresAt = now() + ttlMs;
    pending.set(code, expiresAt);
    return { code, expiresAt };
  }

  // A code is spent by the first try, right or late, so it can never be redeemed twice.
  function redeem(code) {
    if (typeof code !== "string" || !pending.has(code)) return false;
    const expiresAt = pending.get(code);
    pending.delete(code);
    return expiresAt > now();
  }

  return { issue, redeem };
}
