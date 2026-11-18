import { logEntryText } from "../domain/office/agent-action-text.js";
import { ownValueOf } from "../domain/shared/own-value.js";
import { agentMark, originOf, statusBadge } from "../view/office/agent-badges.js";
import { ago } from "../view/shared/format.js";
import { renderAgentFacts, renderAgentIdentity, renderSheetShell } from "../view/sheet/agent-sheet-view.js";
import { renderPendingCard } from "../view/sheet/pending-request-view.js";
import { renderEntries, renderHistory } from "../view/terminal/terminal-entries.js";
import { submitDecision, toggleOption } from "./decision-form.js";
import { createTerminalPane } from "./terminal-pane.js";

const MESSAGE_FAILED = "Não deu para enviar a mensagem.";
const LIVE_STATUS = { starting: "abrindo a sessão…", working: "trabalhando…", idle: "aguardando sua mensagem", ended: "sessão encerrada" };

const logAsHistory = (agent) => (agent.log ?? []).map((item) => ({ at: item.at, kind: "note", text: logEntryText(item), detail: "" }));

function queueStatus(queued) {
  if (!queued) return "";
  return queued === 1 ? "1 mensagem na fila, esperando o fim do turno." : `${queued} mensagens na fila, esperando o fim do turno.`;
}

export function createAgentPanel({ team, sheet, control }) {
  let agentKey = null;
  let isLive = false;
  let shownRequestId = null;
  let historyStamp = null;
  let terminal = null;
  let stopWatching = () => {};

  const slot = (name) => sheet.querySelector(`[data-slot="${name}"]`);

  function close() {
    if (!agentKey) return;
    const closedKey = agentKey;
    agentKey = null;
    stopWatching();
    sheet.hidden = true;
    team.hidden = false;
    team.querySelector(`[data-agent="${CSS.escape(closedKey)}"]`)?.focus();
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

  function open(agent, context) {
    stopWatching();
    agentKey = agent.key;
    isLive = Boolean(context.liveStatus);
    shownRequestId = null;
    historyStamp = null;
    sheet.innerHTML = renderSheetShell({ canReceiveMessages: context.canReceiveMessages, isLive });
    terminal = createTerminalPane(sheet.querySelector("[data-pane]"));
    team.hidden = true;
    sheet.hidden = false;
    stopWatching = isLive ? watchLiveTerminal(agent) : () => {};
    update(agent, context);
    sheet.querySelector("[data-close]").focus();
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
    slot("identity").innerHTML = renderAgentIdentity(agent, { mark: agentMark(agent), badge: statusBadge(agent), origin: originOf(agent) });
    slot("facts").innerHTML = renderAgentFacts(agent);
    showRequest(context.request, agent);
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
    const decide = event.target.closest("[data-decide]");
    if (decide) return submitDecision(control, decide.closest("[data-pending]"), decide.dataset.decide);
    const live = event.target.closest("[data-live]");
    if (live) return LIVE_ACTIONS[live.dataset.live]?.(agentKey);
    return undefined;
  });

  sheet.addEventListener("submit", (event) => {
    event.preventDefault();
    if (event.target.matches(".composer")) sendMessage(event.target);
  });

  return { open, update, close, openAgentKey: () => agentKey };
}
