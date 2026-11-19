const MASK = "[redacted]";

const SECRET_PATTERNS = [
  [/Bearer\s+\S+/gi, `Bearer ${MASK}`],
  [/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, MASK],
  [/sk-[\w-]{16,}/g, MASK],
  [/gh[pousr]_\w{20,}/g, MASK],
  [/AKIA[0-9A-Z]{16}/g, MASK],
  [/xox[abpr]-\S+/g, MASK],
  [/\/\/[^\s/:@]+:[^\s/@]+@/g, `//${MASK}@`],
  [/(password|passwd|secret|token|api[_-]?key)(\s*[=:]\s*)\S+/gi, `$1$2${MASK}`],
];

// Commands, test failures, plans and checklists are written by the agent and may quote a credential it just used.
export function redactSecrets(text) {
  if (typeof text !== "string") return "";
  return SECRET_PATTERNS.reduce((masked, [pattern, replacement]) => masked.replace(pattern, replacement), text);
}
