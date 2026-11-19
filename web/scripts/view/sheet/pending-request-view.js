import { clipText } from "../../domain/text/clip-text.js";
import { esc } from "../shared/escape-html.js";
import { clockTime } from "../shared/format.js";

// Only what is shown is clipped: data-question keeps the whole text, because it is the key Claude Code checks the answer by.
const QUESTION_TEXT_LIMIT = 500;
const FAILED_DECISION_ALERT = `<p class="pending-error" role="alert" hidden></p>`;

const quickDecision = () => `<div class="pending-actions"><button class="btn btn-sm btn-secondary" data-decide="deny">Negar</button><button class="btn btn-sm btn-primary" data-decide="allow">Permitir</button></div>
    ${FAILED_DECISION_ALERT}`;

const answerInSheet = (request) => `<div class="pending-actions"><button class="btn btn-sm btn-primary" data-open-agent="${esc(request.agentKey)}">Responder</button></div>`;

export function renderPendingStrip(request) {
  return `<div class="pending-strip" data-pending="${esc(request.id)}">
    <p class="pending-what">${esc(request.summary)}</p>
    ${request.detail ? `<code class="mono">${esc(request.detail)}</code>` : ""}
    ${request.kind === "permission" ? quickDecision() : answerInSheet(request)}
  </div>`;
}

function permissionCard(request, agentName) {
  return `<h3 class="card-title">${esc(agentName)} quer usar ${esc(request.toolName)}</h3>
    <p class="pending-what">${esc(request.summary)}</p>
    ${request.detail ? `<pre class="mono">${esc(request.detail)}</pre>` : ""}
    <div class="field"><label for="deny-reason">Motivo, se for negar (opcional)</label><input class="input" id="deny-reason" type="text" name="reason" maxlength="500" autocomplete="off"></div>
    <div class="pending-actions">
      <button class="btn btn-ghost" data-decide="terminal">Decidir no terminal</button>
      <span class="spacer"></span>
      <button class="btn btn-secondary" data-decide="deny">Negar</button>
      <button class="btn btn-primary" data-decide="allow">Permitir</button>
    </div>`;
}

function questionBlock(item, index) {
  const options = item.options.map((option) => `<button type="button" class="choice" aria-pressed="false" data-option="${esc(option.label)}">
      <b>${esc(option.label)}</b>${option.description ? `<span>${esc(option.description)}</span>` : ""}</button>`).join("");
  return `<fieldset class="question" data-question="${esc(item.question)}" data-multi="${item.multiSelect}">
    <legend>${item.header ? `<span class="badge">${esc(item.header)}</span>` : ""}<span>${esc(clipText(item.question, QUESTION_TEXT_LIMIT))}</span></legend>
    <div class="choices">${options}</div>
    <div class="field"><label for="other-${index}">Outra resposta</label><input class="input" id="other-${index}" type="text" maxlength="1000" autocomplete="off"></div>
  </fieldset>`;
}

function questionCard(request, agentName) {
  return `<h3 class="card-title">${esc(agentName)} tem uma pergunta</h3>
    ${request.questions.map(questionBlock).join("")}
    <div class="pending-actions">
      <button class="btn btn-ghost" data-decide="terminal">Responder no terminal</button>
      <span class="spacer"></span>
      <button class="btn btn-primary" data-decide="answer">Enviar resposta</button>
    </div>`;
}

export function renderPendingCard(request, agentName) {
  const body = request.kind === "question" ? questionCard(request, agentName) : permissionCard(request, agentName);
  return `<section class="card pending-card" data-pending="${esc(request.id)}">
    <p class="pending-flag"><span aria-hidden="true">●</span> aguardando você · volta para o terminal às ${clockTime(request.expiresAt)}</p>
    ${body}
    ${FAILED_DECISION_ALERT}
  </section>`;
}
