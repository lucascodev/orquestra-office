import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { REMOVED_OFFICE_ENTRIES } from "./lib/claude-office-entries.mjs";
import { hasHttpOfficeHooks, isForeignStatusline, officeEntries, withOfficeSettings } from "./lib/claude-settings.mjs";
import { settingsShapeProblem } from "./lib/claude-settings-shape.mjs";
import { commitConfig } from "./lib/config-commit.mjs";
import { findCurl, nullDeviceOf } from "./lib/curl.mjs";
import { envValue } from "./lib/env-value.mjs";
import { hooksDirProblem, shellPathProblem } from "./lib/hooks-dir.mjs";
import { manifestSection, withManifestSection } from "./lib/install-manifest.mjs";
import { manifestPath, readManifestFile, writeManifestFile } from "./lib/manifest-file.mjs";
import { openBrowser } from "./lib/open-browser.mjs";
import { officeFilesOf } from "./lib/office-home.mjs";
import { prepareOfficeSecret, ROTATE_SECRET_FLAG } from "./lib/office-secret-setup.mjs";
import { ALLOW_REMOTE_FLAG, installerOfficeUrl } from "./lib/office-url.mjs";
import { pairingLinkOf } from "./lib/pairing-link.mjs";

const MANIFEST_SECTION = "claude";
const NO_OPEN_FLAG = "--no-open";
const OPEN_COMMAND = "node hooks/open-office.mjs";

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
const officeFiles = officeFilesOf(homedir());
const unsafeSecretPath = isRemoving ? null : shellPathProblem("the office secret file", officeFiles.secretFile);
if (unsafeSecretPath) fail(`Could not install: ${unsafeSecretPath}`);
const curlPath = isRemoving ? null : findCurl({ platform: process.platform, systemRoot: process.env.SystemRoot, exists: existsSync });
if (!isRemoving && !curlPath) fail("Could not install: curl was not found (Windows 10 1803 or newer ships it in System32; on macOS it is /usr/bin/curl)");
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
const options = {
  isRemoving,
  officeUrl,
  hooksDir,
  recorded: manifestSection(manifest, MANIFEST_SECTION),
  curlPath,
  nullDevice: nullDeviceOf(process.platform),
  secretFile: officeFiles.secretFile,
  activityHeaderFile: officeFiles.activityHeaderFile,
};
const secret = isRemoving ? null : prepareOfficeSecret({ officeFiles, rotate: process.argv.includes(ROTATE_SECRET_FLAG), fail });
const isMigratingFromHttp = !isRemoving && hasHttpOfficeHooks(settings, options);
if (isForeignStatusline(settings.statusLine, options)) {
  console.log("You already have a statusLine, so it was left alone. Usage limits, tokens and cost need the office statusline.");
}

const nextText = `${JSON.stringify(withOfficeSettings(settings, options), null, 2)}\n`;
const { isUnchanged, hasChangedMeanwhile, backupPath, pruneError } = commitOrFail({ path: settingsPath, originalText, nextText });
if (hasChangedMeanwhile) fail(`${settingsPath} was saved by another program while the installer ran. Run the installer again`);
writeManifestFile(configDir, withManifestSection(manifest, MANIFEST_SECTION, isRemoving ? REMOVED_OFFICE_ENTRIES : officeEntries(options)));
if (backupPath) console.log(`Backup: ${backupPath}`);
if (pruneError) console.warn(`Saved, but could not remove old backup ${pruneError.path ?? ""} (${pruneError.code ?? pruneError.message}).`);
if (isUnchanged) console.log(`${settingsPath} is already up to date. Nothing was changed.`);
else if (isRemoving) console.log(`Office hooks removed from ${settingsPath}.`);
else console.log(`Office hooks installed in ${settingsPath}. New Claude Code sessions will show up at ${officeUrl}.`);
if (isMigratingFromHttp) console.log("The office hooks were migrated from http to command hooks.");

// Only someone at a terminal gets a browser opened; scripts and tests piping the output never do, and never reach the collector.
async function openPairedOffice() {
  try {
    openBrowser(await pairingLinkOf({ officeUrl, key: secret.key }));
    console.log("The office was opened in your browser, already paired.");
  } catch {
    console.log(`The collector did not answer the pairing request. Once it is running, open the office with: ${OPEN_COMMAND}`);
  }
}

if (isRemoving) process.exit(0);
if (process.stdout.isTTY && !process.argv.includes(NO_OPEN_FLAG)) await openPairedOffice();
else console.log(`Open the office already paired with: ${OPEN_COMMAND}`);
