import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { refreshSignal } from "../scripts/three/scene/signal-refresh.js";

const signalOf = (kind, text) => ({ kind, icon: "", text, elapsedMs: null });

function tagShowing(signal) {
  const relabels = [];
  const entry = { signal, tag: { signal: { text: { textContent: signal.text } } } };
  return { entry, relabels, relabel: () => relabels.push(true) };
}

// Runs every second for each agent on the map: the whole tag is redrawn when the kind of signal changes, since the mark, the
// colour and the label under the name change with it; otherwise only the text, such as the clock, is touched.
describe("tick of the signal over a figure", () => {
  it("redraws the whole tag when the kind of signal changes, as tests running giving way to a failure", () => {
    const { entry, relabels, relabel } = tagShowing(signalOf("testing", "testando 0:12"));
    refreshSignal(entry, signalOf("tests-failed", "2 falharam"), relabel);
    assert.equal(relabels.length, 1);
  });

  it("redraws the whole tag when a signal appears or goes away", () => {
    for (const [shown, next] of [[signalOf(null, ""), signalOf("checklist", "1/2")], [signalOf("tests-passed", "3 passaram"), signalOf(null, "")]]) {
      const { entry, relabels, relabel } = tagShowing(shown);
      refreshSignal(entry, next, relabel);
      assert.equal(relabels.length, 1);
    }
  });

  it("touches only the text when the kind stays, as the clock of a running test", () => {
    const { entry, relabels, relabel } = tagShowing(signalOf("testing", "testando 0:12"));
    const next = signalOf("testing", "testando 0:13");
    refreshSignal(entry, next, relabel);
    assert.deepEqual([relabels.length, entry.tag.signal.text.textContent, entry.signal], [0, "testando 0:13", next]);
  });

  it("touches nothing when the signal is the same", () => {
    const shown = signalOf("checklist", "1/2");
    const { entry, relabels, relabel } = tagShowing(shown);
    refreshSignal(entry, signalOf("checklist", "1/2"), relabel);
    assert.equal(relabels.length, 0);
    assert.equal(entry.signal, shown);
  });
});
