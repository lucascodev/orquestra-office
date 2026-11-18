import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { HOOKS_DIR } from "./support/run-hook-script.mjs";

const INSTALLED_HOOKS = ["office-session-start.mjs", "office-statusline.mjs", "office-decision.mjs"];
const IMPORT_SOURCE = /^import\s[^;]*?from\s+"([^"]+)"/gm;

// settings.json points at these files by absolute path; importing only node: modules and ./lib/ lets them be copied as a folder.
for (const hook of INSTALLED_HOOKS) {
  test(`${hook} imports only node: modules and ./lib/`, () => {
    const sources = [...readFileSync(`${HOOKS_DIR}/${hook}`, "utf8").matchAll(IMPORT_SOURCE)].map(([, source]) => source);

    assert.ok(sources.some((source) => source.startsWith("./lib/")));
    assert.deepEqual(sources.filter((source) => !source.startsWith("node:") && !source.startsWith("./lib/")), []);
  });
}
