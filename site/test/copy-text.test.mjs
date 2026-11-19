import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { copyTextOf } from "../scripts/copy-text.js";

describe("copied install commands", () => {
  it("puts each command on its own line, in page order", () => {
    assert.equal(copyTextOf(["git clone repo", "cd repo", "docker compose up -d"]), "git clone repo\ncd repo\ndocker compose up -d");
  });

  it("copies a single command without a trailing line break", () => {
    assert.equal(copyTextOf(["npx orquestra-office"]), "npx orquestra-office");
  });

  it("drops the spacing around each command", () => {
    assert.equal(copyTextOf(["  cd repo\n", "\tnode install.mjs "]), "cd repo\nnode install.mjs");
  });
});
