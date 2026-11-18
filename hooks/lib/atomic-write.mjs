import { randomBytes } from "node:crypto";
import { closeSync, existsSync, fchmodSync, fsyncSync, openSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeSync } from "node:fs";

const RENAME_ATTEMPTS = 5;
const RENAME_RETRY_DELAY_MS = 100;
const NEW_FILE_MODE = 0o666;
const PERMISSION_BITS = 0o777;
const TEMP_NAME_BYTES = 6;
const TRANSIENT_WINDOWS_ERRORS = new Set(["EPERM", "EBUSY"]);

export class ConcurrentChangeError extends Error {
  constructor(path) {
    super(`${path} changed while it was being updated`);
    this.name = "ConcurrentChangeError";
  }
}

const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const textOnDisk = (path) => (existsSync(path) ? readFileSync(path, "utf8") : null);

// Antivirus and indexers on Windows hold a just-written file for a moment, and rename fails with EPERM or EBUSY meanwhile.
export function renameWithRetry(from, to, { rename = renameSync, platform = process.platform, delayMs = RENAME_RETRY_DELAY_MS } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      rename(from, to);
      return;
    } catch (error) {
      const isTransient = platform === "win32" && TRANSIENT_WINDOWS_ERRORS.has(error.code);
      if (!isTransient || attempt >= RENAME_ATTEMPTS) throw error;
      sleepSync(delayMs);
    }
  }
}

function writeTempFile(tempPath, text, mode) {
  const fd = openSync(tempPath, "wx", mode ?? NEW_FILE_MODE);
  try {
    if (mode !== undefined) fchmodSync(fd, mode);
    writeSync(fd, text);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

// The real path is replaced, not the link: a settings.json kept in a dotfiles repository stays a symlink.
export function writeFileAtomically(path, text, { expectedText }) {
  const realPath = existsSync(path) ? realpathSync(path) : path;
  const mode = existsSync(realPath) ? statSync(realPath).mode & PERMISSION_BITS : undefined;
  const tempPath = `${realPath}.tmp-${process.pid}-${randomBytes(TEMP_NAME_BYTES).toString("hex")}`;
  let isRenamed = false;
  try {
    writeTempFile(tempPath, text, mode);
    if (textOnDisk(realPath) !== expectedText) throw new ConcurrentChangeError(path);
    renameWithRetry(tempPath, realPath);
    isRenamed = true;
  } finally {
    if (!isRenamed) rmSync(tempPath, { force: true });
  }
}
