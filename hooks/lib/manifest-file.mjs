import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MANIFEST_FILE, manifestText, parseManifest } from "./install-manifest.mjs";

export const manifestPath = (configDir) => join(configDir, MANIFEST_FILE);

export function readManifestFile(configDir) {
  const path = manifestPath(configDir);
  return parseManifest(existsSync(path) ? readFileSync(path, "utf8") : null);
}

export function writeManifestFile(configDir, manifest) {
  const path = manifestPath(configDir);
  const text = manifestText(manifest);
  if (text === null) {
    rmSync(path, { force: true });
    return;
  }
  if (existsSync(path) && readFileSync(path, "utf8") === text) return;
  writeFileSync(path, text);
}
