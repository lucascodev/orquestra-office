import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isForeignStatusline, officeEntries, withOfficeSettings } from "./lib/claude-settings.mjs";
import { settingsShapeProblem } from "./lib/claude-settings-shape.mjs";
import { backupConfig } from "./lib/config-backup.mjs";
import { envValue } from "./lib/env-value.mjs";
import { manifestSection, withManifestSection } from "./lib/install-manifest.mjs";
import { manifestPath, readManifestFile, writeManifestFile } from "./lib/manifest-file.mjs";
import { ALLOW_REMOTE_FLAG, installerOfficeUrl } from "./lib/office-url.mjs";

const MANIFEST_SECTION = "claude";

function fail(message) {
  console.error(`${message}. Nothing was changed.`);
  process.exit(1);
}

const isRemoving = process.argv.includes("--remove");
const officeUrlResult = installerOfficeUrl(process.env, { allowRemote: process.argv.includes(ALLOW_REMOTE_FLAG) });
if (officeUrlResult.problem) fail(`OFFICE_URL was refused: ${officeUrlResult.problem}`);
const officeUrl = officeUrlResult.origin;
const hooksDir = dirname(fileURLToPath(import.meta.url));
const configDir = envValue(process.env, "CLAUDE_CONFIG_DIR") ?? join(homedir(), ".claude");
const settingsPath = join(configDir, "settings.json");

function loadManifest() {
  try {
    return readManifestFile(configDir);
  } catch (error) {
    return fail(`Could not read ${manifestPath(configDir)} as the office manifest: ${error.message}`);
  }
}

function loadSettings() {
  if (!existsSync(settingsPath)) return {};
  let settings;
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf8"));
  } catch {
    fail(`Could not read ${settingsPath} as JSON`);
  }
  const shapeProblem = settingsShapeProblem(settings);
  if (shapeProblem) fail(`${settingsPath} is not a settings object: ${shapeProblem}`);
  return settings;
}

const manifest = loadManifest();
const settings = loadSettings();
const options = { isRemoving, officeUrl, hooksDir, recorded: manifestSection(manifest, MANIFEST_SECTION) };
const updated = withOfficeSettings(settings, options);
if (isForeignStatusline(settings.statusLine, options)) {
  console.log("You already have a statusLine, so it was left alone. Usage limits, tokens and cost need the office statusline.");
}

if (existsSync(settingsPath)) console.log(`Backup: ${backupConfig(settingsPath)}`);
mkdirSync(configDir, { recursive: true });
writeFileSync(settingsPath, `${JSON.stringify(updated, null, 2)}\n`);
writeManifestFile(configDir, withManifestSection(manifest, MANIFEST_SECTION, isRemoving ? null : officeEntries(options)));
console.log(isRemoving
  ? `Office hooks removed from ${settingsPath}.`
  : `Office hooks installed in ${settingsPath}. New Claude Code sessions will show up at ${officeUrl}.`);
