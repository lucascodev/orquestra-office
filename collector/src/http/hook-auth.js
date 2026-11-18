import { createHash } from "node:crypto";
import { NONCE_HEADER, SIGNATURE_HEADER, isNonce, requestMessage, responseMessage, signatureFromHeader, signatureHeaderOf } from "../shared/auth/signed-message.js";

export const HOOK_ACCESS = Object.freeze({ GRANTED: "granted", LEGACY: "legacy", REFUSED: "refused" });

const BEARER = /^Bearer ([\w-]+)$/;
const REMEMBERED_NONCES = 4_096;

const bodyHashOf = (body) => createHash("sha256").update(body).digest("hex");

export function createHookAuth({ officeKey }) {
  const seenNonces = new Set();

  // The protocol needs no clock; remembering recent nonces still stops a captured request from being sent twice.
  function isFirstUse(nonce) {
    if (seenNonces.has(nonce)) return false;
    seenNonces.add(nonce);
    if (seenNonces.size > REMEMBERED_NONCES) seenNonces.delete(seenNonces.values().next().value);
    return true;
  }

  function activityAccessOf(req) {
    const authorization = req.headers.authorization;
    if (authorization === undefined) return HOOK_ACCESS.LEGACY;
    const [, token] = BEARER.exec(authorization) ?? [];
    return officeKey.isActivityToken(token) ? HOOK_ACCESS.GRANTED : HOOK_ACCESS.REFUSED;
  }

  // Hooks from before the signatures send none of these headers; anything else that is not a valid signature is refused.
  function signedAccessOf(req, path, body) {
    const nonce = req.headers[NONCE_HEADER];
    const header = req.headers[SIGNATURE_HEADER];
    if (nonce === undefined && header === undefined && req.headers.authorization === undefined) return { access: HOOK_ACCESS.LEGACY };
    if (!isNonce(nonce)) return { access: HOOK_ACCESS.REFUSED };
    const isSigned = officeKey.verify(requestMessage({ path, nonce, bodyHash: bodyHashOf(body) }), signatureFromHeader(header));
    return isSigned && isFirstUse(nonce) ? { access: HOOK_ACCESS.GRANTED, nonce } : { access: HOOK_ACCESS.REFUSED };
  }

  function responseSignatureOf({ path, nonce, status, body }) {
    const signature = officeKey.sign(responseMessage({ path, nonce, status, bodyHash: bodyHashOf(body) }));
    return signature ? { [SIGNATURE_HEADER]: signatureHeaderOf(signature) } : null;
  }

  return { activityAccessOf, signedAccessOf, responseSignatureOf };
}
