import { ownValueOf } from "../shared/own-value.js";

const DECISION_KEYS = { a: "allow", n: "deny" };
const ALLOW = "allow";

// Single-key shortcuts only count with the focus on the request (WCAG 2.1.4); the caller listens on the alert alone.
// Approving a plan lets the agent run all of it, so that one takes a click: a stray A never approves a plan.
export function decisionForKey({ key, hasModifier, isTyping, canAllowByKey = true }) {
  if (hasModifier || isTyping || typeof key !== "string") return null;
  const decision = ownValueOf(DECISION_KEYS, key.toLowerCase()) ?? null;
  return decision === ALLOW && !canAllowByKey ? null : decision;
}
