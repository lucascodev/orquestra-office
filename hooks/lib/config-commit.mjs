import { mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { ConcurrentChangeError, writeFileAtomically } from "./atomic-write.mjs";
import { backupConfig, pruneBackups } from "./config-backup.mjs";

// Old backups are pruned only after the write succeeds, so failed runs never push the good ones out.
export function commitConfig({ path, originalText, nextText }) {
  if (nextText === originalText) return { isUnchanged: true, hasChangedMeanwhile: false, backupPath: null };
  const backupPath = originalText === null ? null : backupConfig(path);
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileAtomically(path, nextText, { expectedText: originalText });
  } catch (error) {
    if (backupPath) rmSync(backupPath, { force: true });
    if (!(error instanceof ConcurrentChangeError)) throw error;
    return { isUnchanged: true, hasChangedMeanwhile: true, backupPath: null };
  }
  if (backupPath) pruneBackups(path);
  return { isUnchanged: false, hasChangedMeanwhile: false, backupPath };
}
