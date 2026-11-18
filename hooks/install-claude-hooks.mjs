import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isForeignStatusline, withOfficeSettings } from "./lib/claude-settings.mjs";

const officeUrl = process.env.OFFICE_URL ?? "http://127.0.0.1:8420";
const isRemoving = process.argv.includes("--remove");
const hooksDir = dirname(fileURLToPath(import.meta.url));
const settingsPath = join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), "settings.json");

function loadSettings() {
  if (!existsSync(settingsPath)) return {};
  let settings;
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf8"));
  } catch {
    console.error(`Could not read ${settingsPath} as JSON. Nothing was changed.`);
    process.exit(1);
  }
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  copyFileSync(settingsPath, `${settingsPath}.bak-${stamp}`);
  console.log(`Backup: ${settingsPath}.bak-${stamp}`);
  return settings;
}

const settings = loadSettings();
const updated = withOfficeSettings(settings, { isRemoving, officeUrl, hooksDir });
if (isForeignStatusline(settings.statusLine)) {
  console.log("You already have a statusLine, so it was left alone. Usage limits, tokens and cost need the office statusline.");
}

mkdirSync(dirname(settingsPath), { recursive: true });
writeFileSync(settingsPath, `${JSON.stringify(updated, null, 2)}\n`);
console.log(isRemoving
  ? `Office hooks removed from ${settingsPath}.`
  : `Office hooks installed in ${settingsPath}. New Claude Code sessions will show up at ${officeUrl}.`);
