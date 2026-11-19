import { toolSummaryText } from "../../domain/terminal/tool-summary-text.js";
import { esc } from "../shared/escape-html.js";
import { formatCountdown } from "../shared/format.js";
import { shownQuestion } from "../shared/shown-question.js";

const COMMAND_TOOL = "Bash";
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
      <div class="hq-alert-row">${command}
        <button class="btn btn-sm btn-secondary" type="button" data-decide="deny" aria-keyshortcuts="N">Negar <kbd aria-hidden="true">N</kbd></button>
        <button class="btn btn-sm btn-primary" type="button" data-decide="allow" aria-keyshortcuts="A">Permitir <kbd aria-hidden="true">A</kbd></button>
      </div>
      <div class="hq-alert-foot">${explained}
        <button class="btn btn-sm btn-ghost" type="button" data-decide="terminal">Decidir no terminal</button>
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
  return request.kind === QUESTION ? questionBody(request) : permissionBody(request);
}
