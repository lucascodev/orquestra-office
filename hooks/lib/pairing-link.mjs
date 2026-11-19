import { postSigned } from "./signed-request.mjs";

const CHALLENGE_PATH = "/pairing/challenge";
const BOOTSTRAP_PATH = "/pairing/bootstrap";
const REQUEST_TIMEOUT_MS = 5_000;
const ONE_TIME_VALUE = /^[\w-]{22}$/;

// Signed so the collector can refuse a flood of challenge requests from anyone without the secret.
async function bootstrapChallengeOf(officeUrl, key) {
  const answer = await postSigned({ officeUrl, path: CHALLENGE_PATH, payload: {}, key, timeoutMs: REQUEST_TIMEOUT_MS });
  if (typeof answer?.challenge !== "string" || !ONE_TIME_VALUE.test(answer.challenge)) throw new Error("the office answer has no challenge");
  return answer.challenge;
}

// The link keeps the exact address the collector listens on. Swapping 127.0.0.1 for localhost would let Windows try ::1 first,
// where another process could be listening and would receive the code and, with it, the cookie.
export async function pairingLinkOf({ officeUrl, key }) {
  const challenge = await bootstrapChallengeOf(officeUrl, key);
  const answer = await postSigned({ officeUrl, path: BOOTSTRAP_PATH, payload: { challenge }, key, timeoutMs: REQUEST_TIMEOUT_MS });
  if (typeof answer?.code !== "string" || !ONE_TIME_VALUE.test(answer.code)) throw new Error("the office answer has no pairing code");
  return `${new URL(officeUrl).origin}/#pair=${answer.code}`;
}
