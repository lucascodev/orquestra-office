import { createPairingCodes } from "./pairing-codes.js";

const CHALLENGE_TTL_MS = 30_000;
const PENDING_LIMIT = 20;

// A signed bootstrap has no clock, so this is what makes it fresh: it only counts with a challenge the collector gave out,
// once and for 30 seconds. Challenges live only in memory, so a request captured before a restart is worth nothing after it.
export function createBootstrapChallenges({ newChallenge, now = Date.now }) {
  const pending = createPairingCodes({ newCode: newChallenge, now, ttlMs: CHALLENGE_TTL_MS, limit: PENDING_LIMIT });

  function issue() {
    const issued = pending.issue();
    return issued ? { challenge: issued.code, expiresAt: issued.expiresAt } : null;
  }

  return { issue, redeem: pending.redeem };
}
