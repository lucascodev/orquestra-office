import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { ACTIVITY_TOKEN_LABEL, KEY_ID_LABEL } from "../../shared/auth/signed-message.js";

const KEY_BYTES = 32;
const KEY_ID_LENGTH = 16;

function parseKey(text) {
  const encoded = String(text).trim();
  const key = Buffer.from(encoded, "base64url");
  return key.length === KEY_BYTES && key.toString("base64url") === encoded ? key : null;
}

const hmacOf = (key, message) => createHmac("sha256", key).update(message).digest();

function keyFrom(key) {
  if (!key) return null;
  return {
    key,
    keyId: hmacOf(key, KEY_ID_LABEL).toString("base64url").slice(0, KEY_ID_LENGTH),
    activityToken: hmacOf(key, ACTIVITY_TOKEN_LABEL),
  };
}

// Decoding base64url skips characters it does not know, so only the exact encoding of a digest is taken.
function isSameDigest(encoded, expected) {
  if (typeof encoded !== "string") return false;
  const given = Buffer.from(encoded, "base64url");
  return given.toString("base64url") === encoded && given.length === expected.length && timingSafeEqual(given, expected);
}

// The secret is read again only when the file changes, so a rotated secret takes effect without a restart.
export function createOfficeKey({ secretFile }) {
  let seenVersion = null;
  let loaded = null;

  function current() {
    if (!secretFile) return null;
    try {
      const { mtimeMs, size, ino } = statSync(secretFile);
      const version = `${mtimeMs}:${size}:${ino}`;
      if (version !== seenVersion) {
        loaded = keyFrom(parseKey(readFileSync(secretFile, "utf8")));
        seenVersion = version;
      }
      return loaded;
    } catch {
      seenVersion = null;
      loaded = null;
      return null;
    }
  }

  return {
    isMissing: () => current() === null,
    keyId: () => current()?.keyId ?? null,
    sign(message) {
      const key = current();
      return key ? hmacOf(key.key, message).toString("base64url") : null;
    },
    verify(message, signature) {
      const key = current();
      return Boolean(key) && isSameDigest(signature, hmacOf(key.key, message));
    },
    isActivityToken(token) {
      const key = current();
      return Boolean(key) && isSameDigest(token, key.activityToken);
    },
  };
}
