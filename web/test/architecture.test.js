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
const STYLES_DIR = join(WEB_DIR, "styles");
const INDEX_PAGE = join(WEB_DIR, "index.html");
const DEFAULT_EXPORT = "default";

const STATIC_IMPORT = /\b(import|export)\s+(?:([\w*{}\s,$]+?)\s+from\s+)?["']([^"']+)["']/g;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
const DECLARED_EXPORT = /^export\s+(?:async\s+)?(?:function\s*\*?|const|let|var|class)\s*([\w$]+)/gm;
const DEFAULT_EXPORT_STATEMENT = /^export\s+default\b/m;
const LISTED_EXPORT = /^export\s*\{([^}]*)\}/gm;
const STAR_EXPORT = /^export\s*\*\s*(?:as\s+([\w$]+)\s*)?from\s*["']([^"']+)["']/gm;
const IMPORT_STATEMENT = /^\s*import\s+([\w*{}\s,$]+?)\s+from\s+["'][^"']+["'];?/gm;
const NAMESPACE_LOCAL = /\*\s*as\s+([\w$]+)/;
const QUOTED_TEXT = /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g;
const COMMENT = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
const NOT_A_PROPERTY = String.raw`(?<![\w$])(?<![^.]\.)`;
const BROWSER_ONLY = new RegExp(String.raw`${NOT_A_PROPERTY}(?:document|window|localStorage|sessionStorage|fetch|EventSource|requestAnimationFrame|performance)\b(?!\s*:)|\bDate\.now\b`, "g");
const ROOT_PATH = /["'(]\/(?:scripts|styles|vendor)\//g;
const REGEX_SPECIAL = /[$]/g;
const NAMED_LIST = /\{([^}]*)\}/;
const NAMESPACE_BINDING = /\*\s*as\s+[\w$]+/;
const ALIAS = /\s+as\s+/;

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
      .flatMap(relativeImportsOf)
      .filter(({ target }) => isExistingFile(target) && !isInside(VENDOR_DIR, target))
      .flatMap(({ file, specifier, names, target }) => {
        const exported = exportedNamesOf(target);
        return names.filter((name) => !exported.has(name)).map((name) => `${shown(file)} -> ${specifier} { ${name} }`);
      });
    assert.deepEqual(missing, []);
  });
});

const LAYER_IMPORTS = {
  data: [],
  domain: ["domain", "data"],
  view: ["domain", "data", "view"],
  three: ["domain", "data", "three"],
  infra: ["domain", "data", "infra"],
  app: ["domain", "data", "view", "three", "infra", "app"],
};
const VENDOR_USERS = ["scripts/three/kit.js", "scripts/view/terminal/terminal-markdown.js"];
const VENDOR = "vendor";

const scriptsLayerOf = (path) => relative(SCRIPTS_DIR, path).split(sep)[0];
const layerOf = (path) => (isInside(VENDOR_DIR, path) ? VENDOR : scriptsLayerOf(path));
const withoutComments = (source) => source.replace(COMMENT, "");
const codeOf = (source) => withoutComments(source).replace(QUOTED_TEXT, '""');

function localBindingsOf(clause) {
  const named = listedNames(NAMED_LIST.exec(clause)?.[1] ?? "").map((parts) => parts.at(-1));
  const namespace = NAMESPACE_LOCAL.exec(clause)?.[1];
  const defaultName = clause.replace(NAMED_LIST, "").replace(NAMESPACE_BINDING, "").split(",").map((part) => part.trim()).find(Boolean);
  return [defaultName, namespace, ...named].filter(Boolean);
}

function unusedImportsIn(source) {
  const statements = [...source.matchAll(IMPORT_STATEMENT)];
  // Quoted text stays: a template literal can call an import inside an attribute, as in data-x="${statusOf(agent)}".
  const body = withoutComments(statements.reduce((rest, [statement]) => rest.replace(statement, ""), source));
  const isUsed = (name) => new RegExp(`${NOT_A_PROPERTY}${name.replace(REGEX_SPECIAL, "\\$&")}(?![\\w$])`).test(body);
  return statements.flatMap(([, clause]) => localBindingsOf(clause)).filter((name) => !isUsed(name));
}

describe("layer readers", () => {
  it("finds the imports nobody uses, whatever form they were imported in", () => {
    const source = readFileSync(join(FIXTURES_DIR, "unused-imports.txt"), "utf8");
    assert.deepEqual(unusedImportsIn(source), ["unused", "lonely", "onlyAsProperty"]);
  });

  it("reads browser-only names in code but not in text, comments, object keys or properties", () => {
    const source = ['const view = "window";', "// fetch later", "const spots = { window: 1 };", "const got = item.fetch;", "const now = Date.now();", "document.title = view;"].join("\n");
    assert.deepEqual(codeOf(source).match(BROWSER_ONLY), ["Date.now", "document"]);
  });
});

describe("web layers", () => {
  const scriptImports = () => scriptsUnder(SCRIPTS_DIR).flatMap(relativeImportsOf);

  it("imports across folders only in the directions the architecture allows", () => {
    const crossings = scriptImports()
      .filter(({ target }) => !isInside(VENDOR_DIR, target))
      .filter(({ file, target }) => !LAYER_IMPORTS[scriptsLayerOf(file)]?.includes(layerOf(target)))
      .map(({ file, specifier }) => `${shown(file)} -> ${specifier}`);
    assert.deepEqual(crossings, []);
  });

  it("reaches the vendored libraries only through the 3D kit and the terminal markdown", () => {
    const users = [...new Set(scriptImports().filter(({ target }) => isInside(VENDOR_DIR, target)).map(({ file }) => shown(file)))].sort();
    assert.deepEqual(users, VENDOR_USERS);
  });

  it("keeps the domain free of the browser, the network, storage and the clock", () => {
    const leaks = scriptsUnder(join(SCRIPTS_DIR, "domain"))
      .flatMap((file) => (codeOf(readFileSync(file, "utf8")).match(BROWSER_ONLY) ?? []).map((name) => `${shown(file)}: ${name}`));
    assert.deepEqual(leaks, []);
  });

  it("refers to its own files by relative paths, so the page also works under a subpath", () => {
    const pages = [INDEX_PAGE, ...scriptsUnder(SCRIPTS_DIR), ...readdirSync(STYLES_DIR).map((name) => join(STYLES_DIR, name))];
    const rooted = pages.flatMap((file) => (readFileSync(file, "utf8").match(ROOT_PATH) ?? []).map((path) => `${shown(file)}: ${path}`));
    assert.deepEqual(rooted, []);
  });

  it("leaves no import unused in scripts and tests", () => {
    const unused = webModules().flatMap((file) => unusedImportsIn(readFileSync(file, "utf8")).map((name) => `${shown(file)}: ${name}`));
    assert.deepEqual(unused, []);
  });
});
