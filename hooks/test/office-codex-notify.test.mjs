import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fakeHome } from "./support/fake-home.mjs";
import { startFakeOffice } from "./support/fake-office.mjs";
import { runHookScript } from "./support/run-hook-script.mjs";

const SCRIPT = "office-codex-notify.mjs";
const UNREACHABLE_OFFICE = "http://127.0.0.1:1";
const THROWAWAY_AUTHORIZATION = "Bearer dI1HY_vzPeHro_qQK3S9fh-cVNpGcLIH77tBN1IPe7I";
const TURN = JSON.stringify({ type: "agent-turn-complete", "turn-id": "t1", "last-assistant-message": "it's \"done\" & $HOME" });
// The previous command writes the arguments it got into the file named by its first argument.
const RECORD_ARGUMENTS = "require('node:fs').writeFileSync(process.argv[1], JSON.stringify(process.argv.slice(2)))";

function recordingPrevious(t) {
  const dir = mkdtempSync(join(tmpdir(), "office-codex-previous-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "arguments.json");
  return { file, command: [process.execPath, "-e", RECORD_ARGUMENTS, file, "turn-ended"] };
}

const run = (officeUrl, previous, options = {}) => runHookScript(SCRIPT, { ...options, args: ["--office-url", officeUrl, "--then", ...previous, TURN] });

test("reports the turn to the office with the activity token and hands the same turn to the previous command", async (t) => {
  const office = await startFakeOffice(t);
  const previous = recordingPrevious(t);

  const result = await run(office.url, previous.command);

  assert.equal(result.code, 0);
  assert.deepEqual(office.requests, [{ method: "POST", url: "/events/codex", contentType: "application/json", authorization: THROWAWAY_AUTHORIZATION, body: TURN }]);
  assert.deepEqual(JSON.parse(readFileSync(previous.file, "utf8")), ["turn-ended", TURN]);
});

test("the previous command still gets the turn when the office is down", async (t) => {
  const previous = recordingPrevious(t);

  const result = await run(UNREACHABLE_OFFICE, previous.command);

  assert.equal(result.code, 0);
  assert.deepEqual(JSON.parse(readFileSync(previous.file, "utf8")), ["turn-ended", TURN]);
});

test("without the office secret nothing is sent, and the previous command still runs", async (t) => {
  const office = await startFakeOffice(t);
  const previous = recordingPrevious(t);
  const { env } = fakeHome(t);

  const result = await run(office.url, previous.command, { env });

  assert.equal(result.code, 0);
  assert.deepEqual(office.requests, []);
  assert.equal(existsSync(previous.file), true);
});

test("a previous command that cannot be started does not stop the report", async (t) => {
  const office = await startFakeOffice(t);

  const result = await run(office.url, [join(tmpdir(), "office-no-such-program.exe")]);

  assert.equal(result.code, 0);
  assert.equal(office.requests.length, 1);
  assert.equal(result.stderr, "");
});

test("a refused office address skips the report and still runs the previous command", async (t) => {
  const previous = recordingPrevious(t);

  const result = await run("file:///etc/passwd", previous.command);

  assert.equal(result.code, 0);
  assert.equal(existsSync(previous.file), true);
});
