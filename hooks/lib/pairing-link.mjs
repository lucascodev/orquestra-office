import { postSigned, readCapped } from "./signed-request.mjs";

const CHALLENGE_PATH = "/pairing/challenge";
const BOOTSTRAP_PATH = "/pairing/bootstrap";
const REQUEST_TIMEOUT_MS = 5_000;
const OK_STATUS = 200;
const ONE_TIME_VALUE = /^[\w-]{22}$/;

// The challenge needs no signature: a wrong one only makes the collector refuse the bootstrap that carries it.
async function bootstrapChallengeOf(officeUrl) {
  const response = await fetch(`${officeUrl}${CHALLENGE_PATH}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", redirect: "error", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await readCapped(response);
  if (response.status !== OK_STATUS) throw new Error(`the office answered ${response.status} to the challenge request`);
  const challenge = JSON.parse(text)?.challenge;
  if (typeof challenge !== "string" || !ONE_TIME_VALUE.test(challenge)) throw new Error("the office answer has no challenge");
  return challenge;
}

// The link keeps the exact address the collector listens on. Swapping 127.0.0.1 for localhost would let Windows try ::1 first,
// where another process could be listening and would receive the code and, with it, the cookie.
export async function pairingLinkOf({ officeUrl, key }) {
  const challenge = await bootstrapChallengeOf(officeUrl);
  const answer = await postSigned({ officeUrl, path: BOOTSTRAP_PATH, payload: { challenge }, key, timeoutMs: REQUEST_TIMEOUT_MS });
  if (typeof answer?.code !== "string" || !ONE_TIME_VALUE.test(answer.code)) throw new Error("the office answer has no pairing code");
  return `${new URL(officeUrl).origin}/#pair=${answer.code}`;
}
