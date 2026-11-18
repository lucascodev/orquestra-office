const DEFAULT_DENY_MESSAGE = "Recusado pelo usuário no escritório.";
const MESSAGE_HEADER = "Mensagem do usuário, enviada pelo escritório enquanto você trabalhava:";

export const NO_DECISION = Object.freeze({});

export function permissionResponse(behavior, message) {
  const decision = behavior === "allow" ? { behavior: "allow" } : { behavior: "deny", message: message || DEFAULT_DENY_MESSAGE };
  return { hookSpecificOutput: { hookEventName: "PermissionRequest", decision } };
}

export function questionResponse(questions, answers) {
  return { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", updatedInput: { questions, answers } } };
}

export function continueWithMessages(messages) {
  return { decision: "block", reason: `${MESSAGE_HEADER}\n\n${messages.join("\n\n")}` };
}
