import { test } from "node:test";
import assert from "node:assert/strict";
import { createDeviceSessions } from "../src/access/domain/device-sessions.js";
import { createPairingCodes } from "../src/access/domain/pairing-codes.js";

const CODE_TTL_MS = 120_000;
const PENDING_LIMIT = 20;
const DEVICE_LIMIT = 20;
const IDLE_LIMIT_MS = 30 * 24 * 60 * 60_000;
const KEY_ID = "key-a";

function clock(start = 1_000_000) {
  let at = start;
  return { now: () => at, advance: (ms) => { at += ms; } };
}

function sequence(prefix) {
  let next = 0;
  return () => `${prefix}${(next += 1)}`;
}

const codes = (time) => createPairingCodes({ newCode: sequence("code-"), now: time.now });

test("a pairing code works once", () => {
  const pairing = codes(clock());
  const { code } = pairing.issue();

  assert.equal(pairing.redeem(code), true);
  assert.equal(pairing.redeem(code), false);
});

test("a pairing code expires after two minutes", () => {
  const time = clock();
  const pairing = codes(time);
  const issued = pairing.issue();

  assert.equal(issued.expiresAt, time.now() + CODE_TTL_MS);
  time.advance(CODE_TTL_MS);
  assert.equal(pairing.redeem(issued.code), false);
});

test("an expired code cannot be redeemed even if nothing pruned it", () => {
  const time = clock();
  const pairing = codes(time);
  const early = pairing.issue();
  time.advance(CODE_TTL_MS - 1);
  const late = pairing.issue();
  time.advance(1);

  assert.equal(pairing.redeem(early.code), false);
  assert.equal(pairing.redeem(late.code), true);
});

test("an unknown code or one that is not text is refused", () => {
  const pairing = codes(clock());
  pairing.issue();

  for (const code of ["code-2", "", undefined, null, 42, { code: "code-1" }]) assert.equal(pairing.redeem(code), false, String(code));
});

test("no more than twenty codes wait at once, and expired ones free their place", () => {
  const time = clock();
  const pairing = codes(time);
  for (let index = 0; index < PENDING_LIMIT; index += 1) assert.ok(pairing.issue());

  assert.equal(pairing.issue(), null);
  time.advance(CODE_TTL_MS);
  assert.ok(pairing.issue());
});

const sessions = (time, saved = null, keyId = KEY_ID) => createDeviceSessions({ saved, keyId, now: time.now, newId: sequence("device-") });

test("a device is found by the hash of its token and keeps only the hash", () => {
  const devices = sessions(clock());

  const added = devices.add({ tokenHash: "hash-1", label: "Chrome", host: "localhost:8420" });

  assert.equal(devices.findByTokenHash("hash-1").id, added.id);
  assert.equal(devices.findByTokenHash("hash-2"), null);
  assert.deepEqual(Object.keys(devices.snapshot().devices[0]).sort(), ["createdAt", "host", "id", "label", "lastSeenAt", "tokenHash"]);
});

test("label and host are cut to size and stripped of control characters", () => {
  const devices = sessions(clock());

  const added = devices.add({ tokenHash: "h", label: `Phone\u0000\n${"x".repeat(80)}`, host: "h".repeat(400) });

  assert.equal(added.label.length, 40);
  assert.ok(!/[\u0000-\u001f]/.test(added.label));
  assert.equal(added.host.length, 255);
});

test("a revoked device is no longer found", () => {
  const devices = sessions(clock());
  const added = devices.add({ tokenHash: "hash-1", label: "a", host: "h" });

  assert.equal(devices.revoke(added.id), true);
  assert.equal(devices.findByTokenHash("hash-1"), null);
  assert.equal(devices.revoke(added.id), false);
});

test("a device unused for 30 days is dropped, and using it keeps it", () => {
  const time = clock();
  const devices = sessions(time);
  devices.add({ tokenHash: "kept", label: "a", host: "h" });
  devices.add({ tokenHash: "idle", label: "b", host: "h" });

  time.advance(IDLE_LIMIT_MS - 1);
  devices.touch(devices.findByTokenHash("kept").id);
  time.advance(1);

  assert.ok(devices.findByTokenHash("kept"));
  assert.equal(devices.findByTokenHash("idle"), null);
});

test("the twenty-first device takes the place of the one unused the longest", () => {
  const time = clock();
  const devices = sessions(time);
  for (let index = 0; index < DEVICE_LIMIT; index += 1) {
    devices.add({ tokenHash: `hash-${index}`, label: "a", host: "h" });
    time.advance(1);
  }
  devices.touch(devices.findByTokenHash("hash-0").id);

  devices.add({ tokenHash: "newest", label: "a", host: "h" });

  assert.equal(devices.list().length, DEVICE_LIMIT);
  assert.ok(devices.findByTokenHash("hash-0"));
  assert.equal(devices.findByTokenHash("hash-1"), null);
});

test("saved devices come back only under the same key", () => {
  const time = clock();
  const first = sessions(time);
  first.add({ tokenHash: "hash-1", label: "a", host: "h" });
  const saved = JSON.parse(JSON.stringify(first.snapshot()));

  assert.ok(sessions(time, saved).findByTokenHash("hash-1"));
  assert.equal(sessions(time, saved, "key-b").findByTokenHash("hash-1"), null);
  assert.equal(sessions(time, { ...saved, version: 2 }).findByTokenHash("hash-1"), null);
});

test("a new key drops every device at once", () => {
  const devices = sessions(clock());
  devices.add({ tokenHash: "hash-1", label: "a", host: "h" });

  devices.useKey("key-b");

  assert.equal(devices.findByTokenHash("hash-1"), null);
  assert.equal(devices.snapshot().keyId, "key-b");
});

test("changes are announced so they can be saved", () => {
  const devices = sessions(clock());
  let changes = 0;
  devices.onChange(() => { changes += 1; });

  const added = devices.add({ tokenHash: "hash-1", label: "a", host: "h" });
  devices.revoke(added.id);

  assert.equal(changes, 2);
});
