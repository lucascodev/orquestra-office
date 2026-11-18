import { agentKeyOf } from "../../office/domain/agent-key.js";
import { AGENT_ACTION } from "../../office/domain/agent-actions.js";
import { officeActionEvent } from "../../office/domain/office-action-event.js";

const DELIVERED_ACTION = Object.freeze({ actionId: AGENT_ACTION.MESSAGE_DELIVERED, action: "recebeu sua mensagem pelo escritório" });

export function createDeliverQueuedMessages({ store, outbox, now = Date.now }) {
  return function deliverQueuedMessages(actor) {
    if (!actor || actor.agentId) return [];
    const messages = outbox.take(agentKeyOf(actor));
    if (messages.length > 0) store.apply(officeActionEvent(actor, DELIVERED_ACTION, now()));
    return messages;
  };
}
