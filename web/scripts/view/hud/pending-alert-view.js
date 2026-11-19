import { PLAN_APPROVAL_TEXT } from "../../data/text/pt-br/plan-approval.js";
import { toolSummaryText } from "../../domain/terminal/tool-summary-text.js";
import { isPlanRequest, planOfRequest } from "../../domain/work-sheet/plan-request.js";
import { esc } from "../shared/escape-html.js";
import { formatCountdown } from "../shared/format.js";
import { renderPlanMarkdown } from "../shared/plan-markdown.js";
import { shownQuestion } from "../shared/shown-question.js";

const COMMAND_TOOL = "Bash";
const PLAN_REASON_FIELD = "hq-plan-reason";
const REASON_LIMIT = 1000;
const QUESTION = "question";
const UNKNOWN_AGENT = "Um agente";

const whoOf = (requester) => requester?.name ?? UNKNOWN_AGENT;

export function countdownText(remainingMs) {
  if (remainingMs === null) return "sem prazo para voltar ao terminal";
  if (remainingMs <= 0) return "voltando ao terminal";
  return `volta ao terminal em ${formatCountdown(remainingMs)}`;
}

export function arrivalText(requester, intent) {
  const who = whoOf(requester);
  return requester?.projectName ? `${who}, em ${requester.projectName}, ${intent}.` : `${who} ${intent}.`;
}

export function arrivalsText(arrivals) {
  const [first] = arrivals;
  if (arrivals.length === 1) return arrivalText(first.requester, first.intent);
  return `${arrivals.length} pedidos novos. ${arrivalText(first.requester, first.intent)}`;
}

export function requestsButtonLabel(count) {
  if (count === 0) return "Pedidos: nenhum esperando você";
  return count === 1 ? "Pedidos: 1 esperando você" : `Pedidos: ${count} esperando você`;
}

export const warningText = (requester) => `Faltam 30 segundos para o pedido de ${whoOf(requester)} voltar ao terminal.`;

function stepButtons({ previousId, nextId, total }) {
  if (total < 2) return "";
  return `<span class="hq-alert-steps">
      <button class="hq-step" type="button" data-step="previous" aria-label="Pedido anterior"${previousId ? "" : " disabled"}>‹</button>
      <button class="hq-step" type="button" data-step="next" aria-label="Próximo pedido"${nextId ? "" : " disabled"}>›</button>
    </span>`;
}

export function renderAlertHead({ requester, intent, position, total, previousId, nextId }) {
  return `<span class="hq-alert-mark" aria-hidden="true">!</span>
    <p class="hq-alert-title"><b>${esc(whoOf(requester))}</b>${requester?.projectName ? ` <span class="hq-muted">em ${esc(requester.projectName)}</span>` : ""} ${esc(intent)}</p>
    <span class="hq-alert-meta"><span class="sr-only">pedido </span>${position} de ${total}<span aria-hidden="true"> · </span><span data-countdown></span></span>
    ${stepButtons({ previousId, nextId, total })}`;
}

function permissionBody(request) {
  const summary = toolSummaryText(request);
  const command = request.detail
    ? `<code class="hq-command">${request.toolName === COMMAND_TOOL ? `<span class="hq-prompt" aria-hidden="true">$</span> ` : ""}${esc(request.detail)}</code>`
    : `<p class="hq-alert-what">${esc(summary)}</p>`;
  const explained = request.detail && summary && summary !== request.detail ? `<p class="hq-alert-summary">${esc(summary)}</p>` : "";
  return `<div class="hq-alert-body" data-pending="${esc(request.id)}">
      <div class="hq-alert-decision" data-decision-bar>
      <div class="hq-alert-row">${command}
        <button class="btn btn-sm btn-secondary" type="button" data-decide="deny" aria-keyshortcuts="N">Negar <kbd aria-hidden="true">N</kbd></button>
        <button class="btn btn-sm btn-primary" type="button" data-decide="allow" aria-keyshortcuts="A">Permitir <kbd aria-hidden="true">A</kbd></button>
      </div>
      <div class="hq-alert-foot">${explained}
        <button class="btn btn-sm btn-ghost" type="button" data-decide="terminal">Decidir no terminal</button>
      </div>
      </div>
      <p class="pending-error" role="alert" hidden></p>
    </div>`;
}

function planContent(plan) {
  if (!plan) return `<p class="hq-muted">${PLAN_APPROVAL_TEXT.missing}</p>`;
  const cut = plan.isTruncated ? `<p class="plan-cut">${PLAN_APPROVAL_TEXT.truncated}</p>` : "";
  return `${renderPlanMarkdown(plan.text)}${cut}`;
}

// The plan lives in its own box, apart from the bar that decides it; only the bar's buttons and its own field answer the
// request. Approving takes a click: the plan has no A key, only N to keep planning.
function planBody(request) {
  return `<div class="hq-alert-body is-plan" data-pending="${esc(request.id)}">
      <article class="hq-plan md" aria-label="${PLAN_APPROVAL_TEXT.planLabel}" tabindex="0">${planContent(planOfRequest(request))}</article>
      <div class="hq-plan-decision" data-decision-bar data-reason-field="${PLAN_REASON_FIELD}">
        <div class="field"><label for="${PLAN_REASON_FIELD}">${PLAN_APPROVAL_TEXT.reasonLabel}</label><textarea class="textarea" id="${PLAN_REASON_FIELD}" rows="2" maxlength="${REASON_LIMIT}" autocomplete="off" placeholder="${esc(PLAN_APPROVAL_TEXT.reasonPlaceholder)}"></textarea></div>
        <div class="hq-alert-row">
          <button class="btn btn-sm btn-ghost" type="button" data-decide="terminal">${PLAN_APPROVAL_TEXT.terminal}</button>
          <span class="spacer"></span>
          <button class="btn btn-sm btn-secondary" type="button" data-decide="deny" aria-keyshortcuts="N">${PLAN_APPROVAL_TEXT.keepPlanning} <kbd aria-hidden="true">N</kbd></button>
          <button class="btn btn-sm btn-primary" type="button" data-decide="allow">${PLAN_APPROVAL_TEXT.approve}</button>
        </div>
      </div>
      <p class="pending-error" role="alert" hidden></p>
    </div>`;
}

function questionBody(request) {
  const [first, ...others] = request.questions ?? [];
  const more = others.length > 0 ? ` <span class="hq-muted">e mais ${others.length}</span>` : "";
  return `<div class="hq-alert-body" data-pending="${esc(request.id)}">
      <div class="hq-alert-row"><p class="hq-alert-what">${esc(first ? shownQuestion(first.question) : toolSummaryText(request))}${more}</p>
        <button class="btn btn-sm btn-primary" type="button" data-open-agent="${esc(request.agentKey)}">Abrir a ficha e responder</button>
      </div>
      <p class="pending-error" role="alert" hidden></p>
    </div>`;
}

export function renderAlertBody(request) {
  if (request.kind === QUESTION) return questionBody(request);
  return isPlanRequest(request) ? planBody(request) : permissionBody(request);
}
