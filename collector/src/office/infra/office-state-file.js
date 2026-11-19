import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { savedOfficeStateOf } from "../domain/saved-office-state.js";

const SAVE_DELAY_MS = 2_000;
const MISSING_FILE = "ENOENT";
const OWNER_ONLY_FILE = 0o600;
const OWNER_ONLY_FOLDER = 0o700;

export function createOfficeStateFile(dataDir) {
  const file = join(dataDir, "office.json");
  let timer = null;

  function saveNow(state) {
    clearTimeout(timer);
    timer = null;
    try {
      mkdirSync(dataDir, { recursive: true, mode: OWNER_ONLY_FOLDER });
      const temp = `${file}.tmp`;
      // A temp file left by a crash keeps its old mode through writeFileSync, so it goes first.
      rmSync(temp, { force: true });
      writeFileSync(temp, JSON.stringify(savedOfficeStateOf(state)), { mode: OWNER_ONLY_FILE });
      renameSync(temp, file);
    } catch (error) {
      console.error(`could not save office state: ${error.code ?? error.message}`);
    }
  }

  return {
    load() {
      try {
        return JSON.parse(readFileSync(file, "utf8"));
      } catch (error) {
        if (error.code !== MISSING_FILE) console.error(`could not read office state, starting empty: ${error.code ?? error.message}`);
        return null;
      }
    },
    scheduleSave(state) {
      clearTimeout(timer);
      timer = setTimeout(() => saveNow(state), SAVE_DELAY_MS);
    },
    saveNow,
  };
}
