import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const RUNNER_DIR = fileURLToPath(new URL("..", import.meta.url));
const SRC_DIR = join(RUNNER_DIR, "src");
const TEST_DIR = join(RUNNER_DIR, "test");
const COLLECTOR_SHARED_DIR = fileURLToPath(new URL("../../collector/src/shared", import.meta.url));
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
const shown = (path) => relative(RUNNER_DIR, path).split(sep).join("/");

function relativeImportsOf(file) {
  return importsOf(readFileSync(file, "utf8"))
    .filter(isRelative)
    .map((specifier) => ({ file, specifier, target: resolve(dirname(file), specifier) }));
}

test("the import scanner sees every form of import and re-export", () => {
  const source = readFileSync(join(TEST_DIR, "fixtures", "import-forms.txt"), "utf8");
  assert.deepEqual(importsOf(source), ["./a.js", "../b.js", "./e.js", "./side-effect.js", "./f.js", "node:path", "./g.js"]);
});

// Includes the import of the collector's tool summary, so the collector cannot move it without the runner noticing.
test("every relative import in src and test points to an existing file", () => {
  const broken = [...scriptsUnder(SRC_DIR), ...scriptsUnder(TEST_DIR)]
    .flatMap(relativeImportsOf)
    .filter(({ target }) => !existsSync(target) || !statSync(target).isFile())
    .map(({ file, specifier }) => `${shown(file)} -> ${specifier}`);
  assert.deepEqual(broken, []);
});

const COMPOSITION = "composition";
const COMPOSITION_ROOTS = new Set(["composition.js", "main.js"]);
const COLLECTOR_SHARED = "collector/src/shared";
const RUNNER_LAYERS = new Set(["sessions", "claude", "infra", "http"]);
const BUILTIN_PREFIX = "node:";
const PROCESS_STATE = /\bprocess\.(?:env|cwd)\b/;

// Besides these, a layer may always import its own layer, and the composition root may import any layer of the runner.
const ALLOWED_LAYERS = {
  sessions: [],
  claude: [COLLECTOR_SHARED],
  infra: [],
  http: ["sessions"],
};

const ALLOWED_BUILTINS = {
  sessions: ["node:crypto"],
  claude: ["node:child_process"],
  infra: ["node:fs"],
  http: ["node:http"],
};

function isInside(dir, path) {
  const fromDir = relative(dir, path);
  return fromDir !== "" && !fromDir.startsWith("..") && !isAbsolute(fromDir);
}

function layerOf(path) {
  if (isInside(COLLECTOR_SHARED_DIR, path)) return COLLECTOR_SHARED;
  if (!isInside(SRC_DIR, path)) return null;
  const [top, ...rest] = relative(SRC_DIR, path).split(sep);
  if (rest.length === 0) return COMPOSITION_ROOTS.has(top) ? COMPOSITION : null;
  return RUNNER_LAYERS.has(top) ? top : null;
}

function mayImport(file, target) {
  const layer = layerOf(file);
  const targetLayer = layerOf(target);
  if (layer === targetLayer) return true;
  if (layer === COMPOSITION) return RUNNER_LAYERS.has(targetLayer);
  return (ALLOWED_LAYERS[layer] ?? []).includes(targetLayer);
}

function mayUseBareImport(layer, specifier) {
  if (layer === COMPOSITION) return specifier.startsWith(BUILTIN_PREFIX);
  return (ALLOWED_BUILTINS[layer] ?? []).includes(specifier);
}

test("every file in src sits in a known layer", () => {
  assert.deepEqual(scriptsUnder(SRC_DIR).filter((file) => !layerOf(file)).map(shown), []);
});

test("outside the runner, src imports only the collector's shared code", () => {
  const leaks = scriptsUnder(SRC_DIR)
    .flatMap(relativeImportsOf)
    .filter(({ target }) => !isInside(SRC_DIR, target) && !isInside(COLLECTOR_SHARED_DIR, target))
    .map(({ file, specifier }) => `${shown(file)} -> ${specifier}`);
  assert.deepEqual(leaks, []);
});

test("each layer imports only the layers the architecture allows", () => {
  const violations = scriptsUnder(SRC_DIR)
    .flatMap(relativeImportsOf)
    .filter(({ file, target }) => !mayImport(file, target))
    .map(({ file, specifier }) => `${shown(file)} (${layerOf(file)}) -> ${specifier}`);
  assert.deepEqual(violations, []);
});

test("each layer uses only its own Node built-ins and no npm package", () => {
  const violations = scriptsUnder(SRC_DIR).flatMap((file) => importsOf(readFileSync(file, "utf8"))
    .filter((specifier) => !isRelative(specifier) && !mayUseBareImport(layerOf(file), specifier))
    .map((specifier) => `${shown(file)} (${layerOf(file)}) -> ${specifier}`));
  assert.deepEqual(violations, []);
});

test("the composition takes its configuration as an argument instead of reading the environment or the working directory", () => {
  assert.doesNotMatch(readFileSync(join(SRC_DIR, "composition.js"), "utf8"), PROCESS_STATE);
});
