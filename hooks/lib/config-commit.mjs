import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { backupConfig } from "./config-backup.mjs";

export function commitConfig({ path, originalText, nextText }) {
  if (nextText === originalText) return { isUnchanged: true, backupPath: null };
  const backupPath = originalText === null ? null : backupConfig(path);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, nextText);
  return { isUnchanged: false, backupPath };
}
