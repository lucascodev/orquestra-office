import { createHash, createHmac, randomBytes } from "node:crypto";
import {
  ACTIVITY_TOKEN_LABEL, NONCE_HEADER, SIGNATURE_HEADER, requestMessage, responseMessage, signatureFromHeader, signatureHeaderOf,
} from "../../src/shared/auth/signed-message.js";
import { TEST_KEY } from "./office-secret.js";

const JSON_TYPE = { "Content-Type": "application/json" };
const NONCE_BYTES = 16;

const hmacOf = (key, message) => createHmac("sha256", key).update(message).digest("base64url");
const bodyHashOf = (body) => createHash("sha256").update(body).digest("hex");

export const newNonce = () => randomBytes(NONCE_BYTES).toString("base64url");
export const activityTokenOf = (key = TEST_KEY) => hmacOf(key, ACTIVITY_TOKEN_LABEL);
export const activityHeaders = (key = TEST_KEY) => ({ ...JSON_TYPE, Authorization: `Bearer ${activityTokenOf(key)}` });

export const postActivity = (base, path, payload, key = TEST_KEY) =>
  fetch(`${base}${path}`, { method: "POST", headers: activityHeaders(key), body: JSON.stringify(payload) });

export function signedHeaders({ path, body, key = TEST_KEY, nonce = newNonce() }) {
  const signature = hmacOf(key, requestMessage({ path, nonce, bodyHash: bodyHashOf(body) }));
  return { ...JSON_TYPE, [NONCE_HEADER]: nonce, [SIGNATURE_HEADER]: signatureHeaderOf(signature) };
}

export const isResponseSigned = ({ path, nonce, status, text, header, key = TEST_KEY }) =>
  signatureFromHeader(header) === hmacOf(key, responseMessage({ path, nonce, status, bodyHash: bodyHashOf(text) }));

export async function postSigned(base, path, payload, { key = TEST_KEY, nonce = newNonce(), signal } = {}) {
  const body = JSON.stringify(payload);
  const res = await fetch(`${base}${path}`, { method: "POST", headers: signedHeaders({ path, body, key, nonce }), body, signal });
  const text = await res.text();
  const isSigned = isResponseSigned({ path, nonce, status: res.status, text, header: res.headers.get(SIGNATURE_HEADER), key });
  return { status: res.status, body: JSON.parse(text), isSigned };
}
