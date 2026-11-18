import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const COLLECTOR_DIR = fileURLToPath(new URL("..", import.meta.url));
const SRC_DIR = join(COLLECTOR_DIR, "src");
const TEST_DIR = join(COLLECTOR_DIR, "test");
const BUILTIN_PREFIX = "node:";
const STATIC_IMPORT = /\b(?:import|export)\s+(?:[\w*{}\s,$]+?\s+from\s+)?["']([^"']+)["']/g;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

function importsOf(source) {
  return [...source.matchAll(STATIC_IMPORT), ...source.matchAll(DYNAMIC_IMPORT)].map((match) => match[1]);
}

function scriptsUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return scriptsUnder(path);
    return entry.name.endsWith(".js") ? [path] : [];
  });
}

const isRelative = (specifier) => specifier.startsWith("./") || specifier.startsWith("../");
const isInside = (dir, path) => !relative(dir, path).startsWith("..");
const shown = (path) => relative(COLLECTOR_DIR, path).split(sep).join("/");

function relativeImportsOf(file) {
  return importsOf(readFileSync(file, "utf8"))
    .filter(isRelative)
    .map((specifier) => ({ file, specifier, target: resolve(dirname(file), specifier) }));
}

test("the import scanner sees every form of import and re-export", () => {
  const source = readFileSync(join(TEST_DIR, "fixtures", "import-forms.txt"), "utf8");
  assert.deepEqual(importsOf(source), ["./a.js", "../b.js", "./e.js", "./side-effect.js", "./f.js", "node:path", "./g.js"]);
});

test("every relative import in src and test points to an existing file", () => {
  const broken = [...scriptsUnder(SRC_DIR), ...scriptsUnder(TEST_DIR)]
    .flatMap(relativeImportsOf)
    .filter(({ target }) => !existsSync(target) || !statSync(target).isFile())
    .map(({ file, specifier }) => `${shown(file)} -> ${specifier}`);
  assert.deepEqual(broken, []);
});

test("nothing in src imports from outside src other than node built-ins", () => {
  const leaks = scriptsUnder(SRC_DIR).flatMap((file) =>
    importsOf(readFileSync(file, "utf8"))
      .filter((specifier) => (isRelative(specifier) ? !isInside(SRC_DIR, resolve(dirname(file), specifier)) : !specifier.startsWith(BUILTIN_PREFIX)))
      .map((specifier) => `${shown(file)} -> ${specifier}`));
  assert.deepEqual(leaks, []);
});
