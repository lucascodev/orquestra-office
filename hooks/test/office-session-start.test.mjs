import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fakeHome } from "./support/fake-home.mjs";
import { startFakeOffice } from "./support/fake-office.mjs";
import { requestedUrls, runHookScript, runRecordingFetch } from "./support/run-hook-script.mjs";

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
  assert.equal(request.authorization, "Bearer dI1HY_vzPeHro_qQK3S9fh-cVNpGcLIH77tBN1IPe7I");
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

const MARK_WHEN_RUN_AS_GIT = (marker) => `if (/^git\\.exe$/i.test(require("node:path").basename(process.execPath))) require("node:fs").writeFileSync(${JSON.stringify(marker)}, "ran");\n`;

test("never runs a git.exe or git.cmd planted in the opened repository", { skip: process.platform !== "win32" && "only Windows looks for programs in the current folder" }, async (t) => {
  const repository = realpathSync.native(mkdtempSync(join(tmpdir(), "office-planted-git-")));
  t.after(() => rmSync(repository, { recursive: true, force: true }));
  const marker = join(repository, "planted-git-ran");
  const preload = join(repository, "mark.cjs");
  copyFileSync(process.execPath, join(repository, "git.exe"));
  writeFileSync(join(repository, "git.cmd"), `@echo ran > "${marker}"\r\n`);
  writeFileSync(preload, MARK_WHEN_RUN_AS_GIT(marker));

  const result = await runHookScript(SCRIPT, {
    env: { OFFICE_URL: UNREACHABLE_OFFICE, NODE_OPTIONS: `--require "${preload.replaceAll("\\", "/")}"` },
    input: JSON.stringify({ session_id: "x", cwd: repository }),
  });

  assert.equal(result.code, 0);
  assert.equal(existsSync(marker), false);
});

const BLANK_OFFICE_URLS = ["", "   "];
const REFUSED_OFFICE_URLS = ["http://evil.example", "https://evil.example", "http://user:pw@127.0.0.1:8420", "http://127.0.0.1:8420/x", "not a url"];

test("without OFFICE_URL reports to the default office", async (t) => {
  const urls = await requestedUrls(t, SCRIPT, { input: JSON.stringify({ session_id: "x", cwd: tmpdir() }) });

  assert.deepEqual(urls, ["http://127.0.0.1:8420/events/claude"]);
});

for (const officeUrl of BLANK_OFFICE_URLS) {
  test(`an OFFICE_URL of "${officeUrl}" counts as unset and reports to the default office`, async (t) => {
    const urls = await requestedUrls(t, SCRIPT, { env: { OFFICE_URL: officeUrl }, input: JSON.stringify({ session_id: "x", cwd: tmpdir() }) });

    assert.deepEqual(urls, ["http://127.0.0.1:8420/events/claude"]);
  });
}

for (const officeUrl of REFUSED_OFFICE_URLS) {
  test(`a refused OFFICE_URL "${officeUrl}" turns the hook off: no report, no output, exit 0`, async (t) => {
    const result = await runRecordingFetch(t, SCRIPT, { env: { OFFICE_URL: officeUrl }, input: JSON.stringify({ session_id: "x", cwd: tmpdir() }) });

    assert.deepEqual(result.urls, []);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
    assert.equal(result.code, 0);
  });
}

test("reports to OFFICE_URL when it is a loopback origin", async (t) => {
  const urls = await requestedUrls(t, SCRIPT, { env: { OFFICE_URL: "http://localhost:1234/" }, input: JSON.stringify({ session_id: "x", cwd: tmpdir() }) });

  assert.deepEqual(urls, ["http://localhost:1234/events/claude"]);
});

test("without the office secret it reports nothing and prints nothing", async (t) => {
  const office = await startFakeOffice(t);
  const { env } = fakeHome(t);

  const result = await runHookScript(SCRIPT, { env: { ...env, OFFICE_URL: office.url }, input: JSON.stringify({ session_id: "x", cwd: tmpdir() }) });

  assert.equal(result.code, 0);
  assert.equal(result.stdout, "");
  assert.deepEqual(office.requests, []);
});
