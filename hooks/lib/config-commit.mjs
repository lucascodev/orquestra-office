import { mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { ConcurrentChangeError, writeFileAtomically } from "./atomic-write.mjs";
import { backupConfig, pruneBackups } from "./config-backup.mjs";

// The config is already replaced when pruning runs, so a backup that cannot be removed is reported, never thrown as a failed save.
function pruneBestEffort(path) {
  try {
    pruneBackups(path);
    return null;
  } catch (error) {
    return error;
  }
}

// Old backups are pruned only after the write succeeds, so failed runs never push the good ones out.
export function commitConfig({ path, originalText, nextText }) {
  if (nextText === originalText) return { isUnchanged: true, hasChangedMeanwhile: false, backupPath: null, pruneError: null };
  const backupPath = originalText === null ? null : backupConfig(path);
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileAtomically(path, nextText, { expectedText: originalText });
  } catch (error) {
    if (backupPath) rmSync(backupPath, { force: true });
    if (!(error instanceof ConcurrentChangeError)) throw error;
    return { isUnchanged: true, hasChangedMeanwhile: true, backupPath: null, pruneError: null };
  }
  return { isUnchanged: false, hasChangedMeanwhile: false, backupPath, pruneError: backupPath ? pruneBestEffort(path) : null };
}
