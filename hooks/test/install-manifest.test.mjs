import assert from "node:assert/strict";
import { test } from "node:test";
import { manifestSection, manifestText, parseManifest, withManifestSection } from "../lib/install-manifest.mjs";

const CLAUDE = { urls: ["http://127.0.0.1:8420/events/claude"], commands: ['node "/opt/office-session-start.mjs"'] };
const CODEX = { notify: [["curl", "-s"]] };

test("a missing manifest reads as empty", () => {
  assert.deepEqual(parseManifest(null), {});
  assert.deepEqual(manifestSection(parseManifest(null), "claude"), {});
});

test("refuses a manifest that is not a JSON object", () => {
  for (const text of ["{ nope", "null", "[1]", '"x"']) assert.throws(() => parseManifest(text), undefined, text);
});

test("a section that is not an object reads as empty", () => {
  assert.deepEqual(manifestSection({ claude: [1] }, "claude"), {});
});

test("each tool keeps its own section, so Claude and Codex can share a folder", () => {
  const both = withManifestSection(withManifestSection({}, "claude", CLAUDE), "codex", CODEX);

  assert.deepEqual(both, { claude: CLAUDE, codex: CODEX });
  assert.deepEqual(manifestSection(parseManifest(manifestText(both)), "codex"), CODEX);
  assert.deepEqual(withManifestSection(both, "claude", null), { codex: CODEX });
});

test("an empty manifest has no text, so its file is deleted", () => {
  assert.equal(manifestText({}), null);
  assert.equal(manifestText({ codex: CODEX }), `${JSON.stringify({ codex: CODEX }, null, 2)}\n`);
});
