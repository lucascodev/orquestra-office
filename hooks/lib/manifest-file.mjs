import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { writeFileAtomically } from "./atomic-write.mjs";
import { MANIFEST_FILE, manifestText, parseManifest } from "./install-manifest.mjs";

export const manifestPath = (configDir) => join(configDir, MANIFEST_FILE);

const textOnDisk = (path) => (existsSync(path) ? readFileSync(path, "utf8") : null);

export const readManifestFile = (configDir) => parseManifest(textOnDisk(manifestPath(configDir)));

export function writeManifestFile(configDir, manifest) {
  const path = manifestPath(configDir);
  const text = manifestText(manifest);
  const current = textOnDisk(path);
  if (text === current) return;
  if (text === null) rmSync(path, { force: true });
  else writeFileAtomically(path, text, { expectedText: current });
}
