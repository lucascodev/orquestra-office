import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { assembleSite } from "../assemble.mjs";
import { bodyOf, hasInlineScript, startTags } from "./support/html.mjs";

const SITE_DIR = fileURLToPath(new URL("..", import.meta.url));
const PUBLISHED_ORIGIN = "https://pages.example";
const PUBLISHED_BASE = `${PUBLISHED_ORIGIN}/orquestra-office/`;
const PAGES = [
  { path: "index.html", lang: "pt-BR", url: PUBLISHED_BASE },
  { path: "en/index.html", lang: "en", url: `${PUBLISHED_BASE}en/` },
];
const ALTERNATE_LANGUAGES = ["en", "pt-BR", "x-default"];
const REFERENCE_ATTRIBUTES = ["href", "src"];
const ID_REFERENCE_ATTRIBUTES = ["aria-controls", "aria-labelledby"];
const EXTERNAL = /^(?:[a-z]+:)?\/\//i;
const EVENT_HANDLER = /^on/;

const readPage = (page) => readFileSync(join(SITE_DIR, page.path), "utf8");
const attribute = (tags, name, value) => tags.filter((tag) => tag.attributes.get(name) === value);
const skeletonOf = (html) => startTags(bodyOf(html)).map(({ name, attributes }) => `${name}.${attributes.get("class") ?? ""}`);

describe("landing pages", () => {
  let assembledDir;
  let workDir;

  before(() => {
    workDir = mkdtempSync(join(tmpdir(), "orquestra-pages-"));
    assembledDir = assembleSite(join(workDir, "_site"), { placeholders: [] });
  });

  after(() => rmSync(workDir, { recursive: true, force: true }));

  it("declares the language of each page", () => {
    for (const page of PAGES) {
      const [html] = startTags(readPage(page)).filter((tag) => tag.name === "html");
      assert.equal(html.attributes.get("lang"), page.lang, page.path);
    }
  });

  it("keeps the Portuguese and English pages with the same structure", () => {
    const [portuguese, english] = PAGES.map((page) => skeletonOf(readPage(page)));
    assert.deepEqual(english, portuguese);
  });

  it("links each language to the other with hreflang and a canonical address", () => {
    const alternatesOf = (tags) => attribute(tags, "rel", "alternate").map((tag) => [tag.attributes.get("hreflang"), tag.attributes.get("href")]).sort();
    const [portugueseAlternates, englishAlternates] = PAGES.map((page) => alternatesOf(startTags(readPage(page))));
    assert.deepEqual(portugueseAlternates.map(([language]) => language), ALTERNATE_LANGUAGES);
    assert.deepEqual(englishAlternates, portugueseAlternates);
    for (const page of PAGES) {
      const tags = startTags(readPage(page));
      const [canonical] = attribute(tags, "rel", "canonical");
      const ownAlternate = attribute(tags, "hreflang", page.lang).find((tag) => tag.name === "link");
      assert.equal(canonical.attributes.get("href"), ownAlternate.attributes.get("href"), page.path);
    }
  });

  it("marks the current language in the language switch", () => {
    for (const page of PAGES) {
      const current = attribute(startTags(readPage(page)), "aria-current", "page");
      assert.equal(current.length, 1, page.path);
      assert.equal(current[0].attributes.get("hreflang"), page.lang, page.path);
    }
  });

  it("describes every image and frame", () => {
    for (const page of PAGES) {
      for (const tag of startTags(readPage(page))) {
        if (tag.name === "img") assert.ok(tag.attributes.get("alt")?.trim(), `${page.path}: image without alt`);
        if (tag.name === "iframe") assert.ok(tag.attributes.get("title")?.trim(), `${page.path}: frame without title`);
      }
    }
  });

  it("points every fragment and ARIA reference to an element of the same page", () => {
    for (const page of PAGES) {
      const tags = startTags(readPage(page));
      const ids = new Set(tags.map((tag) => tag.attributes.get("id")).filter(Boolean));
      const fragments = tags.map((tag) => tag.attributes.get("href")).filter((href) => href?.startsWith("#")).map((href) => href.slice(1));
      const ariaIds = tags.flatMap((tag) => ID_REFERENCE_ATTRIBUTES.map((name) => tag.attributes.get(name))).filter(Boolean).flatMap((value) => value.split(/\s+/));
      for (const id of [...fragments, ...ariaIds]) assert.ok(ids.has(id), `${page.path}: #${id} does not exist`);
    }
  });

  it("works under the content security policy without inline code or styles", () => {
    for (const page of PAGES) {
      const html = readPage(page);
      assert.equal(hasInlineScript(html), false, `${page.path}: inline script`);
      for (const tag of startTags(html)) {
        const attributeNames = [...tag.attributes.keys()];
        assert.ok(!attributeNames.includes("style"), `${page.path}: inline style on <${tag.name}>`);
        assert.deepEqual(attributeNames.filter((name) => EVENT_HANDLER.test(name)), [], `${page.path}: inline handler on <${tag.name}>`);
      }
    }
  });

  it("finds every local file the pages reference once the site is assembled", () => {
    for (const page of PAGES) {
      const references = startTags(readPage(page)).flatMap((tag) => REFERENCE_ATTRIBUTES.map((name) => tag.attributes.get(name))).filter((reference) => reference && !reference.startsWith("#") && !EXTERNAL.test(reference));
      for (const reference of references) {
        const { origin, pathname } = new URL(reference, page.url);
        assert.equal(origin, PUBLISHED_ORIGIN, `${page.path}: ${reference}`);
        assert.ok(pathname.startsWith(new URL(PUBLISHED_BASE).pathname), `${page.path}: ${reference} leaves the site`);
        const relativePath = decodeURIComponent(pathname.slice(new URL(PUBLISHED_BASE).pathname.length));
        const file = relativePath === "" || relativePath.endsWith("/") ? `${relativePath}index.html` : relativePath;
        assert.ok(existsSync(join(assembledDir, file)), `${page.path}: ${reference} is not in the site`);
      }
    }
  });
});
