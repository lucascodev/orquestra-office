import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const TEST_SECRET = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8";
export const OTHER_SECRET = "HxwdHh8AAQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRo";
export const TEST_KEY = Buffer.from(TEST_SECRET, "base64url");
export const OTHER_KEY = Buffer.from(OTHER_SECRET, "base64url");

export function secretFileFor(t, secret = TEST_SECRET) {
  const dir = mkdtempSync(join(tmpdir(), "office-secret-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "secret");
  writeFileSync(file, `${secret}\n`);
  return file;
}

let processSecretFile = null;

// For test files whose helpers have no test context: one secret file for the whole run, removed when it ends.
export function processWideSecretFile() {
  if (processSecretFile) return processSecretFile;
  const dir = mkdtempSync(join(tmpdir(), "office-secret-"));
  process.on("exit", () => rmSync(dir, { recursive: true, force: true }));
  processSecretFile = join(dir, "secret");
  writeFileSync(processSecretFile, `${TEST_SECRET}\n`);
  return processSecretFile;
}
