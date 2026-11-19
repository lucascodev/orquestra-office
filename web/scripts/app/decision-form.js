import { buildDecision } from "../domain/office/decision-body.js";

const MISSING_ANSWER = "Escolha uma opção ou escreva uma resposta para cada pergunta.";
const SEND_FAILED = "Não deu para enviar. O pedido pode já ter voltado para o terminal.";
const DECISION_BAR = "data-decision-bar";
const PENDING_CARD = "[data-pending]";
const ERROR_CLASS = "pending-error";

const ownChildOf = (card, isWanted) => [...(card?.children ?? [])].find(isWanted) ?? null;

// A card answers only through its own bar, a direct child of the card: a plan or any text shown beside the bar can never
// bring a button or a field of its own into the decision.
export const decisionBarOf = (card) => ownChildOf(card, (child) => child.hasAttribute(DECISION_BAR));

// The decide button that was pressed, with its card, when it really belongs to that card's bar; null for anything else.
export function decisionOf(button) {
  const card = button?.closest(PENDING_CARD);
  const bar = decisionBarOf(card);
  if (!bar || button.tagName !== "BUTTON" || !bar.contains(button)) return null;
  return { card, action: button.dataset.decide };
}

function questionsIn(bar) {
  return [...bar.querySelectorAll("[data-question]")].map((block) => ({
    question: block.dataset.question,
    picked: [...block.querySelectorAll('[aria-pressed="true"]')].map((option) => option.dataset.option),
    other: block.querySelector("input").value,
  }));
}

// The reason comes from the field the bar names by id, looked up inside the bar alone.
function reasonIn(bar) {
  const fieldId = bar.dataset.reasonField;
  if (!fieldId) return "";
  return [...bar.querySelectorAll("[id]")].find((field) => field.id === fieldId)?.value ?? "";
}

function showError(card, message) {
  const error = ownChildOf(card, (child) => child.classList.contains(ERROR_CLASS));
  if (!error) return;
  error.textContent = message;
  error.hidden = false;
}

export function toggleOption(option) {
  const block = option.closest("[data-question]");
  const wasPressed = option.getAttribute("aria-pressed") === "true";
  if (block.dataset.multi !== "true") block.querySelectorAll("[data-option]").forEach((other) => other.setAttribute("aria-pressed", "false"));
  option.setAttribute("aria-pressed", String(!wasPressed));
}

export async function submitDecision(control, card, action) {
  const bar = decisionBarOf(card);
  if (!bar) return;
  const body = buildDecision(action, { questions: questionsIn(bar), reason: reasonIn(bar) });
  if (!body) {
    showError(card, MISSING_ANSWER);
    return;
  }
  const buttons = [...bar.querySelectorAll("button")];
  buttons.forEach((button) => { button.disabled = true; });
  const wasSent = await control.decide(card.dataset.pending, body).catch(() => false);
  if (wasSent) return;
  buttons.forEach((button) => { button.disabled = false; });
  showError(card, SEND_FAILED);
}
