import { cpSync, mkdirSync, rmSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SITE_DIR = fileURLToPath(new URL(".", import.meta.url));
const REPOSITORY_DIR = resolve(SITE_DIR, "..");
const WEB_DIR = join(REPOSITORY_DIR, "web");
const DEFAULT_OUTPUT_DIR = join(REPOSITORY_DIR, "_site");
const DEMO_DIR_NAME = "demo";

const PUBLISHED_SITE_ENTRIES = ["index.html", "en", "styles", "scripts", "assets"];
const PUBLISHED_WEB_ENTRIES = ["index.html", "scripts", "styles", "vendor"];

const copyEntries = (fromDir, toDir, entries) => {
  for (const entry of entries) cpSync(join(fromDir, entry), join(toDir, entry), { recursive: true });
};

const isSameOrInside = (path, dir) => {
  const fromDir = relative(dir, path);
  const leavesDir = fromDir === ".." || fromDir.startsWith(`..${sep}`) || isAbsolute(fromDir);
  return !leavesDir;
};

export const holdsSources = (target) => isSameOrInside(REPOSITORY_DIR, target) || [SITE_DIR, WEB_DIR].some((dir) => isSameOrInside(target, dir));

export function assembleSite(outputDir = DEFAULT_OUTPUT_DIR) {
  const target = resolve(outputDir);
  if (holdsSources(target)) throw new Error(`refusing to replace ${target}: it holds the site or the office sources`);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  copyEntries(SITE_DIR, target, PUBLISHED_SITE_ENTRIES);
  copyEntries(WEB_DIR, join(target, DEMO_DIR_NAME), PUBLISHED_WEB_ENTRIES);
  return target;
}

const isRunAsScript = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isRunAsScript) {
  const target = assembleSite(process.argv[2]);
  console.log(`site assembled in ${target}`);
}
