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

const COMPOSITION = "composition";
const COMPOSITION_ROOTS = new Set(["composition.js", "main.js"]);
const CONTEXT_LAYERS = new Set(["domain", "application", "infra"]);
const TOP_LEVEL_LAYERS = new Set(["shared", "history", "claude", "codex", "http"]);
const BUILTIN_LAYERS = new Set(["infra", "http", COMPOSITION]);
const HTTP_BUILTIN = "node:http";
const PROCESS_STATE = /\bprocess\.(?:env|cwd)\b/;

// Besides these, a layer may always import its own layer, and the composition root may import anything.
const ALLOWED_LAYERS = {
  shared: [],
  domain: ["shared"],
  application: ["domain", "history", "shared"],
  infra: ["domain", "shared"],
  history: ["shared"],
  claude: ["office/domain", "work/domain", "shared"],
  codex: ["office/domain", "shared"],
  http: ["application", "domain", "claude", "codex", "history", "shared"],
};

const pathInSrc = (path) => relative(SRC_DIR, path).split(sep).join("/");
const builtinImportsOf = (file) => importsOf(readFileSync(file, "utf8")).filter((specifier) => specifier.startsWith(BUILTIN_PREFIX));

function layerOf(path) {
  const inSrc = pathInSrc(path);
  if (COMPOSITION_ROOTS.has(inSrc)) return COMPOSITION;
  const [top, second] = inSrc.split("/");
  if (CONTEXT_LAYERS.has(second)) return second;
  return TOP_LEVEL_LAYERS.has(top) ? top : null;
}

function mayImport(file, target) {
  const layer = layerOf(file);
  const targetLayer = layerOf(target);
  if (layer === COMPOSITION || layer === targetLayer) return true;
  return (ALLOWED_LAYERS[layer] ?? []).some((scope) => scope === targetLayer || pathInSrc(target).startsWith(`${scope}/`));
}

test("every file in src sits in a known layer", () => {
  assert.deepEqual(scriptsUnder(SRC_DIR).filter((file) => !layerOf(file)).map(shown), []);
});

test("each layer imports only the layers the architecture allows", () => {
  const violations = scriptsUnder(SRC_DIR)
    .flatMap(relativeImportsOf)
    .filter(({ file, target }) => !mayImport(file, target))
    .map(({ file, specifier }) => `${shown(file)} (${layerOf(file)}) -> ${specifier}`);
  assert.deepEqual(violations, []);
});

test("only infra, http and the composition root use Node built-ins", () => {
  const violations = scriptsUnder(SRC_DIR)
    .filter((file) => !BUILTIN_LAYERS.has(layerOf(file)))
    .flatMap((file) => builtinImportsOf(file).map((specifier) => `${shown(file)} -> ${specifier}`));
  assert.deepEqual(violations, []);
});

test("nothing outside http imports node:http", () => {
  const violations = scriptsUnder(SRC_DIR)
    .filter((file) => layerOf(file) !== "http" && builtinImportsOf(file).includes(HTTP_BUILTIN))
    .map(shown);
  assert.deepEqual(violations, []);
});

test("the composition takes its configuration as an argument instead of reading the environment or the working directory", () => {
  assert.doesNotMatch(readFileSync(join(SRC_DIR, "composition.js"), "utf8"), PROCESS_STATE);
});
