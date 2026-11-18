import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { DEMO_CONTENT_SECURITY_POLICY } from "./content-security-policy.mjs";

const SITE_DIR = fileURLToPath(new URL(".", import.meta.url));
const REPOSITORY_DIR = resolve(SITE_DIR, "..");
const WEB_DIR = join(REPOSITORY_DIR, "web");
const DEFAULT_OUTPUT_DIR = join(REPOSITORY_DIR, "_site");
const DEMO_DIR_NAME = "demo";
const ASSEMBLY_MARKER = ".site-assembly";
const OFFICE_PAGE = "index.html";
const CHARSET_META = /<meta charset="utf-8">/i;

const PUBLISHED_SITE_ENTRIES = ["index.html", "en", "styles", "scripts", "assets"];
const PUBLISHED_WEB_ENTRIES = ["index.html", "scripts", "styles", "vendor"];
const TEXT_EXTENSIONS = new Set([".html", ".css", ".js", ".mjs", ".json", ".svg", ".txt", ".xml"]);

const UNRESOLVED_PLACEHOLDERS = ["OWNER"];

const copyEntries = (fromDir, toDir, entries) => {
  for (const entry of entries) cpSync(join(fromDir, entry), join(toDir, entry), { recursive: true });
};

const isSameOrInside = (path, dir) => {
  const fromDir = relative(dir, path);
  const leavesDir = fromDir === ".." || fromDir.startsWith(`..${sep}`) || isAbsolute(fromDir);
  return !leavesDir;
};

export const holdsSources = (target) => isSameOrInside(REPOSITORY_DIR, target) || [SITE_DIR, WEB_DIR].some((dir) => isSameOrInside(target, dir));

function isReplaceable(target) {
  if (!existsSync(target)) return true;
  if (!statSync(target).isDirectory()) return false;
  const entries = readdirSync(target);
  return entries.length === 0 || entries.includes(ASSEMBLY_MARKER);
}

function addDemoPolicy(officePagePath) {
  const officePage = readFileSync(officePagePath, "utf8");
  if (!CHARSET_META.test(officePage)) throw new Error(`cannot add the content security policy to ${officePagePath}: the charset meta is missing`);
  const policyMeta = `<meta http-equiv="Content-Security-Policy" content="${DEMO_CONTENT_SECURITY_POLICY}">`;
  writeFileSync(officePagePath, officePage.replace(CHARSET_META, (charsetMeta) => `${charsetMeta}\n${policyMeta}`));
}

const publishedTextFiles = (dir) => readdirSync(dir, { recursive: true }).filter((path) => TEXT_EXTENSIONS.has(extname(path))).map((path) => path.split(sep).join("/"));

function assertNoPlaceholderLeft(dir, placeholders) {
  const files = publishedTextFiles(dir);
  for (const placeholder of placeholders) {
    const pattern = new RegExp(`\\b${placeholder}\\b`);
    const filesWithPlaceholder = files.filter((path) => pattern.test(readFileSync(join(dir, path), "utf8")));
    if (filesWithPlaceholder.length > 0) {
      throw new Error(`placeholder ${placeholder} left in ${filesWithPlaceholder.join(", ")}: replace it before publishing the site`);
    }
  }
}

export function assembleSite(outputDir = DEFAULT_OUTPUT_DIR, { placeholders = UNRESOLVED_PLACEHOLDERS } = {}) {
  const target = resolve(outputDir);
  if (holdsSources(target)) throw new Error(`refusing to replace ${target}: it holds the site or the office sources`);
  if (!isReplaceable(target)) throw new Error(`refusing to replace ${target}: it is not empty and has no ${ASSEMBLY_MARKER} file from an earlier assembly`);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, ASSEMBLY_MARKER), "");
  copyEntries(SITE_DIR, target, PUBLISHED_SITE_ENTRIES);
  copyEntries(WEB_DIR, join(target, DEMO_DIR_NAME), PUBLISHED_WEB_ENTRIES);
  addDemoPolicy(join(target, DEMO_DIR_NAME, OFFICE_PAGE));
  assertNoPlaceholderLeft(target, placeholders);
  return target;
}

const isRunAsScript = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isRunAsScript) {
  try {
    console.log(`site assembled in ${assembleSite(process.argv[2])}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
