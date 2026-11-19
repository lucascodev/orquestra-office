import { agentKeyOf } from "../domain/agent-key.js";
import { officeActionEvent } from "../domain/office-action-event.js";
import { withTestResult } from "../../work/application/with-test-result.js";

// Without a parser, a test run passes or fails by how its command ended and its counts stay unknown.
const NO_TEST_OUTPUT_PARSER = () => null;

export function createRecordActivity({ store, history, parseTestOutput = NO_TEST_OUTPUT_PARSER, now = Date.now }) {
  function record(event, historyItem) {
    store.apply(withTestResult(event, parseTestOutput));
    if (historyItem) history.add(historyItem.agentKey, historyItem.entry);
  }

  function note(actor, described, noted) {
    store.apply(officeActionEvent(actor, described, now()));
    history.add(agentKeyOf(actor), { at: now(), kind: "note", detail: "", ...noted });
  }

  return { record, note };
}
