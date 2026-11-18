import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BASE_ENV } from "./run-hook-script.mjs";

const PRINT_HOMEDIR = "process.stdout.write(require('node:os').homedir())";

// Proves the child resolves ~ to a temporary folder before a test lets an installer fall back to the home folder.
export function fakeHome(t) {
  const home = mkdtempSync(join(tmpdir(), "office-home-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const env = { HOME: home, USERPROFILE: home };
  assert.equal(execFileSync(process.execPath, ["-e", PRINT_HOMEDIR], { env: { ...BASE_ENV, ...env }, encoding: "utf8" }), home);
  return { home, env };
}
