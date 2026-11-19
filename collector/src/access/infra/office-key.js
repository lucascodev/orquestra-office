import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
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

// The file is a few bytes, so it is read on every use: a rotated secret takes effect at once, without a restart.
// Comparing modification times instead missed a rotation written within the same clock tick on Windows.
export function createOfficeKey({ secretFile }) {
  let seenText = null;
  let loaded = null;

  function current() {
    if (!secretFile) return null;
    try {
      const text = readFileSync(secretFile, "utf8");
      if (text !== seenText) {
        loaded = keyFrom(parseKey(text));
        seenText = text;
      }
      return loaded;
    } catch {
      seenText = null;
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
