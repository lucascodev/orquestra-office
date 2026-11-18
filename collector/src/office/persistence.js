import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SAVE_DELAY_MS = 2_000;

export function createPersistence(dataDir) {
  const file = join(dataDir, "office.json");
  let timer = null;

  function saveNow(state) {
    clearTimeout(timer);
    timer = null;
    try {
      mkdirSync(dataDir, { recursive: true });
      const temp = `${file}.tmp`;
      writeFileSync(temp, JSON.stringify(state));
      renameSync(temp, file);
    } catch (error) {
      console.error(`could not save office state: ${error.code ?? error.message}`);
    }
  }

  return {
    load() {
      try {
        return JSON.parse(readFileSync(file, "utf8"));
      } catch {
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
