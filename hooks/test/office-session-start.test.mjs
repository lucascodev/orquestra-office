import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fakeHome } from "./support/fake-home.mjs";
import { startFakeOffice } from "./support/fake-office.mjs";
import { requestedUrls, runHookScript, runRecordingFetch } from "./support/run-hook-script.mjs";

const SCRIPT = "office-session-start.mjs";
const UNREACHABLE_OFFICE = "http://127.0.0.1:1";
const DEFAULT_REPORT = "http://127.0.0.1:8420/events/claude";

const at = (officeUrl) => ["--office-url", officeUrl];

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

  const result = await runHookScript(SCRIPT, { args: at(office.url), input: JSON.stringify(payload) });

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

  await runHookScript(SCRIPT, { args: at(office.url), input: JSON.stringify({ session_id: "s2", cwd: root }), cwd: root });

  const sent = JSON.parse(office.requests[0].body);
  assert.equal(sent.office.repoRoot, "");
  assert.deepEqual([...sent.office.team].sort(), ["planner", "reviewer"]);
});

test("exits 0 silently when the office is down", async () => {
  const result = await runHookScript(SCRIPT, { args: at(UNREACHABLE_OFFICE), input: JSON.stringify({ session_id: "x", cwd: tmpdir() }) });

  assert.equal(result.code, 0);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("exits 0 silently and reports nothing for input that is not JSON", async (t) => {
  const office = await startFakeOffice(t);

  const result = await runHookScript(SCRIPT, { args: at(office.url), input: "not json" });

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
    args: at(UNREACHABLE_OFFICE),
    env: { NODE_OPTIONS: `--require "${preload.replaceAll("\\", "/")}"` },
    input: JSON.stringify({ session_id: "x", cwd: repository }),
  });

  assert.equal(result.code, 0);
  assert.equal(existsSync(marker), false);
});

const OLD_LIBUV = pathToFileURL(fileURLToPath(new URL("./support/old-libuv.mjs", import.meta.url))).href;

function gitOnPath(t) {
  const dir = realpathSync.native(mkdtempSync(join(tmpdir(), "office-fake-git-")));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const marker = join(dir, "fake-git-ran");
  const preload = join(dir, "mark.cjs");
  copyFileSync(process.execPath, join(dir, "git.exe"));
  writeFileSync(preload, MARK_WHEN_RUN_AS_GIT(marker));
  const env = { PATH: `${dir}${delimiter}${process.env.PATH}`, NODE_OPTIONS: `--require "${preload.replaceAll("\\", "/")}"` };
  return { marker, env };
}

test("with libuv 1.47 on Windows the hook never looks git up", { skip: process.platform !== "win32" && "the libuv version only matters on Windows" }, async (t) => {
  const input = JSON.stringify({ session_id: "x", cwd: tmpdir() });
  const current = gitOnPath(t);
  const old = gitOnPath(t);

  await runHookScript(SCRIPT, { env: current.env, args: at(UNREACHABLE_OFFICE), input });
  const result = await runHookScript(SCRIPT, { env: old.env, args: at(UNREACHABLE_OFFICE), input, nodeArgs: ["--import", OLD_LIBUV] });

  assert.equal(existsSync(current.marker), true, "the git on PATH should run with the current libuv, or this test proves nothing");
  assert.equal(result.code, 0);
  assert.equal(existsSync(old.marker), false);
});

const REFUSED_OFFICE_URLS = ["", "   ", "http://evil.example", "http://user:pw@127.0.0.1:8420", "http://127.0.0.1:8420/x", "not a url", "https://a$(id).example"];

test("without --office-url reports to the default office", async (t) => {
  const urls = await requestedUrls(t, SCRIPT, { input: JSON.stringify({ session_id: "x", cwd: tmpdir() }) });

  assert.deepEqual(urls, [DEFAULT_REPORT]);
});

test("OFFICE_URL in the environment, which a project's settings can set, is never followed", async (t) => {
  const urls = await requestedUrls(t, SCRIPT, { env: { OFFICE_URL: "http://localhost:1234" }, input: JSON.stringify({ session_id: "x", cwd: tmpdir() }) });

  assert.deepEqual(urls, [DEFAULT_REPORT]);
});

for (const officeUrl of REFUSED_OFFICE_URLS) {
  test(`a refused --office-url "${officeUrl}" turns the hook off: no report, no output, exit 0`, async (t) => {
    const result = await runRecordingFetch(t, SCRIPT, { args: at(officeUrl), input: JSON.stringify({ session_id: "x", cwd: tmpdir() }) });

    assert.deepEqual(result.urls, []);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
    assert.equal(result.code, 0);
  });
}

test("reports to the --office-url the installer wrote, normalized to its origin and with localhost as 127.0.0.1", async (t) => {
  const urls = await requestedUrls(t, SCRIPT, { args: at("http://localhost:1234/"), input: JSON.stringify({ session_id: "x", cwd: tmpdir() }) });

  assert.deepEqual(urls, ["http://127.0.0.1:1234/events/claude"]);
});

test("without the office secret it reports nothing and prints nothing", async (t) => {
  const office = await startFakeOffice(t);
  const { env } = fakeHome(t);

  const result = await runHookScript(SCRIPT, { env, args: at(office.url), input: JSON.stringify({ session_id: "x", cwd: tmpdir() }) });

  assert.equal(result.code, 0);
  assert.equal(result.stdout, "");
  assert.deepEqual(office.requests, []);
});
