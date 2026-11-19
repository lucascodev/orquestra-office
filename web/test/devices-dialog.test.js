import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDevicesDialog } from "../scripts/app/devices-dialog.js";

const PARTS = ["[data-devices]", "[data-pairing-code]", "[data-pair]", "[data-close]"];

// Just enough of the dialog for the module: each part keeps its click handler so the test can press it.
function fakeDialog() {
  const parts = Object.fromEntries(PARTS.map((selector) => [selector, {
    hidden: false, disabled: false, innerHTML: "", onClick: null,
    addEventListener(type, handler) { this.onClick = handler; },
  }]));
  return { dialog: { querySelector: (selector) => parts[selector], showModal() {}, close() {} }, parts };
}

describe("devices dialog", () => {
  it("gives the pair button back when issuing a code fails", async () => {
    const { dialog, parts } = fakeDialog();
    createDevicesDialog({ dialog, control: { pairDevice: async () => { throw new TypeError("fetch failed"); } } });
    const pairButton = parts["[data-pair]"];

    await assert.rejects(pairButton.onClick(), TypeError);

    assert.equal(pairButton.disabled, false);
  });
});
