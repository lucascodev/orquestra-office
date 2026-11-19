import { ownValueOf } from "../shared/own-value.js";

const DECISION_KEYS = { a: "allow", n: "deny" };

// Single-key shortcuts only count with the focus on the request (WCAG 2.1.4); the caller listens on the alert alone.
export function decisionForKey({ key, hasModifier, isTyping }) {
  if (hasModifier || isTyping || typeof key !== "string") return null;
  return ownValueOf(DECISION_KEYS, key.toLowerCase()) ?? null;
}
