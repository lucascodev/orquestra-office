import { isPlainObject } from "./plain-object.mjs";

export const MANIFEST_FILE = "orquestra-office.json";

export function parseManifest(text) {
  if (text === null) return {};
  const manifest = JSON.parse(text);
  if (!isPlainObject(manifest)) throw new TypeError("it is not a JSON object");
  return manifest;
}

export const manifestSection = (manifest, tool) => (isPlainObject(manifest[tool]) ? manifest[tool] : {});

export function withManifestSection(manifest, tool, section) {
  const others = Object.fromEntries(Object.entries(manifest).filter(([key]) => key !== tool));
  return section ? { ...others, [tool]: section } : others;
}

export const manifestText = (manifest) => (Object.keys(manifest).length > 0 ? `${JSON.stringify(manifest, null, 2)}\n` : null);
