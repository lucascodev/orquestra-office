import assert from "node:assert/strict";
import { test } from "node:test";
import * as collectorProtocol from "../../collector/src/shared/auth/signed-message.js";
import {
  ACTIVITY_TOKEN_LABEL, NONCE_HEADER, SIGNATURE_HEADER, bodyHashOf, isResponseSigned, newNonce, requestMessage, responseMessage, runnerTicketMessage,
  signatureFromHeader, signatureHeaderOf, signedRequestHeaders,
} from "../lib/signed-message.mjs";
import { parseSecret } from "../lib/office-secret.mjs";

// The same vectors sit in collector/test/signed-message.test.js: both copies of the protocol must sign alike.
const KEY = parseSecret("AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8");
const OTHER_KEY = parseSecret("HxwdHh8AAQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRo");
const NONCE = "AAECAwQFBgcICQoLDA0ODw";
const OTHER_NONCE = "AAAAAAAAAAAAAAAAAAAAAA";
const PATH = "/hooks/claude/permission";
const REQUEST_BODY = '{"hook_event_name":"PermissionRequest"}';
const RESPONSE_BODY = '{"decision":null}';
const REQUEST_SIGNATURE = "e-JgOA5ho6Y-70Jcq0pjX0L6Ls_DLeiZurEF1GF2-S4";
const RESPONSE_SIGNATURE = "T1tSVVJANevN5lzDE_4vVc0JbQEE1LD_X3kgY8r1cwY";
const SAMPLE_PARTS = { path: PATH, nonce: NONCE, bodyHash: bodyHashOf(REQUEST_BODY) };

const signedResponse = (overrides = {}) => ({
  key: KEY, path: PATH, nonce: NONCE, status: 200, body: RESPONSE_BODY, header: signatureHeaderOf(RESPONSE_SIGNATURE), ...overrides,
});

test("the hooks copy builds the same messages and headers as the collector", () => {
  assert.equal(requestMessage(SAMPLE_PARTS), collectorProtocol.requestMessage(SAMPLE_PARTS));
  assert.equal(responseMessage({ ...SAMPLE_PARTS, status: 200 }), collectorProtocol.responseMessage({ ...SAMPLE_PARTS, status: 200 }));
  assert.equal(runnerTicketMessage(NONCE), collectorProtocol.runnerTicketMessage(NONCE));
  assert.equal(NONCE_HEADER, collectorProtocol.NONCE_HEADER);
  assert.equal(SIGNATURE_HEADER, collectorProtocol.SIGNATURE_HEADER);
  assert.equal(ACTIVITY_TOKEN_LABEL, collectorProtocol.ACTIVITY_TOKEN_LABEL);
  assert.equal(signatureHeaderOf("x"), collectorProtocol.signatureHeaderOf("x"));
  assert.equal(signatureFromHeader("v1=x"), collectorProtocol.signatureFromHeader("v1=x"));
});

test("signs a request to the fixed vector", () => {
  assert.deepEqual(signedRequestHeaders({ key: KEY, path: PATH, nonce: NONCE, body: REQUEST_BODY }), {
    [NONCE_HEADER]: NONCE,
    [SIGNATURE_HEADER]: `v1=${REQUEST_SIGNATURE}`,
  });
});

test("accepts the fixed response vector", () => {
  assert.equal(isResponseSigned(signedResponse()), true);
});

test("refuses a response signed with another key", () => {
  assert.equal(isResponseSigned(signedResponse({ key: OTHER_KEY })), false);
});

test("refuses a response bound to the nonce of another request", () => {
  assert.equal(isResponseSigned(signedResponse({ nonce: OTHER_NONCE })), false);
});

test("refuses a response for another path, status or body", () => {
  assert.equal(isResponseSigned(signedResponse({ path: "/hooks/claude/stop" })), false);
  assert.equal(isResponseSigned(signedResponse({ status: 201 })), false);
  assert.equal(isResponseSigned(signedResponse({ body: '{"decision":{"behavior":"allow"}}' })), false);
});

test("refuses the request signature replayed as a response", () => {
  assert.equal(isResponseSigned(signedResponse({ body: REQUEST_BODY, header: signatureHeaderOf(REQUEST_SIGNATURE) })), false);
});

test("refuses a missing, unversioned or truncated signature header", () => {
  for (const header of [undefined, "", RESPONSE_SIGNATURE, `v2=${RESPONSE_SIGNATURE}`, `v1=${RESPONSE_SIGNATURE.slice(0, -1)}`]) {
    assert.equal(isResponseSigned(signedResponse({ header })), false, String(header));
  }
});

test("each request gets a fresh 16-byte nonce", () => {
  const nonces = new Set(Array.from({ length: 50 }, newNonce));

  assert.equal(nonces.size, 50);
  assert.ok([...nonces].every(collectorProtocol.isNonce));
});
