import { decisionForKey } from "../domain/office/decision-shortcuts.js";

const TYPING_TARGETS = "input, textarea, select, [contenteditable]";

// Listens on the given element only, so A and N do nothing while the focus is anywhere else on the page.
export function listenForDecisionKeys(scope, onDecision) {
  scope.addEventListener("keydown", (event) => {
    if (event.repeat) return;
    const decision = decisionForKey({
      key: event.key,
      hasModifier: event.ctrlKey || event.altKey || event.metaKey,
      isTyping: Boolean(event.target.closest?.(TYPING_TARGETS)),
    });
    if (!decision) return;
    event.preventDefault();
    onDecision(decision);
  });
}
