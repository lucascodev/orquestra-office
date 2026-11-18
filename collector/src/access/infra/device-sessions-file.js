import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MISSING_FILE = "ENOENT";
const OWNER_ONLY_FILE = 0o600;

// Only hashes of the device cookies are written, so a copy of this file opens nothing.
export function createDeviceSessionsFile(dataDir) {
  const file = join(dataDir, "devices.json");

  return {
    load() {
      try {
        return JSON.parse(readFileSync(file, "utf8"));
      } catch (error) {
        if (error.code !== MISSING_FILE) console.error(`could not read paired devices, starting with none: ${error.code ?? error.message}`);
        return null;
      }
    },
    save(snapshot) {
      try {
        mkdirSync(dataDir, { recursive: true });
        const temp = `${file}.tmp`;
        writeFileSync(temp, JSON.stringify(snapshot), { mode: OWNER_ONLY_FILE });
        renameSync(temp, file);
      } catch (error) {
        console.error(`could not save paired devices: ${error.code ?? error.message}`);
      }
    },
  };
}
