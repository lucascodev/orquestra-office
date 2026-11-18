import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeClaudeEvent } from "../src/claude/claude-event.js";
import { createOffice } from "../src/composition.js";
import { listenOnFetchablePort } from "./support/listen-on-fetchable-port.js";

const WEB_DIR = "/nonexistent";
const STATE_FILE = "office.json";
const SAVE_DELAY_MS = 2_000;
const SWEEP_INTERVAL_MS = 30_000;
const BREAK_TO_IDLE_MS = 10 * 60_000;
const HOLD_MS = 5_000;
const NO_VIEWER_TEST_TIMEOUT_MS = 1_000;
const STARTED_AT = Date.UTC(2026, 0, 10, 12, 0);

const claudeEvent = (hookEventName, at = STARTED_AT) =>
  normalizeClaudeEvent({ session_id: "s1", cwd: "/home/dev/loja", hook_event_name: hookEventName }, at);
const agentOf = (office) => office.store.findAgent("claude:s1");

async function withDataDir(run) {
  const dir = await mkdtemp(join(tmpdir(), "office-composition-"));
  try { await run(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

test("the office saves its state on stop and a new office over the same folder loads it back", () => withDataDir(async (dataDir) => {
  const first = createOffice({ webDir: WEB_DIR, dataDir });
  first.store.apply(claudeEvent("SessionStart"));
  first.stop();

  const second = createOffice({ webDir: WEB_DIR, dataDir });
  try {
    assert.deepEqual(Object.keys(second.store.snapshot().projects), ["/home/dev/loja"]);
    assert.equal(agentOf(second).status, "idle");
  } finally {
    second.stop();
  }
}));

test("a change is saved on its own once the save delay passes", (t) => withDataDir(async (dataDir) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const office = createOffice({ webDir: WEB_DIR, dataDir });
  const stateFile = join(dataDir, STATE_FILE);
  try {
    office.store.apply(claudeEvent("SessionStart"));
    t.mock.timers.tick(SAVE_DELAY_MS - 1);
    assert.equal(existsSync(stateFile), false);
    t.mock.timers.tick(1);
    assert.equal(existsSync(stateFile), true);
  } finally {
    office.stop();
  }
}));

test("the sweep runs on its own every interval once started", (t) => {
  t.mock.timers.enable({ apis: ["setInterval", "Date"], now: STARTED_AT });
  const office = createOffice({ webDir: WEB_DIR });
  office.store.apply(claudeEvent("Stop"));
  office.startSweep();
  try {
    t.mock.timers.tick(BREAK_TO_IDLE_MS);
    assert.equal(agentOf(office).status, "break");
    t.mock.timers.tick(SWEEP_INTERVAL_MS);
    assert.equal(agentOf(office).status, "idle");
  } finally {
    office.stop();
  }
});

test("a sweep that throws is reported and the next sweep still runs", (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const reportError = t.mock.method(console, "error", () => {});
  const office = createOffice({ webDir: WEB_DIR });
  const sweep = t.mock.method(office.store, "sweep", () => { throw new Error("sweep exploded"); });
  office.startSweep();
  try {
    assert.doesNotThrow(() => t.mock.timers.tick(SWEEP_INTERVAL_MS));
    t.mock.timers.tick(SWEEP_INTERVAL_MS);
    assert.equal(sweep.mock.callCount(), 2);
    assert.equal(reportError.mock.callCount(), 2);
  } finally {
    office.stop();
  }
});

test("once the office stops, the sweep no longer runs", (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const office = createOffice({ webDir: WEB_DIR });
  const sweep = t.mock.method(office.store, "sweep", () => {});
  office.startSweep();
  t.mock.timers.tick(SWEEP_INTERVAL_MS);
  office.stop();
  t.mock.timers.tick(SWEEP_INTERVAL_MS * 3);
  assert.equal(sweep.mock.callCount(), 1);
});

test("with no office page open a permission goes back to the terminal at once, long before the hold would end", { timeout: NO_VIEWER_TEST_TIMEOUT_MS }, async () => {
  const office = createOffice({ webDir: WEB_DIR, holdMs: HOLD_MS });
  const base = await listenOnFetchablePort(office.server);
  try {
    const hook = await fetch(`${base}/hooks/claude/permission`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: "s1", cwd: "/home/dev/loja", hook_event_name: "PermissionRequest", tool_name: "Bash", tool_input: { command: "rm -rf build" } }),
    });
    assert.deepEqual(await hook.json(), {});
    assert.deepEqual(office.decisions.list(), []);
  } finally {
    office.server.closeAllConnections();
    office.server.close();
    office.stop();
  }
});
