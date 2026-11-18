import { createHmac, randomBytes } from "node:crypto";
import { chmodSync, closeSync, existsSync, fchmodSync, fsyncSync, mkdirSync, openSync, readFileSync, rmSync, writeSync } from "node:fs";
import { dirname } from "node:path";
import { renameWithRetry } from "./atomic-write.mjs";

const KEY_BYTES = 32;
const OWNER_ONLY_DIR = 0o700;
const OWNER_ONLY_FILE = 0o600;
const TEMP_NAME_BYTES = 6;
const WINDOWS = "win32";
const ACTIVITY_TOKEN_LABEL = "orquestra-office/activity-token/v1";

export function parseSecret(text) {
  const encoded = String(text ?? "").trim();
  const key = Buffer.from(encoded, "base64url");
  return key.length === KEY_BYTES && key.toString("base64url") === encoded ? key : null;
}

export function readSecretFile(secretFile) {
  try {
    return parseSecret(readFileSync(secretFile, "utf8"));
  } catch {
    return null;
  }
}

// mkdir only applies the mode to a folder it creates, so an older, wider folder is tightened too.
function ensureOwnerOnlyDir(dir) {
  mkdirSync(dir, { recursive: true, mode: OWNER_ONLY_DIR });
  if (process.platform !== WINDOWS) chmodSync(dir, OWNER_ONLY_DIR);
}

function writeOwnerOnlyFile(path, text) {
  ensureOwnerOnlyDir(dirname(path));
  const tempPath = `${path}.tmp-${process.pid}-${randomBytes(TEMP_NAME_BYTES).toString("hex")}`;
  let isRenamed = false;
  try {
    const fd = openSync(tempPath, "wx", OWNER_ONLY_FILE);
    try {
      fchmodSync(fd, OWNER_ONLY_FILE);
      writeSync(fd, text);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameWithRetry(tempPath, path);
    isRenamed = true;
  } finally {
    if (!isRenamed) rmSync(tempPath, { force: true });
  }
}

export function ensureSecret({ secretFile, rotate = false }) {
  ensureOwnerOnlyDir(dirname(secretFile));
  const current = readSecretFile(secretFile);
  if (current && !rotate) return { key: current, isCreated: false, isRotated: false };
  if (!current && existsSync(secretFile) && !rotate) {
    throw new Error(`${secretFile} is not a valid office secret; run the installer with --rotate-secret to replace it`);
  }
  const key = randomBytes(KEY_BYTES);
  writeOwnerOnlyFile(secretFile, `${key.toString("base64url")}\n`);
  return { key, isCreated: !current, isRotated: rotate };
}

export const activityTokenOf = (key) => createHmac("sha256", key).update(ACTIVITY_TOKEN_LABEL).digest("base64url");

export const activityHeaderText = (key) => `Authorization: Bearer ${activityTokenOf(key)}\n`;

export function ensureActivityHeader(activityHeaderFile, key) {
  const text = activityHeaderText(key);
  const current = existsSync(activityHeaderFile) ? readFileSync(activityHeaderFile, "utf8") : null;
  if (current === text) return false;
  writeOwnerOnlyFile(activityHeaderFile, text);
  return true;
}
