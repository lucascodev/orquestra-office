import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isForeignStatusline, officeEntries, withOfficeSettings } from "./lib/claude-settings.mjs";
import { settingsShapeProblem } from "./lib/claude-settings-shape.mjs";
import { commitConfig } from "./lib/config-commit.mjs";
import { envValue } from "./lib/env-value.mjs";
import { hooksDirProblem } from "./lib/hooks-dir.mjs";
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
const unsafeHooksDir = isRemoving ? null : hooksDirProblem(hooksDir);
if (unsafeHooksDir) fail(`Could not install: ${unsafeHooksDir}`);
const configDir = envValue(process.env, "CLAUDE_CONFIG_DIR") ?? join(homedir(), ".claude");
const settingsPath = join(configDir, "settings.json");

function loadManifest() {
  try {
    return readManifestFile(configDir);
  } catch (error) {
    return fail(`Could not read ${manifestPath(configDir)} as the office manifest: ${error.message}`);
  }
}

function commitOrFail(change) {
  try {
    return commitConfig(change);
  } catch (error) {
    return fail(`Could not save ${change.path} (${error.code ?? error.message}); check that it is not read-only or open in another program`);
  }
}

function parseSettings(text) {
  if (text === null) return {};
  let settings;
  try {
    settings = JSON.parse(text);
  } catch {
    fail(`Could not read ${settingsPath} as JSON`);
  }
  const shapeProblem = settingsShapeProblem(settings);
  if (shapeProblem) fail(`${settingsPath} is not a settings object: ${shapeProblem}`);
  return settings;
}

const manifest = loadManifest();
if (isRemoving && !existsSync(settingsPath)) {
  writeManifestFile(configDir, withManifestSection(manifest, MANIFEST_SECTION, null));
  console.log(`Nothing to remove: ${settingsPath} does not exist.`);
  process.exit(0);
}
const originalText = existsSync(settingsPath) ? readFileSync(settingsPath, "utf8") : null;
const settings = parseSettings(originalText);
const options = { isRemoving, officeUrl, hooksDir, recorded: manifestSection(manifest, MANIFEST_SECTION) };
if (isForeignStatusline(settings.statusLine, options)) {
  console.log("You already have a statusLine, so it was left alone. Usage limits, tokens and cost need the office statusline.");
}

const nextText = `${JSON.stringify(withOfficeSettings(settings, options), null, 2)}\n`;
const { isUnchanged, hasChangedMeanwhile, backupPath, pruneError } = commitOrFail({ path: settingsPath, originalText, nextText });
if (hasChangedMeanwhile) fail(`${settingsPath} was saved by another program while the installer ran. Run the installer again`);
writeManifestFile(configDir, withManifestSection(manifest, MANIFEST_SECTION, isRemoving ? null : officeEntries(options)));
if (backupPath) console.log(`Backup: ${backupPath}`);
if (pruneError) console.warn(`Saved, but could not remove old backup ${pruneError.path ?? ""} (${pruneError.code ?? pruneError.message}).`);
if (isUnchanged) console.log(`${settingsPath} is already up to date. Nothing was changed.`);
else if (isRemoving) console.log(`Office hooks removed from ${settingsPath}.`);
else console.log(`Office hooks installed in ${settingsPath}. New Claude Code sessions will show up at ${officeUrl}.`);
