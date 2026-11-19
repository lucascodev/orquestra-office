import { readFileSync } from "node:fs";

const KEY_BYTES = 32;

// Read on every use, so a rotated secret takes effect without restarting the runner.
export function createOfficeSecretFile(secretFile) {
  return function readOfficeKey() {
    if (!secretFile) return null;
    try {
      const encoded = readFileSync(secretFile, "utf8").trim();
      const key = Buffer.from(encoded, "base64url");
      return key.length === KEY_BYTES && key.toString("base64url") === encoded ? key : null;
    } catch {
      return null;
    }
  };
}
