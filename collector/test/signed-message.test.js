import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import {
  NONCE_HEADER, SIGNATURE_HEADER, isNonce, requestMessage, responseMessage, runnerTicketMessage, signatureFromHeader, signatureHeaderOf,
} from "../src/shared/auth/signed-message.js";

// The same vectors sit in hooks/test/signed-message-contract.test.mjs: both copies of the protocol must sign alike.
const KEY = Buffer.from("AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8", "base64url");
const NONCE = "AAECAwQFBgcICQoLDA0ODw";
const PATH = "/hooks/claude/permission";
const REQUEST_BODY = '{"hook_event_name":"PermissionRequest"}';
const RESPONSE_BODY = '{"decision":null}';
const REQUEST_SIGNATURE = "e-JgOA5ho6Y-70Jcq0pjX0L6Ls_DLeiZurEF1GF2-S4";
const RESPONSE_SIGNATURE = "T1tSVVJANevN5lzDE_4vVc0JbQEE1LD_X3kgY8r1cwY";
const RUNNER_TICKET = "kAQ744p9HcBF8JvI2Tx0JiekFQsGFuWcAw2gPsykN_M";

const bodyHashOf = (body) => createHash("sha256").update(body).digest("hex");
const sign = (message) => createHmac("sha256", KEY).update(message).digest("base64url");
const request = (overrides = {}) => requestMessage({ path: PATH, nonce: NONCE, bodyHash: bodyHashOf(REQUEST_BODY), ...overrides });
const response = (overrides = {}) => responseMessage({ path: PATH, nonce: NONCE, status: 200, bodyHash: bodyHashOf(RESPONSE_BODY), ...overrides });

test("the fixed vectors sign to the same values the hooks copy produces", () => {
  assert.equal(sign(request()), REQUEST_SIGNATURE);
  assert.equal(sign(response()), RESPONSE_SIGNATURE);
  assert.equal(sign(runnerTicketMessage(NONCE)), RUNNER_TICKET);
});

test("a request signature never validates as a response, nor the other way round", () => {
  const sameParts = { path: PATH, nonce: NONCE, bodyHash: bodyHashOf(REQUEST_BODY) };
  assert.notEqual(sign(requestMessage(sameParts)), sign(responseMessage({ ...sameParts, status: 200 })));
});

test("another path, nonce, status or body gives another signature", () => {
  assert.notEqual(sign(request({ path: "/hooks/claude/stop" })), REQUEST_SIGNATURE);
  assert.notEqual(sign(request({ nonce: "AAAAAAAAAAAAAAAAAAAAAA" })), REQUEST_SIGNATURE);
  assert.notEqual(sign(request({ bodyHash: bodyHashOf(`${REQUEST_BODY} `) })), REQUEST_SIGNATURE);
  assert.notEqual(sign(response({ status: 401 })), RESPONSE_SIGNATURE);
});

test("a field holding a line break cannot pass for two fields", () => {
  assert.throws(() => requestMessage({ path: `${PATH}\n${NONCE}`, nonce: NONCE, bodyHash: "x" }), /line break/);
  assert.throws(() => responseMessage({ path: PATH, nonce: `${NONCE}\n`, status: 200, bodyHash: "x" }), /line break/);
});

test("the signature header carries the version and refuses any other", () => {
  assert.equal(signatureHeaderOf(REQUEST_SIGNATURE), `v1=${REQUEST_SIGNATURE}`);
  assert.equal(signatureFromHeader(`v1=${REQUEST_SIGNATURE}`), REQUEST_SIGNATURE);
  assert.equal(signatureFromHeader(`v2=${REQUEST_SIGNATURE}`), null);
  assert.equal(signatureFromHeader(undefined), null);
  assert.equal(NONCE_HEADER, "x-office-nonce");
  assert.equal(SIGNATURE_HEADER, "x-office-signature");
});

test("a nonce is 16 bytes in base64url", () => {
  assert.equal(isNonce(NONCE), true);
  assert.equal(isNonce("short"), false);
  assert.equal(isNonce(`${NONCE.slice(0, -1)}+`), false);
  assert.equal(isNonce(undefined), false);
});
