import { PLAN_APPROVAL_TEXT } from "../../data/text/pt-br/plan-approval.js";
import { fillPhrase } from "../../domain/text/fill-phrase.js";
import { toolSummaryText } from "../../domain/terminal/tool-summary-text.js";
import { isPlanRequest, planOfRequest } from "../../domain/work-sheet/plan-request.js";
import { esc } from "../shared/escape-html.js";
import { clockTime } from "../shared/format.js";
import { renderPlanMarkdown } from "../shared/plan-markdown.js";
import { shownQuestion } from "../shared/shown-question.js";

const FAILED_DECISION_ALERT = `<p class="pending-error" role="alert" hidden></p>`;
const DENY_REASON_FIELD = "deny-reason";
const PLAN_REASON_FIELD = "plan-reason";
const REASON_LIMIT = 1000;

function permissionCard(request, agentName) {
  return `<h3 class="card-title">${esc(agentName)} quer usar ${esc(request.toolName)}</h3>
    <p class="pending-what">${esc(toolSummaryText(request))}</p>
    ${request.detail ? `<pre class="mono">${esc(request.detail)}</pre>` : ""}
    <div class="pending-decision" data-decision-bar data-reason-field="${DENY_REASON_FIELD}">
    <div class="field"><label for="${DENY_REASON_FIELD}">Motivo, se for negar (opcional)</label><input class="input" id="${DENY_REASON_FIELD}" type="text" maxlength="500" autocomplete="off"></div>
    <div class="pending-actions">
      <button class="btn btn-ghost" data-decide="terminal">Decidir no terminal</button>
      <span class="spacer"></span>
      <button class="btn btn-secondary" data-decide="deny">Negar</button>
      <button class="btn btn-primary" data-decide="allow">Permitir</button>
    </div>
    </div>`;
}

function questionBlock(item, index) {
  const options = item.options.map((option) => `<button type="button" class="choice" aria-pressed="false" data-option="${esc(option.label)}">
      <b>${esc(option.label)}</b>${option.description ? `<span>${esc(option.description)}</span>` : ""}</button>`).join("");
  return `<fieldset class="question" data-question="${esc(item.question)}" data-multi="${item.multiSelect}">
    <legend>${item.header ? `<span class="badge">${esc(item.header)}</span>` : ""}<span>${esc(shownQuestion(item.question))}</span></legend>
    <div class="choices">${options}</div>
    <div class="field"><label for="other-${index}">Outra resposta</label><input class="input" id="other-${index}" type="text" maxlength="1000" autocomplete="off"></div>
  </fieldset>`;
}

function questionCard(request, agentName) {
  return `<h3 class="card-title">${esc(agentName)} tem uma pergunta</h3>
    <div class="pending-decision" data-decision-bar>
    ${request.questions.map(questionBlock).join("")}
    <div class="pending-actions">
      <button class="btn btn-ghost" data-decide="terminal">Responder no terminal</button>
      <span class="spacer"></span>
      <button class="btn btn-primary" data-decide="answer">Enviar resposta</button>
    </div>
    </div>`;
}

function planContent(plan) {
  if (!plan) return `<p class="muted">${PLAN_APPROVAL_TEXT.missing}</p>`;
  const cut = plan.isTruncated ? `<p class="plan-cut">${PLAN_APPROVAL_TEXT.truncated}</p>` : "";
  return `${renderPlanMarkdown(plan.text)}${cut}`;
}

// As in the alert, the plan sits apart from the bar that decides it, and approving it has no key.
function planCard(request, agentName) {
  return `<h3 class="card-title">${esc(fillPhrase(PLAN_APPROVAL_TEXT.title, { name: agentName }))}</h3>
    <article class="pending-plan md" aria-label="${PLAN_APPROVAL_TEXT.planLabel}" tabindex="0">${planContent(planOfRequest(request))}</article>
    <div class="pending-decision" data-decision-bar data-reason-field="${PLAN_REASON_FIELD}">
    <div class="field"><label for="${PLAN_REASON_FIELD}">${PLAN_APPROVAL_TEXT.reasonLabel}</label><textarea class="textarea" id="${PLAN_REASON_FIELD}" rows="2" maxlength="${REASON_LIMIT}" autocomplete="off" placeholder="${esc(PLAN_APPROVAL_TEXT.reasonPlaceholder)}"></textarea></div>
    <div class="pending-actions">
      <button class="btn btn-ghost" data-decide="terminal">${PLAN_APPROVAL_TEXT.terminal}</button>
      <span class="spacer"></span>
      <button class="btn btn-secondary" data-decide="deny">${PLAN_APPROVAL_TEXT.keepPlanning}</button>
      <button class="btn btn-primary" data-decide="allow">${PLAN_APPROVAL_TEXT.approve}</button>
    </div>
    </div>`;
}

function cardBody(request, agentName) {
  if (request.kind === "question") return questionCard(request, agentName);
  return isPlanRequest(request) ? planCard(request, agentName) : permissionCard(request, agentName);
}

export function renderPendingCard(request, agentName) {
  return `<section class="card pending-card" data-pending="${esc(request.id)}">
    <p class="pending-flag"><span aria-hidden="true">●</span> aguardando você · volta para o terminal às ${clockTime(request.expiresAt)}</p>
    ${cardBody(request, agentName)}
    ${FAILED_DECISION_ALERT}
  </section>`;
}
