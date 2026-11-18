import { postSigned } from "./signed-request.mjs";

const BOOTSTRAP_PATH = "/pairing/bootstrap";
const BOOTSTRAP_TIMEOUT_MS = 5_000;
const PAIRING_CODE = /^[\w-]{22}$/;
const LOOPBACK_ADDRESS = "127.0.0.1";
const LOOPBACK_NAME = "localhost";

// The page is opened at localhost, the address the README gives: a cookie set for 127.0.0.1 would not be sent to localhost.
function browserOriginOf(officeUrl) {
  const url = new URL(officeUrl);
  if (url.hostname === LOOPBACK_ADDRESS) url.hostname = LOOPBACK_NAME;
  return url.origin;
}

export async function pairingLinkOf({ officeUrl, key }) {
  const answer = await postSigned({ officeUrl, path: BOOTSTRAP_PATH, payload: {}, key, timeoutMs: BOOTSTRAP_TIMEOUT_MS });
  if (typeof answer?.code !== "string" || !PAIRING_CODE.test(answer.code)) throw new Error("the office answer has no pairing code");
  return `${browserOriginOf(officeUrl)}/#pair=${answer.code}`;
}
