import { logEntryText } from "../domain/office/agent-action-text.js";
import { ownValueOf } from "../domain/shared/own-value.js";
import { ago } from "../view/shared/format.js";
import { renderPendingCard } from "../view/sheet/pending-request-view.js";
import { renderEntries, renderHistory } from "../view/terminal/terminal-entries.js";
import { decisionOf, submitDecision, toggleOption } from "./decision-form.js";
import { createTerminalPane } from "./terminal-pane.js";
import { createWorkTabs } from "./work-tabs.js";

const MESSAGE_FAILED = "Não deu para enviar a mensagem.";
const LIVE_STATUS = { starting: "abrindo a sessão…", working: "trabalhando…", idle: "aguardando sua mensagem", ended: "sessão encerrada" };
const FIRST_ANSWER = "[data-pending] [data-option], [data-pending] input";

const logAsHistory = (agent) => (agent.log ?? []).map((item) => ({ at: item.at, kind: "note", text: logEntryText(item), detail: "" }));

function queueStatus(queued) {
  if (!queued) return "";
  return queued === 1 ? "1 mensagem na fila, esperando o fim do turno." : `${queued} mensagens na fila, esperando o fim do turno.`;
}

// The agent's sheet, in the drawer over the map. The view draws it, onOpen and onClose place it on the page, and actions
// answer the buttons a view adds with data-action.
export function createAgentPanel({ sheet, control, view, clockNow = Date.now, onOpen = () => {}, onClose = () => {}, actions = {} }) {
  let agentKey = null;
  let isLive = false;
  let shownRequestId = null;
  let historyStamp = null;
  let terminal = null;
  let stopWatching = () => {};
  const workTabs = createWorkTabs({ sheet, control, view, clockNow });

  const slot = (name) => sheet.querySelector(`[data-slot="${name}"]`);

  function close() {
    if (!agentKey) return;
    const closedKey = agentKey;
    agentKey = null;
    stopWatching();
    workTabs.close();
    sheet.hidden = true;
    onClose(closedKey);
  }

  function showRequest(request, agent) {
    const id = request?.id ?? null;
    if (id === shownRequestId) return;
    shownRequestId = id;
    slot("pending").innerHTML = request ? renderPendingCard(request, agent.name) : "";
  }

  async function refreshHistory(agent) {
    const stamp = `${agent.key}|${agent.updatedAt}`;
    if (stamp === historyStamp) return;
    historyStamp = stamp;
    const entries = await control.loadHistory(agent).catch(() => []);
    if (agentKey !== agent.key || isLive) return;
    terminal.show(renderHistory(entries.length ? entries : logAsHistory(agent)));
  }

  function watchLiveTerminal(agent) {
    return control.watchTerminal(agent, {
      onSnapshot: ({ entries, partial }) => terminal.showLive(renderEntries(entries), partial),
      onChange: (change) => {
        if (change.type === "delta") terminal.stream(change.text);
        if (change.type === "entry") terminal.append(renderEntries([change.entry]));
      },
    });
  }

  function placeFocus(target) {
    const answer = target === "request" ? sheet.querySelector(FIRST_ANSWER) : null;
    (answer ?? sheet.querySelector("[data-close]")).focus();
  }

  function open(agent, context, { focus = "close" } = {}) {
    stopWatching();
    agentKey = agent.key;
    isLive = Boolean(context.liveStatus);
    shownRequestId = null;
    historyStamp = null;
    sheet.innerHTML = view.shell(agent, { ...context, isLive });
    workTabs.open(agent.key);
    terminal = createTerminalPane(sheet.querySelector("[data-pane]"));
    onOpen(agent);
    sheet.hidden = false;
    stopWatching = isLive ? watchLiveTerminal(agent) : () => {};
    update(agent, context);
    placeFocus(focus);
  }

  function update(agent, context) {
    if (!agentKey) return;
    if (!agent) {
      close();
      return;
    }
    if (Boolean(context.liveStatus) !== isLive) {
      open(agent, context);
      return;
    }
    slot("identity").innerHTML = view.identity(agent, context);
    slot("facts").innerHTML = view.facts(agent, context);
    showRequest(context.request, agent);
    workTabs.render(agent);
    const status = sheet.querySelector(".composer-status");
    if (status && status.dataset.error !== "true") status.textContent = queueStatus(context.queued);
    if (isLive) {
      slot("history-foot").textContent = ownValueOf(LIVE_STATUS, context.liveStatus) ?? "";
      return;
    }
    slot("history-foot").textContent = `atualizado ${ago(agent.updatedAt)} · ${agent.tools ?? 0} ferramentas`;
    refreshHistory(agent);
  }

  async function sendMessage(form) {
    const field = form.elements.message;
    const status = form.querySelector(".composer-status");
    const text = field.value.trim();
    if (!text) return;
    const wasSent = await control.sendMessage(agentKey, text).catch(() => false);
    status.dataset.error = String(!wasSent);
    if (wasSent) field.value = "";
    else status.textContent = MESSAGE_FAILED;
  }

  const LIVE_ACTIONS = { interrupt: control.interruptSession, stop: control.stopSession };

  sheet.addEventListener("click", (event) => {
    if (event.target.closest("[data-close]")) return close();
    const option = event.target.closest("[data-option]");
    if (option) return toggleOption(option);
    const decision = decisionOf(event.target.closest("[data-decide]"));
    if (decision) return submitDecision(control, decision.card, decision.action);
    const live = event.target.closest("[data-live]");
    if (live) return LIVE_ACTIONS[live.dataset.live]?.(agentKey);
    const action = event.target.closest("[data-action]");
    if (action) return ownValueOf(actions, action.dataset.action)?.(agentKey, action);
    return undefined;
  });

  sheet.addEventListener("submit", (event) => {
    event.preventDefault();
    if (event.target.matches(".composer")) sendMessage(event.target);
  });

  return { open, update, close, openAgentKey: () => agentKey };
}
