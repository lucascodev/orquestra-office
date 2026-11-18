import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { officeFilesOf } from "../lib/office-home.mjs";
import { activityHeaderText, activityTokenOf, ensureActivityHeader, ensureSecret, parseSecret, readSecretFile } from "../lib/office-secret.mjs";

const POSIX_ONLY = process.platform === "win32" && "Windows keeps access in the profile ACL, not in mode bits";
const PERMISSION_BITS = 0o777;
const OWNER_ONLY_DIR = 0o700;
const OWNER_ONLY_FILE = 0o600;
const FIXED_SECRET = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8";
const FIXED_ACTIVITY_TOKEN = "dI1HY_vzPeHro_qQK3S9fh-cVNpGcLIH77tBN1IPe7I";

function fakeHomeDir(t) {
  const home = mkdtempSync(join(tmpdir(), "office-secret-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  return home;
}

const modeOf = (path) => statSync(path).mode & PERMISSION_BITS;

test("the office folder and its files sit under the given home, in .orquestra-office", () => {
  const files = officeFilesOf(join("/home", "ana"));

  assert.equal(files.dir, join("/home", "ana", ".orquestra-office"));
  assert.equal(files.secretFile, join("/home", "ana", ".orquestra-office", "secret"));
  assert.equal(files.activityHeaderFile, join("/home", "ana", ".orquestra-office", "activity.header"));
});

test("the paths come from the home folder passed in, never from an environment variable", () => {
  for (const file of ["office-home.mjs", "office-secret.mjs"]) {
    assert.doesNotMatch(readFileSync(new URL(`../lib/${file}`, import.meta.url), "utf8"), /process\.env|homedir\(/, file);
  }
});

test("creates a 32-byte secret in base64url and reads it back", (t) => {
  const { secretFile } = officeFilesOf(fakeHomeDir(t));

  const created = ensureSecret({ secretFile });

  assert.equal(created.isCreated, true);
  assert.equal(created.key.length, 32);
  assert.match(readFileSync(secretFile, "utf8"), /^[\w-]{43}\n$/);
  assert.deepEqual(readSecretFile(secretFile), created.key);
});

test("keeps the folder and the secret readable only by the owner", { skip: POSIX_ONLY }, (t) => {
  const { dir, secretFile } = officeFilesOf(fakeHomeDir(t));

  ensureSecret({ secretFile });

  assert.equal(modeOf(dir), OWNER_ONLY_DIR);
  assert.equal(modeOf(secretFile), OWNER_ONLY_FILE);
});

test("tightens a folder that already existed with wider permissions", { skip: POSIX_ONLY }, (t) => {
  const { dir, secretFile } = officeFilesOf(fakeHomeDir(t));
  mkdirSync(dir, { mode: 0o755 });

  ensureSecret({ secretFile });

  assert.equal(modeOf(dir), OWNER_ONLY_DIR);
});

test("never overwrites an existing secret", (t) => {
  const { secretFile } = officeFilesOf(fakeHomeDir(t));
  const first = ensureSecret({ secretFile });

  const second = ensureSecret({ secretFile });

  assert.equal(second.isCreated, false);
  assert.deepEqual(second.key, first.key);
});

test("rotating writes a new secret and leaves no temporary file behind", (t) => {
  const { dir, secretFile } = officeFilesOf(fakeHomeDir(t));
  const first = ensureSecret({ secretFile });

  const rotated = ensureSecret({ secretFile, rotate: true });

  assert.equal(rotated.isRotated, true);
  assert.notDeepEqual(rotated.key, first.key);
  assert.deepEqual(readSecretFile(secretFile), rotated.key);
  assert.deepEqual(readdirSync(dir), ["secret"]);
});

test("refuses to replace a secret file it cannot read unless asked to rotate", (t) => {
  const { dir, secretFile } = officeFilesOf(fakeHomeDir(t));
  mkdirSync(dir);
  writeFileSync(secretFile, "not a secret");

  assert.throws(() => ensureSecret({ secretFile }), /--rotate-secret/);
  assert.equal(readFileSync(secretFile, "utf8"), "not a secret");
  assert.equal(ensureSecret({ secretFile, rotate: true }).key.length, 32);
});

test("reads only a well-formed 32-byte key", () => {
  assert.equal(parseSecret(`${FIXED_SECRET}\n`).length, 32);
  assert.equal(parseSecret(FIXED_SECRET.slice(1)), null);
  assert.equal(parseSecret(`${FIXED_SECRET}AAAA`), null);
  assert.equal(parseSecret(`${FIXED_SECRET.slice(0, -1)}+`), null);
  assert.equal(parseSecret(""), null);
});

test("a missing secret file reads as null", (t) => {
  assert.equal(readSecretFile(officeFilesOf(fakeHomeDir(t)).secretFile), null);
});

test("derives a fixed activity token from the secret", () => {
  assert.equal(activityTokenOf(parseSecret(FIXED_SECRET)), FIXED_ACTIVITY_TOKEN);
  assert.equal(activityHeaderText(parseSecret(FIXED_SECRET)), `Authorization: Bearer ${FIXED_ACTIVITY_TOKEN}\n`);
});

test("writes the activity header next to the secret and rewrites it only when the secret changes", (t) => {
  const { secretFile, activityHeaderFile } = officeFilesOf(fakeHomeDir(t));
  const { key } = ensureSecret({ secretFile });

  assert.equal(ensureActivityHeader(activityHeaderFile, key), true);
  assert.equal(readFileSync(activityHeaderFile, "utf8"), activityHeaderText(key));
  assert.equal(ensureActivityHeader(activityHeaderFile, key), false);

  const rotated = ensureSecret({ secretFile, rotate: true });
  assert.equal(ensureActivityHeader(activityHeaderFile, rotated.key), true);
  assert.equal(readFileSync(activityHeaderFile, "utf8"), activityHeaderText(rotated.key));
});

test("keeps the activity header readable only by the owner", { skip: POSIX_ONLY }, (t) => {
  const { secretFile, activityHeaderFile } = officeFilesOf(fakeHomeDir(t));

  ensureActivityHeader(activityHeaderFile, ensureSecret({ secretFile }).key);

  assert.equal(modeOf(activityHeaderFile), OWNER_ONLY_FILE);
});
