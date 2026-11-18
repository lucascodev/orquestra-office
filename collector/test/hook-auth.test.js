import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { createOffice } from "../src/composition.js";
import { NONCE_HEADER, SIGNATURE_HEADER } from "../src/shared/auth/signed-message.js";
import { activityHeaders, newNonce, postActivity, postSigned, signedHeaders } from "./support/hook-client.js";
import { listenOnFetchablePort } from "./support/listen-on-fetchable-port.js";
import { OTHER_KEY, OTHER_SECRET, secretFileFor } from "./support/office-secret.js";

const JSON_TYPE = { "Content-Type": "application/json" };
const SESSION = { session_id: "s1", cwd: "/tmp/demo" };
const PERMISSION_PATH = "/hooks/claude/permission";
const STOP_PATH = "/hooks/claude/stop";
const HOLD_MS = 5_000;
const ACTIVITY_ROUTES = ["/events/claude", "/events/statusline", "/events/codex"];
const SIGNED_ROUTES = [PERMISSION_PATH, "/hooks/claude/question", STOP_PATH];

async function withOffice(t, run, { secretFile = secretFileFor(t) } = {}) {
  const office = createOffice({ webDir: "/nonexistent", holdMs: HOLD_MS, secretFile });
  const base = await listenOnFetchablePort(office.server);
  try { await run(base, office); } finally { office.server.closeAllConnections(); office.server.close(); }
}

const projectsOf = (office) => office.officeView().projects;
const plainPost = (base, path, payload, headers = JSON_TYPE) => fetch(`${base}${path}`, { method: "POST", headers, body: JSON.stringify(payload) });
const permissionPayload = { ...SESSION, hook_event_name: "PermissionRequest", tool_name: "Bash", tool_input: { command: "ls" } };

test("an activity event with the activity token is recorded", (t) => withOffice(t, async (base, office) => {
  const res = await postActivity(base, "/events/claude", { ...SESSION, hook_event_name: "SessionStart" });

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {});
  assert.deepEqual(Object.keys(projectsOf(office)), ["/tmp/demo"]);
}));

for (const path of ACTIVITY_ROUTES) {
  test(`${path} from hooks older than the token answers {} without recording anything and raises the old-hooks notice`, (t) => withOffice(t, async (base, office) => {
    assert.equal(office.officeView().security.legacyHooksSeenAt, null);

    const res = await plainPost(base, path, { ...SESSION, hook_event_name: "SessionStart" });

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {});
    assert.deepEqual(projectsOf(office), {});
    assert.equal(typeof office.officeView().security.legacyHooksSeenAt, "number");
  }));

  test(`${path} with a wrong token is a 401 and records nothing`, (t) => withOffice(t, async (base, office) => {
    const res = await postActivity(base, path, { ...SESSION, hook_event_name: "SessionStart" }, OTHER_KEY);

    assert.equal(res.status, 401);
    assert.deepEqual(projectsOf(office), {});
    assert.equal(office.officeView().security.legacyHooksSeenAt, null);
  }));
}

for (const path of SIGNED_ROUTES) {
  test(`${path} without a signature answers {} without deciding anything and raises the old-hooks notice`, (t) => withOffice(t, async (base, office) => {
    const res = await plainPost(base, path, permissionPayload);

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {});
    assert.equal(res.headers.get(SIGNATURE_HEADER), null);
    assert.deepEqual(projectsOf(office), {});
    assert.equal(typeof office.officeView().security.legacyHooksSeenAt, "number");
  }));

  test(`the activity token is not enough on ${path}`, (t) => withOffice(t, async (base) => {
    assert.equal((await plainPost(base, path, permissionPayload, activityHeaders())).status, 401);
  }));
}

test("a signed permission request with nobody watching answers a signed, empty decision", (t) => withOffice(t, async (base, office) => {
  const answer = await postSigned(base, PERMISSION_PATH, permissionPayload);

  assert.equal(answer.status, 200);
  assert.deepEqual(answer.body, { decision: null });
  assert.equal(answer.isSigned, true);
  assert.equal(office.officeView().security.legacyHooksSeenAt, null);
}));

test("the stop hook answers the queued messages as a signed list", (t) => withOffice(t, async (base) => {
  const answer = await postSigned(base, STOP_PATH, { ...SESSION, hook_event_name: "Stop" });

  assert.deepEqual(answer.body, { messages: [] });
  assert.equal(answer.isSigned, true);
}));

test("a request signed with another key is a 401 and decides nothing", (t) => withOffice(t, async (base, office) => {
  const answer = await postSigned(base, PERMISSION_PATH, permissionPayload, { key: OTHER_KEY });

  assert.equal(answer.status, 401);
  assert.equal(answer.isSigned, false);
  assert.deepEqual(projectsOf(office), {});
}));

test("a signature made for another route is refused", (t) => withOffice(t, async (base) => {
  const body = JSON.stringify(permissionPayload);
  const headers = signedHeaders({ path: STOP_PATH, body });

  assert.equal((await fetch(`${base}${PERMISSION_PATH}`, { method: "POST", headers, body })).status, 401);
}));

test("a body changed after signing is refused", (t) => withOffice(t, async (base) => {
  const headers = signedHeaders({ path: PERMISSION_PATH, body: JSON.stringify(permissionPayload) });
  const changed = JSON.stringify({ ...permissionPayload, tool_input: { command: "rm -rf /" } });

  assert.equal((await fetch(`${base}${PERMISSION_PATH}`, { method: "POST", headers, body: changed })).status, 401);
}));

test("a signed request sent a second time is refused", (t) => withOffice(t, async (base) => {
  const nonce = newNonce();

  assert.equal((await postSigned(base, STOP_PATH, { ...SESSION, hook_event_name: "Stop" }, { nonce })).status, 200);
  assert.equal((await postSigned(base, STOP_PATH, { ...SESSION, hook_event_name: "Stop" }, { nonce })).status, 401);
}));

test("a malformed nonce or a signature without its version is refused", (t) => withOffice(t, async (base) => {
  const body = JSON.stringify(permissionPayload);
  const valid = signedHeaders({ path: PERMISSION_PATH, body });
  const send = (headers) => fetch(`${base}${PERMISSION_PATH}`, { method: "POST", headers: { ...valid, ...headers }, body });

  assert.equal((await send({ [NONCE_HEADER]: "short" })).status, 401);
  assert.equal((await send({ [SIGNATURE_HEADER]: valid[SIGNATURE_HEADER].replace("v1=", "") })).status, 401);
}));

test("without a secret file the state says so and signed requests are refused", (t) => withOffice(t, async (base, office) => {
  assert.equal(office.officeView().security.isSecretMissing, true);
  assert.equal((await postSigned(base, STOP_PATH, { ...SESSION, hook_event_name: "Stop" })).status, 401);
  assert.equal((await postActivity(base, "/events/claude", { ...SESSION, hook_event_name: "SessionStart" })).status, 401);
}, { secretFile: null }));

test("a rotated secret takes effect without a restart", (t) => {
  const secretFile = secretFileFor(t);
  return withOffice(t, async (base) => {
    assert.equal((await postSigned(base, STOP_PATH, { ...SESSION, hook_event_name: "Stop" })).status, 200);
    writeFileSync(secretFile, `${OTHER_SECRET}\n`);

    assert.equal((await postSigned(base, STOP_PATH, { ...SESSION, hook_event_name: "Stop" })).status, 401);
    assert.equal((await postSigned(base, STOP_PATH, { ...SESSION, hook_event_name: "Stop" }, { key: OTHER_KEY })).status, 200);
  }, { secretFile });
});
