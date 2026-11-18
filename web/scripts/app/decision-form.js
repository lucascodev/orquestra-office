import { buildDecision } from "../domain/office/decision-body.js";

const MISSING_ANSWER = "Escolha uma opção ou escreva uma resposta para cada pergunta.";
const SEND_FAILED = "Não deu para enviar. O pedido pode já ter voltado para o terminal.";

function questionsIn(card) {
  return [...card.querySelectorAll("[data-question]")].map((block) => ({
    question: block.dataset.question,
    picked: [...block.querySelectorAll('[aria-pressed="true"]')].map((option) => option.dataset.option),
    other: block.querySelector("input").value,
  }));
}

function decisionIn(card, action) {
  return buildDecision(action, { questions: questionsIn(card), reason: card.querySelector('[name="reason"]')?.value ?? "" });
}

function showError(card, message) {
  const error = card.querySelector(".pending-error");
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
  const body = decisionIn(card, action);
  if (!body) {
    showError(card, MISSING_ANSWER);
    return;
  }
  const buttons = [...card.querySelectorAll("button")];
  buttons.forEach((button) => { button.disabled = true; });
  const wasSent = await control.decide(card.dataset.pending, body).catch(() => false);
  if (wasSent) return;
  buttons.forEach((button) => { button.disabled = false; });
  showError(card, SEND_FAILED);
}
