import { themeById } from "../data/themes.js";
import { withAgentNames } from "../domain/office/agent-names.js";
import { canReceiveMessages } from "../domain/office/can-receive-messages.js";
import { sortedProjects } from "../domain/office/project-order.js";
import { readPreference, writePreference } from "../infra/local-preferences.js";
import { renderNoProjects, renderOffice } from "../view/office/room-view.js";
import { renderTabs } from "../view/office/tabs-view.js";
import { renderTeam } from "../view/office/team-view.js";
import { renderUsage } from "../view/office/usage-view.js";
import { submitDecision } from "./decision-form.js";

const SELECTED_KEY = "office.selected";
const RELATIVE_TIMES_REFRESH_MS = 30_000;
const MODE_LABEL = {
  connecting: "conectando", live: "ao vivo", offline: "sem conexão com o coletor",
  demo: "prévia com dados de exemplo",
};

export function createOfficePage({ elements, source, agentPanel, room, newSessionDialog }) {
  const { tabs: tabsEl, office: officeEl, side: sideEl, team: teamEl, mode: modeEl, usage: usageEl, openSession: openSessionButton, runnerOff: runnerOffBadge } = elements;

  let state = { mode: "connecting", projects: {}, pending: [], outbox: {}, usage: null, runner: { isAvailable: false, liveAgents: {} } };
  let awaitedAgentKey = null;
  let selected = readPreference(SELECTED_KEY);
  // Redrawing between press and release would swap the button under the pointer and swallow the click.
  let isPressing = false;
  let hasDeferredRender = false;
  const renderedHtml = new WeakMap();

  function currentProject() {
    if (!state.projects[selected]) selected = sortedProjects(state.projects)[0]?.key ?? null;
    return selected ? state.projects[selected] : null;
  }

  function panelContext(agent) {
    const liveStatus = state.runner.liveAgents[agent.key] ?? null;
    return {
      request: state.pending.find((request) => request.agentKey === agent.key) ?? null,
      queued: state.outbox[agent.key] ?? 0,
      liveStatus,
      canReceiveMessages: Boolean(liveStatus) || canReceiveMessages(agent),
    };
  }

  function showRoom(project) {
    const host = document.getElementById("room-host");
    if (!host) return;
    if (!room) {
      host.innerHTML = `<p class="room-empty">Este navegador não conseguiu abrir a cena 3D. A lista ao lado continua funcionando.</p>`;
      return;
    }
    host.appendChild(room.element);
    room.show(project, themeById(project.template));
    room.resize();
  }

  function setHtml(element, html) {
    if (renderedHtml.get(element) === html) return;
    renderedHtml.set(element, html);
    element.innerHTML = html;
  }

  function renderProject(project) {
    const pendingByAgent = new Map(state.pending.map((request) => [request.agentKey, request]));
    setHtml(officeEl, renderOffice(project));
    setHtml(teamEl, renderTeam(project, { pendingByAgent, outbox: state.outbox }));
    showRoom(project);
    const openKey = agentPanel.openAgentKey();
    if (!openKey) return;
    const agent = project.agents[openKey] ?? null;
    agentPanel.update(agent, agent ? panelContext(agent) : null);
  }

  function render() {
    const focused = document.activeElement;
    if (focused?.id === "template-select") return;
    if (isPressing) {
      hasDeferredRender = true;
      return;
    }
    const focusedAgent = focused?.dataset?.agent;
    modeEl.textContent = MODE_LABEL[state.mode] ?? state.mode;
    modeEl.dataset.mode = state.mode;
    setHtml(usageEl, renderUsage(state.usage));
    openSessionButton.hidden = !state.runner.isAvailable;
    runnerOffBadge.hidden = state.mode !== "live" || state.runner.isAvailable;
    const awaitedProject = awaitedAgentKey ? Object.values(state.projects).find((candidate) => candidate.agents[awaitedAgentKey]) : null;
    if (awaitedProject) selected = awaitedProject.key;
    setHtml(tabsEl, renderTabs(state.projects, selected));
    const project = currentProject();
    sideEl.hidden = !project;
    if (project) renderProject(project);
    else {
      agentPanel.close();
      setHtml(officeEl, renderNoProjects());
    }
    if (focusedAgent) teamEl.querySelector(`[data-agent="${CSS.escape(focusedAgent)}"]`)?.focus();
    if (awaitedProject) {
      const arrivedKey = awaitedAgentKey;
      awaitedAgentKey = null;
      openAgent(arrivedKey);
    }
  }

  function openAgent(agentKey) {
    const project = currentProject();
    const agent = project?.agents[agentKey];
    if (agent) agentPanel.open(agent, panelContext(agent));
  }

  function selectProject(projectKey) {
    agentPanel.close();
    selected = projectKey;
    writePreference(SELECTED_KEY, selected);
    render();
  }

  function receive(next) {
    const projects = Object.fromEntries(Object.entries(next.projects).map(([key, project]) => [key, withAgentNames(project)]));
    state = { ...next, projects };
    render();
  }

  function awaitAgent(agentKey) {
    awaitedAgentKey = agentKey;
    render();
  }

  tabsEl.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-project]");
    if (tab) selectProject(tab.dataset.project);
  });

  teamEl.addEventListener("click", (event) => {
    const decide = event.target.closest("[data-decide]");
    if (decide) {
      submitDecision(source, decide.closest("[data-pending]"), decide.dataset.decide);
      return;
    }
    const target = event.target.closest("[data-agent], [data-open-agent]");
    if (target) openAgent(target.dataset.agent ?? target.dataset.openAgent);
  });

  officeEl.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-room]") && selected) source.closeProject(selected);
  });

  openSessionButton.addEventListener("click", () => {
    newSessionDialog.show(currentProject()?.key ?? "");
  });

  officeEl.addEventListener("change", (event) => {
    if (event.target.id !== "template-select" || !selected) return;
    const template = event.target.value;
    event.target.blur();
    source.setTemplate(selected, template);
  });

  function releasePress() {
    isPressing = false;
    if (!hasDeferredRender) return;
    hasDeferredRender = false;
    setTimeout(render);
  }

  for (const pressable of [tabsEl, officeEl, teamEl]) pressable.addEventListener("pointerdown", () => { isPressing = true; });
  window.addEventListener("pointerup", releasePress);
  window.addEventListener("pointercancel", releasePress);

  document.addEventListener("keydown", (event) => { if (event.key === "Escape") agentPanel.close(); });
  setInterval(render, RELATIVE_TIMES_REFRESH_MS);

  return { receive, openAgent, awaitAgent };
}
