import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// A copy of collector/src/shared/auth/signed-message.js: the hooks folder must stay copyable on its own.
// hooks/test/signed-message-contract.test.mjs holds both copies to the same fixed vectors.
export const SIGNATURE_VERSION = "v1";
export const NONCE_HEADER = "x-office-nonce";
export const SIGNATURE_HEADER = "x-office-signature";
export const ACTIVITY_TOKEN_LABEL = "orquestra-office/activity-token/v1";

const REQUEST_LABEL = "orquestra-office/request/v1";
const RESPONSE_LABEL = "orquestra-office/response/v1";
const RUNNER_TICKET_LABEL = "orquestra-office/runner-ticket/v1";
const FIELD_SEPARATOR = "\n";
const SIGNATURE_PREFIX = `${SIGNATURE_VERSION}=`;
const NONCE_BYTES = 16;

function messageOf(fields) {
  const parts = fields.map(String);
  if (parts.some((part) => part.includes(FIELD_SEPARATOR))) throw new TypeError("a signed field cannot hold a line break");
  return parts.join(FIELD_SEPARATOR);
}

export const requestMessage = ({ path, nonce, bodyHash }) => messageOf([REQUEST_LABEL, path, nonce, bodyHash]);

export const responseMessage = ({ path, nonce, status, bodyHash }) => messageOf([RESPONSE_LABEL, path, nonce, status, bodyHash]);

export const runnerTicketMessage = (nonce) => messageOf([RUNNER_TICKET_LABEL, nonce]);

export const signatureHeaderOf = (signature) => `${SIGNATURE_PREFIX}${signature}`;

export const signatureFromHeader = (value) => (typeof value === "string" && value.startsWith(SIGNATURE_PREFIX) ? value.slice(SIGNATURE_PREFIX.length) : null);

export const bodyHashOf = (body) => createHash("sha256").update(body).digest("hex");

export const newNonce = () => randomBytes(NONCE_BYTES).toString("base64url");

const signatureOf = (key, message) => createHmac("sha256", key).update(message).digest();

export function signedRequestHeaders({ key, path, nonce, body }) {
  const signature = signatureOf(key, requestMessage({ path, nonce, bodyHash: bodyHashOf(body) })).toString("base64url");
  return { [NONCE_HEADER]: nonce, [SIGNATURE_HEADER]: signatureHeaderOf(signature) };
}

export function isResponseSigned({ key, path, nonce, status, body, header }) {
  const given = Buffer.from(signatureFromHeader(header) ?? "", "base64url");
  const expected = signatureOf(key, responseMessage({ path, nonce, status, bodyHash: bodyHashOf(body) }));
  return given.length === expected.length && timingSafeEqual(given, expected);
}
