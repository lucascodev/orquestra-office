import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { assembleSite, holdsSources } from "../assemble.mjs";
import { startTags } from "./support/html.mjs";

const SITE_DIR = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_DIR = resolve(SITE_DIR, "..");
const ROOT_RELATIVE = /^\//;
const OWNER_PLACEHOLDER = /\bOWNER\b/;
const LANDING_PAGES = ["index.html", "en/index.html"];
const SITE_NAME = "Orquestra Office";
const WITHOUT_PLACEHOLDERS = { placeholders: [] };
const FOREIGN_FILE_NAME = "notes.txt";
const FOREIGN_CONTENT = "not part of the site";

describe("site assembly", () => {
  let workDir;
  let outputDir;

  before(() => {
    workDir = mkdtempSync(join(tmpdir(), "orquestra-site-"));
    outputDir = assembleSite(join(workDir, "_site"), WITHOUT_PLACEHOLDERS);
  });

  after(() => rmSync(workDir, { recursive: true, force: true }));

  it("publishes both landing pages and the office under demo/", () => {
    for (const path of ["index.html", "en/index.html", "styles/landing.css", "scripts/main.js", "assets/og.png", "demo/index.html", "demo/scripts/app/main.js", "demo/styles/tokens.css", "demo/vendor/three.module.min.js"]) {
      assert.ok(existsSync(join(outputDir, path)), `${path} is missing`);
    }
  });

  it("leaves the tooling and the tests out of the published site", () => {
    for (const path of ["assemble.mjs", "test", "demo/test"]) {
      assert.ok(!existsSync(join(outputDir, path)), `${path} should not be published`);
    }
  });

  it("serves the office page with relative paths so it works under a subpath", () => {
    const officePage = readFileSync(join(outputDir, "demo/index.html"), "utf8");
    const references = startTags(officePage).flatMap(({ attributes }) => [attributes.get("src"), attributes.get("href")]).filter(Boolean);
    assert.ok(references.length > 0);
    assert.deepEqual(references.filter((reference) => ROOT_RELATIVE.test(reference)), []);
  });

  it("treats the repository, its parents and the source folders as off limits", () => {
    for (const dir of [REPOSITORY_DIR, resolve(REPOSITORY_DIR, ".."), SITE_DIR, join(SITE_DIR, "styles"), join(REPOSITORY_DIR, "web")]) {
      assert.equal(holdsSources(dir), true, dir);
    }
  });

  it("replaces a missing folder, an empty one and one it assembled before", () => {
    const emptyDir = mkdtempSync(join(workDir, "empty-"));
    for (const dir of [join(workDir, "missing"), emptyDir, outputDir]) {
      assembleSite(dir, WITHOUT_PLACEHOLDERS);
      assert.ok(existsSync(join(dir, "index.html")), dir);
    }
  });

  it("refuses to replace a folder it did not assemble and keeps its files", () => {
    const foreignDir = mkdtempSync(join(workDir, "foreign-"));
    const foreignFile = join(foreignDir, FOREIGN_FILE_NAME);
    writeFileSync(foreignFile, FOREIGN_CONTENT);
    assert.throws(() => assembleSite(foreignDir, WITHOUT_PLACEHOLDERS), /refusing to replace/);
    assert.equal(readFileSync(foreignFile, "utf8"), FOREIGN_CONTENT);
    assert.ok(!existsSync(join(foreignDir, "index.html")));
  });

  it("refuses to finish the site while a placeholder is left in a published file", () => {
    assert.throws(
      () => assembleSite(join(workDir, "with-placeholder"), { placeholders: [SITE_NAME] }),
      (error) => error.message.includes(SITE_NAME) && LANDING_PAGES.every((page) => error.message.includes(page)),
    );
  });

  it("blocks the real site while the pages still name the OWNER placeholder", (t) => {
    const isOwnerLeft = LANDING_PAGES.some((page) => OWNER_PLACEHOLDER.test(readFileSync(join(SITE_DIR, page), "utf8")));
    if (!isOwnerLeft) return t.skip("the OWNER placeholder was already replaced");
    assert.throws(() => assembleSite(join(workDir, "with-owner")), OWNER_PLACEHOLDER);
  });
});
