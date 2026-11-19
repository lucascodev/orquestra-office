import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isNonce, runnerTicketMessage } from "../../../collector/src/shared/auth/signed-message.js";

const CHALLENGE_TTL_MS = 60_000;
const TOKEN_TTL_MS = 12 * 60 * 60_000;
const CHALLENGE_LIMIT = 100;
const TOKEN_LIMIT = 50;
const NONCE_BYTES = 16;
const TOKEN_BYTES = 32;

const keyIdOf = (key) => createHash("sha256").update(key).digest("base64url");

function isTicketFor(key, nonce, ticket) {
  if (typeof ticket !== "string") return false;
  const given = Buffer.from(ticket, "base64url");
  const expected = createHmac("sha256", key).update(runnerTicketMessage(nonce)).digest();
  return given.toString("base64url") === ticket && given.length === expected.length && timingSafeEqual(given, expected);
}

function rememberBounded(map, key, value, limit) {
  map.set(key, value);
  if (map.size > limit) map.delete(map.keys().next().value);
}

// The page proves it is paired with the office by bringing a ticket only the collector can sign for this runner's nonce.
// A process squatting on the collector's port has no key and can sign nothing.
export function createRunnerAuth({ readOfficeKey, now = Date.now }) {
  const challenges = new Map();
  const tokens = new Map();

  function issueChallenge() {
    const nonce = randomBytes(NONCE_BYTES).toString("base64url");
    const expiresAt = now() + CHALLENGE_TTL_MS;
    rememberBounded(challenges, nonce, expiresAt, CHALLENGE_LIMIT);
    return { nonce, expiresAt };
  }

  // A challenge is spent by the first attempt, right or wrong, so a ticket cannot be guessed against it twice.
  function openSession({ nonce, ticket }) {
    if (!isNonce(nonce) || !challenges.has(nonce)) return null;
    const challengeExpiresAt = challenges.get(nonce);
    challenges.delete(nonce);
    const key = readOfficeKey();
    if (!key || challengeExpiresAt <= now() || !isTicketFor(key, nonce, ticket)) return null;
    const token = randomBytes(TOKEN_BYTES).toString("base64url");
    const expiresAt = now() + TOKEN_TTL_MS;
    rememberBounded(tokens, token, { expiresAt, keyId: keyIdOf(key) }, TOKEN_LIMIT);
    return { token, expiresAt };
  }

  // Rotating the secret drops every token at once, like it drops the paired devices.
  function isValidToken(token) {
    const entry = typeof token === "string" ? tokens.get(token) : undefined;
    if (!entry) return false;
    const key = readOfficeKey();
    return entry.expiresAt > now() && Boolean(key) && entry.keyId === keyIdOf(key);
  }

  return { issueChallenge, openSession, isValidToken };
}
