import { isSecretName } from "./secret-name.js";

const MASK = "[redacted]";
// Long enough for any real value; the bound keeps a run of almost-secret text from being scanned over and over.
const VALUE_LIMIT = 4096;
const NAME = "[A-Za-z_][\\w-]{0,63}";
const QUOTED = `"(?:[^"\\\\\\n]|\\\\.){0,${VALUE_LIMIT}}"|'[^'\\n]{0,${VALUE_LIMIT}}'`;
// An unquoted value ends where a shell would end it, so FOO=1;DB_PASS=x still reaches DB_PASS, and never starts with a
// dash, so "-args -apitoken x" leaves -apitoken to be read as a flag of its own.
const BARE = "[^\\s;,&|\"'-][^\\s;,&|\"']{0,4095}";
const VALUE = `(?:${QUOTED}|${BARE})`;

const maskedAuthorization = (match, header, scheme) => `${header}${scheme ? `${scheme} ` : ""}${MASK}`;
const maskedWhenSecret =(match, name, separator) => (isSecretName(name) ? `${name}${separator}${MASK}` : match);
const maskedQuotedWhenSecret = (match, name, separator) => (isSecretName(name) ? `"${name}"${separator}"${MASK}"` : match);

// Every pattern either starts only where a word starts or reads each character a bounded number of times, so a long
// plan made of almost-secrets is still read in linear time. Separators never cross a line break, so a heading such as
// "## Basic" keeps the line after it.
const SECRET_PATTERNS = [
  [/-----BEGIN [A-Z ]{0,40}PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END [A-Z ]{0,40}PRIVATE KEY(?: BLOCK)?-----|$)/g, MASK],
  [/(Authorization[ \t]*:[ \t]*)(?:(Bearer|Basic|Token|Digest)[ \t]+)?\S+/gi, maskedAuthorization],
  [/Bearer[ \t]+\S+/gi, `Bearer ${MASK}`],
  [/\bBasic[ \t]+[A-Za-z0-9+/]{8,}={0,2}/g, `Basic ${MASK}`],
  [/(?<![\w.-])eyJ[\w.-]{16,}/g, MASK],
  [/sk-[\w-]{16,}/g, MASK],
  [/sk_(?:live|test)_\w+/g, MASK],
  [/gh[pousr]_\w{20,}/g, MASK],
  [/github_pat_\w+/g, MASK],
  [/AKIA[0-9A-Z]{16}/g, MASK],
  [/AIza[\w-]{35}/g, MASK],
  [/xox[abpr]-\S+/g, MASK],
  [/\/\/[^\s/:@]*:[^\s/@]+@/g, `//${MASK}@`],
  [new RegExp(`(?<![\\w-])"(${NAME})"(\\s*:\\s*)"(?:[^"\\\\]|\\\\.){0,${VALUE_LIMIT}}"`, "g"), maskedQuotedWhenSecret],
  [new RegExp(`(?<![\\w-])(--?[A-Za-z][\\w-]{0,63})([ \\t]+|=)${VALUE}`, "g"), maskedWhenSecret],
  [new RegExp(`(?<![\\w$-])(${NAME})([ \\t]*[=:][ \\t]*)${VALUE}`, "g"), maskedWhenSecret],
];

// Commands, test failures, plans and checklists are written by the agent and may quote a credential it just used.
export function redactSecrets(text) {
  if (typeof text !== "string") return "";
  return SECRET_PATTERNS.reduce((masked, [pattern, replacement]) => masked.replace(pattern, replacement), text);
}
