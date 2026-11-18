import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { ConcurrentChangeError, writeFileAtomically } from "./atomic-write.mjs";
import { backupConfig } from "./config-backup.mjs";

export function commitConfig({ path, originalText, nextText }) {
  if (nextText === originalText) return { isUnchanged: true, hasChangedMeanwhile: false, backupPath: null };
  const backupPath = originalText === null ? null : backupConfig(path);
  mkdirSync(dirname(path), { recursive: true });
  try {
    writeFileAtomically(path, nextText, { expectedText: originalText });
  } catch (error) {
    if (!(error instanceof ConcurrentChangeError)) throw error;
    return { isUnchanged: true, hasChangedMeanwhile: true, backupPath };
  }
  return { isUnchanged: false, hasChangedMeanwhile: false, backupPath };
}
