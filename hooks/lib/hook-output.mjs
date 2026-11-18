import { isPlainObject } from "./plain-object.mjs";

const DENY_MESSAGE_LIMIT = 1_000;
const ANSWER_LIMIT = 2_000;
const MESSAGE_LIMIT = 4_000;
const MESSAGE_COUNT_LIMIT = 10;
const MESSAGES_TOTAL_LIMIT = 20_000;
const MESSAGE_SEPARATOR = "\n\n";
const DEFAULT_DENY_MESSAGE = "Recusado pelo usuário no escritório.";
const MESSAGE_HEADER = "Mensagem do usuário, enviada pelo escritório enquanto você trabalhava:";

// Every output is built from scratch out of the few fields the contract allows; nothing the collector sends is passed on.
// That keeps updatedPermissions, updatedInput, interrupt, additionalContext and systemMessage out of reach of whoever answers.

function permissionDecisionOf(decision) {
  if (decision?.behavior === "allow") return { behavior: "allow" };
  if (decision?.behavior !== "deny" || (decision.message !== undefined && typeof decision.message !== "string")) return null;
  return { behavior: "deny", message: decision.message?.trim().slice(0, DENY_MESSAGE_LIMIT) || DEFAULT_DENY_MESSAGE };
}

export function permissionOutput(answer) {
  const decision = isPlainObject(answer?.decision) ? permissionDecisionOf(answer.decision) : null;
  return decision ? { hookSpecificOutput: { hookEventName: "PermissionRequest", decision } } : null;
}

const isAnswerText = (value) => typeof value === "string" && value.trim() !== "" && value.length <= ANSWER_LIMIT;

// The answer must cover exactly the questions Claude Code asked, so the office cannot add a question or skip one.
function answersFor(questions, given) {
  if (!isPlainObject(given)) return null;
  const asked = new Set(questions.map((item) => item?.question).filter((text) => typeof text === "string"));
  const keys = Object.keys(given);
  if (asked.size === 0 || keys.length !== asked.size) return null;
  if (!keys.every((key) => asked.has(key) && isAnswerText(given[key]))) return null;
  return Object.fromEntries(keys.map((key) => [key, given[key]]));
}

export function questionOutput(answer, toolInput) {
  const questions = Array.isArray(toolInput?.questions) ? toolInput.questions : [];
  const answers = answersFor(questions, answer?.answers);
  if (!answers) return null;
  return { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", updatedInput: { questions, answers } } };
}

function messagesText(messages) {
  let text = "";
  for (const message of messages.slice(0, MESSAGE_COUNT_LIMIT)) {
    const next = `${text}${text ? MESSAGE_SEPARATOR : ""}${message.slice(0, MESSAGE_LIMIT)}`;
    if (next.length > MESSAGES_TOTAL_LIMIT) break;
    text = next;
  }
  return text;
}

export function stopOutput(answer) {
  const messages = answer?.messages;
  if (!Array.isArray(messages) || !messages.every((message) => typeof message === "string")) return null;
  const text = messagesText(messages.filter((message) => message.trim() !== ""));
  return text ? { decision: "block", reason: `${MESSAGE_HEADER}${MESSAGE_SEPARATOR}${text}` } : null;
}
