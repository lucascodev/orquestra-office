import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CHAIN_SCRIPT_FILE } from "./lib/codex-chain.mjs";
import { applyNotify, configLines, configText, notifyEntriesOf } from "./lib/codex-config.mjs";
import { commitConfig } from "./lib/config-commit.mjs";
import { findCurl, nullDeviceOf } from "./lib/curl.mjs";
import { envValue } from "./lib/env-value.mjs";
import { manifestSection, withManifestSection } from "./lib/install-manifest.mjs";
import { manifestPath, readManifestFile, writeManifestFile } from "./lib/manifest-file.mjs";
import { officeFilesOf } from "./lib/office-home.mjs";
import { prepareOfficeSecret } from "./lib/office-secret-setup.mjs";
import { ALLOW_REMOTE_FLAG, installerOfficeUrl } from "./lib/office-url.mjs";

const MANIFEST_SECTION = "codex";

function fail(message) {
  console.error(`${message}. Nothing was changed.`);
  process.exit(1);
}

const isRemoving = process.argv.includes("--remove");
const officeUrlResult = installerOfficeUrl(process.env, { allowRemote: process.argv.includes(ALLOW_REMOTE_FLAG) });
if (officeUrlResult.problem) fail(`OFFICE_URL was refused: ${officeUrlResult.problem}`);
const officeUrl = officeUrlResult.origin;
const officeFiles = officeFilesOf(homedir());
const curlPath = isRemoving ? null : findCurl({ platform: process.platform, systemRoot: process.env.SystemRoot, exists: existsSync });
if (!isRemoving && !curlPath) fail("Could not install: curl was not found (Windows 10 1803 or newer ships it in System32; on macOS it is /usr/bin/curl)");
const configDir = envValue(process.env, "CODEX_HOME") ?? join(homedir(), ".codex");
const configPath = join(configDir, "config.toml");

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

const manifest = loadManifest();
if (isRemoving && !existsSync(configPath)) {
  writeManifestFile(configDir, withManifestSection(manifest, MANIFEST_SECTION, null));
  console.log(`Nothing to remove: ${configPath} does not exist.`);
  process.exit(0);
}
const originalText = existsSync(configPath) ? readFileSync(configPath, "utf8") : null;
const options = {
  isRemoving,
  officeUrl,
  recorded: manifestSection(manifest, MANIFEST_SECTION),
  curlPath,
  nullDevice: nullDeviceOf(process.platform),
  activityHeaderFile: officeFiles.activityHeaderFile,
  chainScript: join(dirname(fileURLToPath(import.meta.url)), CHAIN_SCRIPT_FILE),
};
const result = applyNotify(originalText === null ? [] : configLines(originalText), options);

if (result.foreignNotifyLine !== undefined) {
  console.error(`${configPath} already has another notify command:\n  ${result.foreignNotifyLine}\nNothing was changed. Only a notify written on one line as an array of strings can run after the office's; merge them by hand if you want both.`);
  process.exit(1);
}

if (!isRemoving) prepareOfficeSecret({ officeFiles, rotate: false, fail });
const { isUnchanged, hasChangedMeanwhile, backupPath, pruneError } = commitOrFail({ path: configPath, originalText, nextText: configText(result.lines) });
if (hasChangedMeanwhile) fail(`${configPath} was saved by another program while the installer ran. Run the installer again`);
writeManifestFile(configDir, withManifestSection(manifest, MANIFEST_SECTION, isRemoving ? null : notifyEntriesOf(result.command)));
if (backupPath) console.log(`Backup: ${backupPath}`);
if (pruneError) console.warn(`Saved, but could not remove old backup ${pruneError.path ?? ""} (${pruneError.code ?? pruneError.message}).`);
if (isUnchanged) console.log(`${configPath} is already up to date. Nothing was changed.`);
else if (isRemoving) console.log(`Office notify removed from ${configPath}.`);
else console.log(`Office notify installed in ${configPath}. Codex turns will show up at ${officeUrl}.`);
if (!isUnchanged && result.previous.length > 0) {
  console.log(isRemoving ? "Your own notify command is back on its own." : `Your own notify command still runs after the office's: ${JSON.stringify(result.previous)}`);
}
