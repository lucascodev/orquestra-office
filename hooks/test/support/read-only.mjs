import { chmodSync } from "node:fs";
import { join } from "node:path";

const READ_ONLY_FILE = 0o444;
const READ_ONLY_DIR = 0o555;
const WRITABLE_FILE = 0o666;
const WRITABLE_DIR = 0o755;

export const READ_ONLY_SKIP = typeof process.getuid === "function" && process.getuid() === 0 && "root writes through read-only permissions";

// Windows refuses to rename over a read-only file; POSIX only refuses writes inside a read-only folder.
export function makeUnwritable(dir, file) {
  const isWindows = process.platform === "win32";
  const target = isWindows ? join(dir, file) : dir;
  chmodSync(target, isWindows ? READ_ONLY_FILE : READ_ONLY_DIR);
  return () => chmodSync(target, isWindows ? WRITABLE_FILE : WRITABLE_DIR);
}
