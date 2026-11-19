const MASK = "[redacted]";
const SECRET_NAME = /PASS|SECRET|TOKEN|KEY/;
// Long enough for any real JWT part; the bound keeps a run of almost-JWT text from being scanned over and over.
const JWT_PART_LIMIT = 4096;
const JWT_PART = `[\\w-]{1,${JWT_PART_LIMIT}}`;

const maskedVariable = (assignment, name) => (SECRET_NAME.test(name) ? `${name}=${MASK}` : assignment);

// Every pattern either starts only where a word starts or reads each character a bounded number of times, so a long
// plan made of almost-secrets is still read in linear time.
const SECRET_PATTERNS = [
  [/-----BEGIN [A-Z ]{0,40}PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]{0,40}PRIVATE KEY-----|$)/g, MASK],
  [/Bearer\s+\S+/gi, `Bearer ${MASK}`],
  [/\bBasic\s+\S+/g, `Basic ${MASK}`],
  [new RegExp(`(?<![\\w-])eyJ${JWT_PART}\\.${JWT_PART}\\.${JWT_PART}`, "g"), MASK],
  [/sk-[\w-]{16,}/g, MASK],
  [/sk_(?:live|test)_\w+/g, MASK],
  [/gh[pousr]_\w{20,}/g, MASK],
  [/github_pat_\w+/g, MASK],
  [/AKIA[0-9A-Z]{16}/g, MASK],
  [/AIza[\w-]{35}/g, MASK],
  [/xox[abpr]-\S+/g, MASK],
  [/\/\/[^\s/:@]+:[^\s/@]+@/g, `//${MASK}@`],
  [/"(password|passwd|secret|token|api[_-]?key)"(\s*:\s*)"(?:[^"\\]|\\.)*"/gi, `"$1"$2"${MASK}"`],
  [/(--?(?:password|passwd|secret|token|api[-_]?key|apitoken))([ =])\S+/gi, `$1$2${MASK}`],
  [/(?<![\w$])([A-Z_][A-Z0-9_]*)=\S+/g, maskedVariable],
  [/(password|passwd|secret|token|api[_-]?key)(\s*[=:]\s*)\S+/gi, `$1$2${MASK}`],
];

// Commands, test failures, plans and checklists are written by the agent and may quote a credential it just used.
export function redactSecrets(text) {
  if (typeof text !== "string") return "";
  return SECRET_PATTERNS.reduce((masked, [pattern, replacement]) => masked.replace(pattern, replacement), text);
}
