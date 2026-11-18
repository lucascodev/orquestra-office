import { agentKeyOf } from "../../office/domain/agent-key.js";

export function createHoldRequest({ decisions, hasViewers }) {
  return async function holdRequest(actor, request, onAbort) {
    if (!actor || !hasViewers()) return null;
    const { id, answer } = decisions.hold({ agentKey: agentKeyOf(actor), ...request });
    onAbort(() => decisions.settle(id, null));
    return answer;
  };
}
