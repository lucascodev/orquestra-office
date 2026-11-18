import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { assembleSite, holdsSources } from "../assemble.mjs";
import { startTags } from "./support/html.mjs";

const SITE_DIR = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_DIR = resolve(SITE_DIR, "..");
const ROOT_RELATIVE = /^\//;

describe("site assembly", () => {
  let workDir;
  let outputDir;

  before(() => {
    workDir = mkdtempSync(join(tmpdir(), "orquestra-site-"));
    outputDir = assembleSite(join(workDir, "_site"));
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

  it("lets the default output and folders outside the repository be replaced", () => {
    for (const dir of [join(REPOSITORY_DIR, "_site"), outputDir]) {
      assert.equal(holdsSources(dir), false, dir);
    }
  });
});
