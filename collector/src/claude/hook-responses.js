// The minimal contract with hooks/office-decision.mjs: the script, not the collector, writes what Claude Code reads.
export const NO_PERMISSION_DECISION = Object.freeze({ decision: null });
export const NO_ANSWERS = Object.freeze({ answers: null });

export function permissionDecisionOf(answer) {
  if (!answer) return NO_PERMISSION_DECISION;
  return { decision: answer.behavior === "allow" ? { behavior: "allow" } : { behavior: "deny", message: answer.message ?? "" } };
}

export const answersOf = (answer) => (answer ? { answers: answer.answers } : NO_ANSWERS);

export const queuedMessagesOf = (messages) => ({ messages });
