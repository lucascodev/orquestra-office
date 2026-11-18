import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { startFakeOffice } from "./support/fake-office.mjs";
import { runHookScript } from "./support/run-hook-script.mjs";

const SCRIPT = "office-session-start.mjs";
const UNREACHABLE_OFFICE = "http://127.0.0.1:1";

function projectWithTeam(t, { isGitRepository }) {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), "office-session-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  if (isGitRepository) execFileSync("git", ["init", "--quiet", root]);
  const agents = join(root, ".claude", "agents");
  mkdirSync(agents, { recursive: true });
  for (const name of ["reviewer.md", "planner.MD", "notes.txt"]) writeFileSync(join(agents, name), "secret instructions");
  mkdirSync(join(root, "src"));
  return root;
}

test("reports the session with the repository root and the team's role names, printing nothing", async (t) => {
  const office = await startFakeOffice(t);
  const root = projectWithTeam(t, { isGitRepository: true });
  const payload = { session_id: "s1", hook_event_name: "SessionStart", cwd: join(root, "src") };

  const result = await runHookScript(SCRIPT, { env: { OFFICE_URL: office.url }, input: JSON.stringify(payload) });

  assert.equal(result.code, 0);
  assert.equal(result.stdout, "");
  assert.equal(office.requests.length, 1);
  const [request] = office.requests;
  assert.equal(request.url, "/events/claude");
  assert.equal(request.contentType, "application/json");
  const sent = JSON.parse(request.body);
  assert.equal(sent.session_id, "s1");
  assert.equal(resolve(sent.office.repoRoot), root);
  assert.deepEqual([...sent.office.team].sort(), ["planner", "reviewer"]);
  assert.ok(!request.body.includes("secret instructions"));
});

test("outside a git repository reads the team from cwd and sends an empty repoRoot", async (t) => {
  const office = await startFakeOffice(t);
  const root = projectWithTeam(t, { isGitRepository: false });

  await runHookScript(SCRIPT, { env: { OFFICE_URL: office.url }, input: JSON.stringify({ session_id: "s2", cwd: root }), cwd: root });

  const sent = JSON.parse(office.requests[0].body);
  assert.equal(sent.office.repoRoot, "");
  assert.deepEqual([...sent.office.team].sort(), ["planner", "reviewer"]);
});

test("exits 0 silently when the office is down", async () => {
  const result = await runHookScript(SCRIPT, { env: { OFFICE_URL: UNREACHABLE_OFFICE }, input: JSON.stringify({ session_id: "x", cwd: tmpdir() }) });

  assert.equal(result.code, 0);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("exits 0 silently and reports nothing for input that is not JSON", async (t) => {
  const office = await startFakeOffice(t);

  const result = await runHookScript(SCRIPT, { env: { OFFICE_URL: office.url }, input: "not json" });

  assert.equal(result.code, 0);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
  assert.deepEqual(office.requests, []);
});
