import { agentKeyOf } from "../domain/agent-key.js";
import { officeActionEvent } from "../domain/office-action-event.js";

export function createRecordActivity({ store, history, now = Date.now }) {
  function record(event, historyItem) {
    store.apply(event);
    if (historyItem) history.add(historyItem.agentKey, historyItem.entry);
  }

  function note(actor, described, text) {
    store.apply(officeActionEvent(actor, described, now()));
    history.add(agentKeyOf(actor), { at: now(), kind: "note", detail: "", text });
  }

  return { record, note };
}
