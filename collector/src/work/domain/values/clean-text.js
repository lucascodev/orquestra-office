import { redactSecrets } from "./redact-secrets.js";
import { lineOf, textBlockOf } from "./safe-text.js";

// Secrets are masked before the final cut, so a cut can never leave the start of a credential that the mask would catch.
const ROOM_FOR_MASKING = 2;

export function cleanLineOf(value, limit) {
  return lineOf(redactSecrets(lineOf(value, limit * ROOM_FOR_MASKING)), limit);
}

export function cleanTextBlockOf(value, limit) {
  return textBlockOf(redactSecrets(textBlockOf(value, limit * ROOM_FOR_MASKING)), limit);
}
