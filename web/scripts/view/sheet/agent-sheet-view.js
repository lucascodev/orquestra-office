import { CHECKLIST_TEXT, WORK_TABS_LABEL } from "../../data/text/pt-br/work-sheet.js";
import { agentActionText } from "../../domain/office/agent-action-text.js";
import { statusOf } from "../../domain/office/agent-status.js";
import { fillPhrase } from "../../domain/text/fill-phrase.js";
import { checklistProgress } from "../../domain/work-sheet/checklist-progress.js";
import { FIRST_TAB } from "../../domain/work-sheet/work-tabs.js";
import { STATUS } from "../office/status-display.js";
import { esc } from "../shared/escape-html.js";
import { ago } from "../shared/format.js";
import { icon } from "../shared/icons.js";
import { workPanelId, workTabId } from "./work-tabs-view.js";

const NO_MESSAGES = "Só sessões do Claude Code abertas nesta máquina recebem mensagens pela Sede.";

const DELIVERY_HINT = {
  queued: "Chega quando o agente terminar o turno atual.",
  live: "Chega na hora. No meio de um turno, entra logo em seguida.",
};

function renderComposer(isLive, label) {
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

function paneHead(isLive, liveTools) {
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

export function renderDrawerIdentity(agent, { mark, origin, projectName, accountLabel = null }) {
  const about = [...new Set([agent.label, origin]), projectName, accountLabel && `conta ${accountLabel}`].filter(Boolean).join(" · ");
  return `${mark}<div class="identity"><h2 class="panel-title" id="sheet-title">${esc(agent.name)}</h2><p class="muted">${esc(about)}</p></div>`;
}

function checklistStep(agent) {
  const progress = checklistProgress(agent.checklist);
  if (!progress?.current) return "";
  return ` · ${fillPhrase(CHECKLIST_TEXT.step, { position: progress.current.position, total: progress.total })}`;
}

export function renderDrawerStatus(agent) {
  const { glyph, color, sentence } = STATUS[statusOf(agent)];
  const action = agentActionText(agent);
  const tools = agent.tools ?? 0;
  return `<span class="hq-drawer-glyph" style="color:${color}" aria-hidden="true">${glyph}</span>
    <span><b>${esc(sentence)}</b>${action ? ` · ${esc(action)}` : ""}
      <span class="hq-drawer-when">atualizado ${ago(agent.updatedAt)} · ${tools === 1 ? "1 ferramenta" : `${tools} ferramentas`} · começou ${ago(agent.startedAt)}${checklistStep(agent)}</span></span>`;
}

function renderNow({ agentName, canReceiveMessages, isLive, isFollowed }) {
  return `<div class="hq-drawer-actions">
        <button type="button" class="btn btn-sm btn-secondary" data-action="follow" aria-pressed="${isFollowed}">Seguir com a câmera</button>${isLive ? `
        ${INTERRUPT}` : ""}
      </div>
      ${renderPane(isLive, STOP)}
      ${canReceiveMessages ? renderComposer(isLive, `Mensagem para ${agentName}`) : `<p class="muted hq-drawer-note">${NO_MESSAGES}</p>`}`;
}

const WORK_PANELS = ["todos", "plan", "tests"];

function workPanel(id) {
  return `<div class="work-panel" role="tabpanel" id="${workPanelId(id)}" aria-labelledby="${workTabId(id)}" tabindex="0" data-work-panel="${id}" hidden><div data-slot="${id}"></div></div>`;
}

// With the tabs, what was the whole drawer becomes the Agora tab, and the list, the plan and the tests get one tab each.
function renderTabbedBody(options) {
  return `<div class="work-tabs" role="tablist" aria-label="${WORK_TABS_LABEL}" data-slot="work-tabs"></div>
      <div class="work-panel work-panel-now" role="tabpanel" id="${workPanelId(FIRST_TAB)}" aria-labelledby="${workTabId(FIRST_TAB)}" data-work-panel="${FIRST_TAB}">
      ${renderNow(options)}
      </div>
      ${WORK_PANELS.map(workPanel).join("\n      ")}`;
}

// The drawer of the headquarters, as in the approved mock-up: who, what now, follow and interrupt, the terminal, then the message.
// A Claude Code session also gets the tabs for its list, its plan and its tests.
export function renderDrawerShell({ hasWorkTabs = false, ...options }) {
  return `<header class="panel-head sheet-head hq-drawer-head">
      <div class="sheet-identity" data-slot="identity"></div>
      <button type="button" class="icon-btn" data-close aria-label="Fechar a ficha" title="Fechar a ficha (Esc)">${icon("close")}</button>
    </header>
    <div class="sheet-body hq-drawer-body${hasWorkTabs ? " has-work-tabs" : ""}">
      <div data-slot="pending"></div>
      <p class="hq-drawer-status" data-slot="facts"></p>
      ${hasWorkTabs ? renderTabbedBody(options) : renderNow(options)}
    </div>`;
}
