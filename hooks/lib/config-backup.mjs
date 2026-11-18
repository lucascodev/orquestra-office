import { chmodSync, constants, copyFileSync, readdirSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";

export const BACKUPS_KEPT = 3;
const OWNER_ONLY_MODE = 0o600;
const MAX_NAME_ATTEMPTS = 100;
const BACKUP_STAMP = /^(\d{8}-\d{6})(?:-(\d{3}))?(?:-(\d+))?$/;
const BACKUP_MARK = ".bak-";

export const backupStamp = (date) => date.toISOString().replace(/[-:]/g, "").replace("T", "-").replace(".", "-").replace("Z", "");

const backupName = (fileName, stamp, attempt) => `${fileName}${BACKUP_MARK}${stamp}${attempt === 0 ? "" : `-${attempt}`}`;

function backupOrder(fileName, name) {
  if (!name.startsWith(`${fileName}${BACKUP_MARK}`)) return null;
  const match = BACKUP_STAMP.exec(name.slice(fileName.length + BACKUP_MARK.length));
  return match && [match[1], Number(match[2] ?? -1), Number(match[3] ?? 0)];
}

const compareOrder = (a, b) => a[0].localeCompare(b[0]) || a[1] - b[1] || a[2] - b[2];

export function backupsToPrune(fileName, names, keep = BACKUPS_KEPT) {
  return names
    .map((name) => ({ name, order: backupOrder(fileName, name) }))
    .filter(({ order }) => order !== null)
    .sort((a, b) => compareOrder(b.order, a.order))
    .slice(keep)
    .map(({ name }) => name);
}

function copyWithoutOverwriting(path, stamp) {
  for (let attempt = 0; attempt < MAX_NAME_ATTEMPTS; attempt += 1) {
    const backupPath = join(dirname(path), backupName(basename(path), stamp, attempt));
    try {
      copyFileSync(path, backupPath, constants.COPYFILE_EXCL);
      return backupPath;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  throw new Error(`Could not find a free backup name for ${path}`);
}

// The settings env block can hold tokens, so the copy is never more readable than its owner needs.
export function backupConfig(path, now = new Date()) {
  const backupPath = copyWithoutOverwriting(path, backupStamp(now));
  if (process.platform !== "win32") chmodSync(backupPath, OWNER_ONLY_MODE);
  for (const name of backupsToPrune(basename(path), readdirSync(dirname(path)))) rmSync(join(dirname(path), name));
  return backupPath;
}
