import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_DIR = fileURLToPath(new URL("..", import.meta.url));
const SCRIPTS_DIR = join(WEB_DIR, "scripts");
const TEST_DIR = join(WEB_DIR, "test");
const VENDOR_DIR = join(WEB_DIR, "vendor");
const FIXTURES_DIR = join(TEST_DIR, "fixtures");
const DEFAULT_EXPORT = "default";

const STATIC_IMPORT = /\b(import|export)\s+(?:([\w*{}\s,$]+?)\s+from\s+)?["']([^"']+)["']/g;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
const DECLARED_EXPORT = /^export\s+(?:async\s+)?(?:function\s*\*?|const|let|var|class)\s*([\w$]+)/gm;
const DEFAULT_EXPORT_STATEMENT = /^export\s+default\b/m;
const LISTED_EXPORT = /^export\s*\{([^}]*)\}/gm;
const STAR_EXPORT = /^export\s*\*\s*(?:as\s+([\w$]+)\s*)?from\s*["']([^"']+)["']/gm;
const NAMED_LIST = /\{([^}]*)\}/;
const NAMESPACE_BINDING = /\*\s*as\s+[\w$]+/;
const ALIAS = /\s+as\s+/;

// Never imported by app/main.js and importing `rect` and `svg`, which art/pixels.js no longer exports. Step 3.2 deletes them and this list.
const DEAD_CODE_AWAITING_REMOVAL = new Set([
  "scripts/view/room-scene.js",
  "scripts/art/characters.js",
  "scripts/art/iso.js",
  "scripts/art/props.js",
  "scripts/art/sprites.js",
  "scripts/art/templates.js",
]);

const listedNames = (list) => list.split(",").map((item) => item.trim()).filter(Boolean).map((item) => item.split(ALIAS));

function requestedNames(keyword, clause) {
  if (!clause) return [];
  const named = listedNames(NAMED_LIST.exec(clause)?.[1] ?? "").map(([imported]) => imported);
  if (keyword === "export") return named;
  const hasDefault = clause.replace(NAMED_LIST, "").replace(NAMESPACE_BINDING, "").split(",").some((part) => part.trim());
  return hasDefault ? [DEFAULT_EXPORT, ...named] : named;
}

function importsOf(source) {
  const statics = [...source.matchAll(STATIC_IMPORT)].map(([, keyword, clause, specifier]) => ({ specifier, names: requestedNames(keyword, clause) }));
  const dynamics = [...source.matchAll(DYNAMIC_IMPORT)].map(([, specifier]) => ({ specifier, names: [] }));
  return [...statics, ...dynamics];
}

function exportsIn(source) {
  const declared = [...source.matchAll(DECLARED_EXPORT)].map(([, name]) => name);
  const listed = [...source.matchAll(LISTED_EXPORT)].flatMap(([, list]) => listedNames(list).map((parts) => parts.at(-1)));
  const stars = [...source.matchAll(STAR_EXPORT)];
  return {
    names: [...declared, ...listed, ...stars.filter(([, alias]) => alias).map(([, alias]) => alias), ...(DEFAULT_EXPORT_STATEMENT.test(source) ? [DEFAULT_EXPORT] : [])],
    reexportsAllOf: stars.filter(([, alias]) => !alias).map(([, , specifier]) => specifier),
  };
}

function exportedNamesOf(file, visited = new Set()) {
  if (visited.has(file)) return new Set();
  visited.add(file);
  const { names, reexportsAllOf } = exportsIn(readFileSync(file, "utf8"));
  const forwarded = reexportsAllOf.flatMap((specifier) => [...exportedNamesOf(resolve(dirname(file), specifier), visited)].filter((name) => name !== DEFAULT_EXPORT));
  return new Set([...names, ...forwarded]);
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
const shown = (path) => relative(WEB_DIR, path).split(sep).join("/");
const isDeadCode = (file) => DEAD_CODE_AWAITING_REMOVAL.has(shown(file));

function relativeImportsOf(file) {
  return importsOf(readFileSync(file, "utf8"))
    .filter(({ specifier }) => isRelative(specifier))
    .map(({ specifier, names }) => ({ file, specifier, names, target: resolve(dirname(file), specifier) }));
}

const webModules = () => [...scriptsUnder(SCRIPTS_DIR), ...scriptsUnder(TEST_DIR)];
const isExistingFile = (path) => existsSync(path) && statSync(path).isFile();

describe("import and export readers", () => {
  it("sees every form of import, with the names each one asks for", () => {
    const source = readFileSync(join(FIXTURES_DIR, "import-forms.txt"), "utf8");
    assert.deepEqual(importsOf(source), [
      { specifier: "./a.js", names: ["a"] },
      { specifier: "../b.js", names: ["default", "c", "d"] },
      { specifier: "./e.js", names: [] },
      { specifier: "./side-effect.js", names: [] },
      { specifier: "./f.js", names: ["f"] },
      { specifier: "node:path", names: [] },
      { specifier: "./pixels.js", names: ["rect", "svg"] },
      { specifier: "./h.js", names: ["default"] },
      { specifier: "./g.js", names: [] },
    ]);
  });

  it("sees every form of export and nothing that only looks like one", () => {
    const source = readFileSync(join(FIXTURES_DIR, "export-forms.txt"), "utf8");
    const { names, reexportsAllOf } = exportsIn(source);
    assert.deepEqual([...names].sort(), ["Three", "default", "four", "later", "nine", "one", "plain", "seven", "six", "steps", "ten", "two"]);
    assert.deepEqual(reexportsAllOf, ["./everything.js"]);
  });
});

describe("web module graph", () => {
  it("resolves every relative import in scripts and test to an existing file", () => {
    const broken = webModules()
      .flatMap(relativeImportsOf)
      .filter(({ target }) => !isExistingFile(target))
      .map(({ file, specifier }) => `${shown(file)} -> ${specifier}`);
    assert.deepEqual(broken, []);
  });

  it("imports only names that the target module exports, leaving the minified vendor builds unread", () => {
    const missing = webModules()
      .filter((file) => !isDeadCode(file))
      .flatMap(relativeImportsOf)
      .filter(({ target }) => isExistingFile(target) && !isInside(VENDOR_DIR, target))
      .flatMap(({ file, specifier, names, target }) => {
        const exported = exportedNamesOf(target);
        return names.filter((name) => !exported.has(name)).map((name) => `${shown(file)} -> ${specifier} { ${name} }`);
      });
    assert.deepEqual(missing, []);
  });

  it("keeps the dead code awaiting removal out of reach of every live module", () => {
    const reaching = webModules()
      .filter((file) => !isDeadCode(file))
      .flatMap(relativeImportsOf)
      .filter(({ target }) => isDeadCode(target))
      .map(({ file, specifier }) => `${shown(file)} -> ${specifier}`);
    assert.deepEqual(reaching, []);
  });

  it("lists as dead code only files that still exist", () => {
    const gone = [...DEAD_CODE_AWAITING_REMOVAL].filter((path) => !isExistingFile(join(WEB_DIR, path)));
    assert.deepEqual(gone, []);
  });
});
