import { ago, clockTime, esc, resetTime } from "./format.js";
import { icon } from "./icons.js";

const USAGE_WINDOWS = [["fiveHour", "5 h"], ["sevenDay", "Semana"]];
const HIGH_USAGE = 80;

function usageMeter(label, usageWindow) {
  const used = Math.round(usageWindow.usedPercentage);
  const reset = resetTime(usageWindow.resetsAt);
  return `<div class="usage-meter${used >= HIGH_USAGE ? " high" : ""}" title="Uso do plano na janela de ${esc(label)}${reset ? `, renova ${esc(reset)}` : ""}">
    <span class="label">${esc(label)}</span>
    <span class="bar" role="meter" aria-label="Uso ${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${used}"><span style="width:${used}%"></span></span>
    <span class="mono">${used}%</span>
    ${reset ? `<span class="muted">renova ${esc(reset)}</span>` : ""}
  </div>`;
}

export function renderUsage(usage) {
  const windows = USAGE_WINDOWS.filter(([key]) => usage?.rateLimits?.[key]);
  return windows.map(([key, label]) => usageMeter(label, usage.rateLimits[key])).join("");
}

export function renderPendingStrip(request) {
  const quickActions = request.kind === "permission"
    ? `<button class="btn btn-sm btn-secondary" data-decide="deny">Negar</button><button class="btn btn-sm btn-primary" data-decide="allow">Permitir</button>`
    : `<button class="btn btn-sm btn-primary" data-open-agent="${esc(request.agentKey)}">Responder</button>`;
  return `<div class="pending-strip" data-pending="${esc(request.id)}">
    <p class="pending-what">${esc(request.summary)}</p>
    ${request.detail ? `<code class="mono">${esc(request.detail)}</code>` : ""}
    <div class="pending-actions">${quickActions}</div>
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
    <legend>${item.header ? `<span class="badge">${esc(item.header)}</span>` : ""}<span>${esc(item.question)}</span></legend>
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
    <p class="pending-error" role="alert" hidden></p>
  </section>`;
}

export function renderAgentIdentity(agent, { mark, badge, origin }) {
  const role = [...new Set([agent.label, origin])].join(" · ");
  return `${mark}<div class="identity"><h2 class="panel-title" id="sheet-title">${esc(agent.name)}</h2><p class="muted">${esc(role)}</p></div>${badge}`;
}

export function renderAgentFacts(agent) {
  return `<div><dt>Agora</dt><dd>${esc(agent.action || "sem atividade")}</dd></div>
    <div><dt>Ferramentas</dt><dd class="mono">${agent.tools ?? 0}</dd></div>
    <div><dt>Começou</dt><dd>${ago(agent.startedAt)}</dd></div>
    <div><dt>Atualizado</dt><dd>${ago(agent.updatedAt)}</dd></div>`;
}

const DELIVERY_HINT = {
  queued: "Chega quando o agente terminar o turno atual.",
  live: "Chega na hora. No meio de um turno, entra logo em seguida.",
};

export function renderComposer(isLive) {
  return `<form class="composer">
    <div class="field"><label for="agent-message">Mensagem para o agente</label>
      <textarea class="textarea" id="agent-message" name="message" rows="3" maxlength="4000" required placeholder="Ex.: também atualize o README"></textarea></div>
    <div class="composer-foot">
      <span class="muted composer-hint">${isLive ? DELIVERY_HINT.live : DELIVERY_HINT.queued}</span>
      <button class="btn btn-primary" type="submit">Enviar</button>
    </div>
    <p class="composer-status" role="status"></p>
  </form>`;
}

const LIVE_TOOLS = `<button class="btn btn-sm btn-secondary" data-live="interrupt">Interromper</button>
    <button class="btn btn-sm btn-ghost" data-live="stop">Encerrar sessão</button>`;

function paneHead(isLive) {
  const title = isLive
    ? `<span class="pane-title"><span class="live-dot" aria-hidden="true"></span>Terminal ao vivo</span>`
    : `<span class="pane-title">Terminal e histórico</span>`;
  return `<header class="pane-head">${title}
    <span class="pane-tools">${isLive ? LIVE_TOOLS : `<span class="badge">somente leitura</span>`}
      <button type="button" class="icon-btn" data-expand aria-pressed="false" aria-label="Expandir terminal" title="Expandir">${icon("expand")}</button></span>
  </header>`;
}

export function renderSheetShell({ canReceiveMessages, isLive }) {
  return `<header class="panel-head sheet-head">
      <button class="icon-btn" data-close aria-label="Voltar para o time">${icon("back")}</button>
      <div class="sheet-identity" data-slot="identity"></div>
    </header>
    <div class="sheet-body">
      <div data-slot="pending"></div>
      <dl class="facts" data-slot="facts"></dl>
      ${canReceiveMessages ? renderComposer(isLive) : ""}
      <section class="pane" data-pane aria-label="${isLive ? "Terminal ao vivo" : "Terminal e histórico, somente leitura"}">
        ${paneHead(isLive)}
        <div class="pane-body" data-slot="history" tabindex="0"></div>
        <button type="button" class="btn btn-sm btn-secondary pane-jump" data-jump hidden>↓ novas linhas</button>
        <footer class="pane-foot" data-slot="history-foot"></footer>
      </section>
    </div>`;
}
