import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { browserCommandFor, isSafeLink, openBrowser } from "../lib/open-browser.mjs";
import { parseSecret } from "../lib/office-secret.mjs";
import { NONCE_HEADER, SIGNATURE_HEADER, bodyHashOf, requestMessage, responseMessage, signatureFromHeader, signatureHeaderOf } from "../lib/signed-message.mjs";
import { fakeHome } from "./support/fake-home.mjs";
import { startFakeOffice } from "./support/fake-office.mjs";
import { runHookScript, THROWAWAY_SECRET } from "./support/run-hook-script.mjs";

const SCRIPT = "open-office.mjs";
const KEY = parseSecret(THROWAWAY_SECRET);
const OTHER_KEY = parseSecret("HxwdHh8AAQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRo");
const CODE = "AAECAwQFBgcICQoLDA0ODw";
const UNREACHABLE_OFFICE = "http://127.0.0.1:1";

const hmacOf = (key, message) => createHmac("sha256", key).update(message).digest("base64url");

function bootstrapAnswer(body, { key = KEY, isSigned = true } = {}) {
  return (request) => {
    const nonce = request.headers[NONCE_HEADER];
    const isRequestSigned = signatureFromHeader(request.headers[SIGNATURE_HEADER]) === hmacOf(KEY, requestMessage({ path: request.url, nonce, bodyHash: bodyHashOf(request.body) }));
    if (!isRequestSigned) return { status: 401, text: "{}" };
    const text = JSON.stringify(body);
    const signature = hmacOf(key, responseMessage({ path: request.url, nonce, status: 200, bodyHash: bodyHashOf(text) }));
    return { status: 200, text, headers: isSigned ? { [SIGNATURE_HEADER]: signatureHeaderOf(signature) } : {} };
  };
}

const openOffice = (officeUrl, env = {}) => runHookScript(SCRIPT, { env: { OFFICE_URL: officeUrl, ...env }, args: ["--no-open"] });

test("asks the office for a code with a signed request and prints the link at localhost", async (t) => {
  const office = await startFakeOffice(t, { answer: bootstrapAnswer({ code: CODE, expiresAt: 1, urls: [] }) });

  const result = await openOffice(office.url);

  assert.equal(result.code, 0);
  assert.equal(office.requests[0].url, "/pairing/bootstrap");
  assert.match(result.stdout, new RegExp(`^http://localhost:${new URL(office.url).port}/#pair=${CODE}$`, "m"));
});

test("an answer signed with another key opens nothing", async (t) => {
  const office = await startFakeOffice(t, { answer: bootstrapAnswer({ code: CODE }, { key: OTHER_KEY }) });

  const result = await openOffice(office.url);

  assert.equal(result.code, 1);
  assert.doesNotMatch(result.stdout, /#pair=/);
  assert.match(result.stderr, /not signed/);
});

test("an unsigned answer, as an old collector or a stranger on the port gives, opens nothing", async (t) => {
  const office = await startFakeOffice(t, { answer: bootstrapAnswer({ code: CODE }, { isSigned: false }) });

  const result = await openOffice(office.url);

  assert.equal(result.code, 1);
  assert.doesNotMatch(result.stdout, /#pair=/);
});

test("a signed answer without a well-formed code opens nothing", async (t) => {
  const office = await startFakeOffice(t, { answer: bootstrapAnswer({ code: "x\" & calc" }) });

  const result = await openOffice(office.url);

  assert.equal(result.code, 1);
  assert.doesNotMatch(result.stdout, /#pair=/);
});

test("without the secret it asks nothing and says to run the installer", async (t) => {
  const office = await startFakeOffice(t, { answer: bootstrapAnswer({ code: CODE }) });
  const { env } = fakeHome(t);

  const result = await openOffice(office.url, env);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /install-claude-hooks\.mjs/);
  assert.deepEqual(office.requests, []);
});

test("with the collector down it says so and exits 1", async () => {
  const result = await openOffice(UNREACHABLE_OFFICE);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /collector is running/);
});

test("the browser is opened without a shell reading the link, on each system", () => {
  const link = `http://localhost:8420/#pair=${CODE}`;

  assert.deepEqual(browserCommandFor("win32", link), ["cmd.exe", ["/d", "/c", "start", "", link]]);
  assert.deepEqual(browserCommandFor("darwin", link), ["open", [link]]);
  assert.deepEqual(browserCommandFor("linux", link), ["xdg-open", [link]]);
});

test("only a plain pairing link is ever handed to the system", () => {
  assert.equal(isSafeLink(`http://[::1]:8420/#pair=${CODE}`), true);
  for (const link of ["http://localhost:8420/#pair=a&calc", 'http://localhost/#pair=a"b', "file:///C:/x#pair=a", "http://localhost:8420/x#pair=a", "http://a b/#pair=x"]) {
    assert.equal(isSafeLink(link), false, link);
    assert.throws(() => browserCommandFor("win32", link), /refusing/);
  }
});

test("opening runs the command detached, so the terminal is free at once", () => {
  const calls = [];
  const child = { on: () => child, unref: () => calls.push("unref") };

  openBrowser(`http://localhost:8420/#pair=${CODE}`, { platform: "darwin", run: (command, args, options) => { calls.push([command, args, options.detached]); return child; } });

  assert.deepEqual(calls, [["open", [`http://localhost:8420/#pair=${CODE}`], true], "unref"]);
});
