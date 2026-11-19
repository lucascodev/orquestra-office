import { agentActionText } from "../../domain/office/agent-action-text.js";
import { statusOf } from "../../domain/office/agent-status.js";
import { STATUS } from "../office/status-display.js";
import { esc } from "../shared/escape-html.js";
import { ago } from "../shared/format.js";
import { icon } from "../shared/icons.js";

const NO_MESSAGES = "Só sessões do Claude Code abertas nesta máquina recebem mensagens pela Sede.";

export function renderAgentIdentity(agent, { mark, badge, origin }) {
  const role = [...new Set([agent.label, origin])].join(" · ");
  return `${mark}<div class="identity"><h2 class="panel-title" id="sheet-title">${esc(agent.name)}</h2><p class="muted">${esc(role)}</p></div>${badge}`;
}

export function renderAgentFacts(agent) {
  return `<div><dt>Agora</dt><dd>${esc(agentActionText(agent) || "sem atividade")}</dd></div>
    <div><dt>Ferramentas</dt><dd class="mono">${agent.tools ?? 0}</dd></div>
    <div><dt>Começou</dt><dd>${ago(agent.startedAt)}</dd></div>
    <div><dt>Atualizado</dt><dd>${ago(agent.updatedAt)}</dd></div>`;
}

const DELIVERY_HINT = {
  queued: "Chega quando o agente terminar o turno atual.",
  live: "Chega na hora. No meio de um turno, entra logo em seguida.",
};

function renderComposer(isLive, label = "Mensagem para o agente") {
  return `<form class="composer">
    <div class="field"><label for="agent-message">${esc(label)}</label>
      <textarea class="textarea" id="agent-message" name="message" rows="3" maxlength="4000" required placeholder="Ex.: também atualize o README"></textarea></div>
    <div class="composer-foot">
      <span class="muted composer-hint">${isLive ? DELIVERY_HINT.live : DELIVERY_HINT.queued}</span>
      <button class="btn btn-primary" type="submit">Enviar</button>
    </div>
    <p class="composer-status" role="status"></p>
  </form>`;
}

const INTERRUPT = `<button class="btn btn-sm btn-secondary" data-live="interrupt">Interromper</button>`;
const STOP = `<button class="btn btn-sm btn-ghost" data-live="stop">Encerrar sessão</button>`;
const LIVE_TOOLS = `${INTERRUPT}
    ${STOP}`;

function paneHead(isLive, liveTools = LIVE_TOOLS) {
  const title = isLive
    ? `<span class="pane-title"><span class="live-dot" aria-hidden="true"></span>Terminal ao vivo</span>`
    : `<span class="pane-title">Terminal e histórico</span>`;
  return `<header class="pane-head">${title}
    <span class="pane-tools">${isLive ? liveTools : `<span class="badge">somente leitura</span>`}
      <button type="button" class="icon-btn" data-expand aria-pressed="false" aria-label="Expandir terminal" title="Expandir">${icon("expand")}</button></span>
  </header>`;
}

function renderPane(isLive, liveTools) {
  return `<section class="pane" data-pane aria-label="${isLive ? "Terminal ao vivo" : "Terminal e histórico, somente leitura"}">
        ${paneHead(isLive, liveTools)}
        <div class="pane-body" data-slot="history" tabindex="0"></div>
        <button type="button" class="btn btn-sm btn-secondary pane-jump" data-jump hidden>↓ novas linhas</button>
        <footer class="pane-foot" data-slot="history-foot"></footer>
      </section>`;
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
      ${renderPane(isLive)}
    </div>`;
}

export function renderDrawerIdentity(agent, { mark, origin, projectName, accountLabel = null }) {
  const about = [...new Set([agent.label, origin]), projectName, accountLabel && `conta ${accountLabel}`].filter(Boolean).join(" · ");
  return `${mark}<div class="identity"><h2 class="panel-title" id="sheet-title">${esc(agent.name)}</h2><p class="muted">${esc(about)}</p></div>`;
}

export function renderDrawerStatus(agent) {
  const { glyph, color, sentence } = STATUS[statusOf(agent)];
  const action = agentActionText(agent);
  const tools = agent.tools ?? 0;
  return `<span class="hq-drawer-glyph" style="color:${color}" aria-hidden="true">${glyph}</span>
    <span><b>${esc(sentence)}</b>${action ? ` · ${esc(action)}` : ""}
      <span class="hq-drawer-when">atualizado ${ago(agent.updatedAt)} · ${tools === 1 ? "1 ferramenta" : `${tools} ferramentas`} · começou ${ago(agent.startedAt)}</span></span>`;
}

// The drawer of the headquarters, as in the approved mock-up: who, what now, follow and interrupt, the terminal, then the message.
export function renderDrawerShell({ agentName, canReceiveMessages, isLive, isFollowed }) {
  return `<header class="panel-head sheet-head hq-drawer-head">
      <div class="sheet-identity" data-slot="identity"></div>
      <button type="button" class="icon-btn" data-close aria-label="Fechar a ficha" title="Fechar a ficha (Esc)">${icon("close")}</button>
    </header>
    <div class="sheet-body hq-drawer-body">
      <div data-slot="pending"></div>
      <p class="hq-drawer-status" data-slot="facts"></p>
      <div class="hq-drawer-actions">
        <button type="button" class="btn btn-sm btn-secondary" data-action="follow" aria-pressed="${isFollowed}">Seguir com a câmera</button>${isLive ? `
        ${INTERRUPT}` : ""}
      </div>
      ${renderPane(isLive, STOP)}
      ${canReceiveMessages ? renderComposer(isLive, `Mensagem para ${agentName}`) : `<p class="muted hq-drawer-note">${NO_MESSAGES}</p>`}
    </div>`;
}
