import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tabIndexForKey } from "../scripts/tab-keys.js";

const TAB_COUNT = 2;

describe("install tab keys", () => {
  it("moves to the next tab and wraps after the last one", () => {
    assert.equal(tabIndexForKey("ArrowRight", 0, TAB_COUNT), 1);
    assert.equal(tabIndexForKey("ArrowRight", 1, TAB_COUNT), 0);
  });

  it("moves to the previous tab and wraps before the first one", () => {
    assert.equal(tabIndexForKey("ArrowLeft", 1, TAB_COUNT), 0);
    assert.equal(tabIndexForKey("ArrowLeft", 0, TAB_COUNT), 1);
  });

  it("jumps to the first and the last tab", () => {
    assert.equal(tabIndexForKey("Home", 1, TAB_COUNT), 0);
    assert.equal(tabIndexForKey("End", 0, TAB_COUNT), 1);
  });

  it("ignores keys that do not move between tabs", () => {
    assert.equal(tabIndexForKey("Enter", 0, TAB_COUNT), null);
    assert.equal(tabIndexForKey("ArrowDown", 0, TAB_COUNT), null);
  });
});
