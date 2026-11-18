import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { applyNotify, configLines, configText, officeNotifyEntries } from "./lib/codex-config.mjs";
import { commitConfig } from "./lib/config-commit.mjs";
import { envValue } from "./lib/env-value.mjs";
import { manifestSection, withManifestSection } from "./lib/install-manifest.mjs";
import { manifestPath, readManifestFile, writeManifestFile } from "./lib/manifest-file.mjs";
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
const configDir = envValue(process.env, "CODEX_HOME") ?? join(homedir(), ".codex");
const configPath = join(configDir, "config.toml");

function loadManifest() {
  try {
    return readManifestFile(configDir);
  } catch (error) {
    return fail(`Could not read ${manifestPath(configDir)} as the office manifest: ${error.message}`);
  }
}

const manifest = loadManifest();
if (isRemoving && !existsSync(configPath)) {
  writeManifestFile(configDir, withManifestSection(manifest, MANIFEST_SECTION, null));
  console.log(`Nothing to remove: ${configPath} does not exist.`);
  process.exit(0);
}
const originalText = existsSync(configPath) ? readFileSync(configPath, "utf8") : null;
const options = { isRemoving, officeUrl, recorded: manifestSection(manifest, MANIFEST_SECTION) };
const result = applyNotify(originalText === null ? [] : configLines(originalText), options);

if (result.foreignNotifyLine !== undefined) {
  console.error(`${configPath} already has another notify command:\n  ${result.foreignNotifyLine}\nNothing was changed. Codex accepts a single notify command; merge them by hand if you want both.`);
  process.exit(1);
}

const { isUnchanged, hasChangedMeanwhile, backupPath } = commitConfig({ path: configPath, originalText, nextText: configText(result.lines) });
if (hasChangedMeanwhile) fail(`${configPath} was saved by another program while the installer ran. Run the installer again`);
writeManifestFile(configDir, withManifestSection(manifest, MANIFEST_SECTION, isRemoving ? null : officeNotifyEntries(options)));
if (backupPath) console.log(`Backup: ${backupPath}`);
if (isUnchanged) console.log(`${configPath} is already up to date. Nothing was changed.`);
else if (isRemoving) console.log(`Office notify removed from ${configPath}.`);
else console.log(`Office notify installed in ${configPath}. Codex turns will show up at ${officeUrl}.`);
