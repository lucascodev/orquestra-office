import { postSigned } from "./signed-request.mjs";

const BOOTSTRAP_PATH = "/pairing/bootstrap";
const BOOTSTRAP_TIMEOUT_MS = 5_000;
const PAIRING_CODE = /^[\w-]{22}$/;

// The link keeps the exact address the collector listens on. Swapping 127.0.0.1 for localhost would let Windows try ::1 first,
// where another process could be listening and would receive the code and, with it, the cookie.
export async function pairingLinkOf({ officeUrl, key }) {
  const answer = await postSigned({ officeUrl, path: BOOTSTRAP_PATH, payload: {}, key, timeoutMs: BOOTSTRAP_TIMEOUT_MS });
  if (typeof answer?.code !== "string" || !PAIRING_CODE.test(answer.code)) throw new Error("the office answer has no pairing code");
  return `${new URL(officeUrl).origin}/#pair=${answer.code}`;
}
