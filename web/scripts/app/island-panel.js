import { renderIslandDay, renderIslandIdentity, renderIslandShell, renderIslandTeam } from "../view/sheet/island-sheet-view.js";

const THEME_FIELD = 'input[name="island-theme"]';
const CLOSED_ANNOUNCEMENT = "fechada. Ela volta quando uma sessão desta pasta trabalhar de novo.";
const CLOSE_FAILED = "Não deu para fechar a sala";

// The island's sheet: who works on the project, its day, its theme and closing the room. It lives in the same drawer as the
// agent's sheet; the drawer decides which of the two is shown.
export function createIslandPanel({ sheet, control, onOpen = () => {}, onClose = () => {}, onOpenAgent, onNewSession, announce }) {
  let projectKey = null;
  let projectName = "";
  const renderedHtml = new Map();

  const slot = (name) => sheet.querySelector(`[data-slot="${name}"]`);

  function setSlot(name, html) {
    if (renderedHtml.get(name) === html) return;
    renderedHtml.set(name, html);
    const element = slot(name);
    const focusedAgent = element.contains(document.activeElement) ? document.activeElement.dataset.agent : undefined;
    element.innerHTML = html;
    if (focusedAgent !== undefined) element.querySelector(`[data-agent="${CSS.escape(focusedAgent)}"]`)?.focus();
  }

  function showTheme(themeId) {
    for (const field of sheet.querySelectorAll(THEME_FIELD)) field.checked = field.value === themeId;
  }

  function close() {
    if (!projectKey) return;
    projectKey = null;
    sheet.hidden = true;
    onClose();
  }

  function update(facts, context) {
    if (!projectKey) return;
    if (!facts) {
      close();
      return;
    }
    projectName = facts.name;
    setSlot("identity", renderIslandIdentity(facts));
    setSlot("team", renderIslandTeam(facts.team));
    setSlot("day", renderIslandDay(facts.day));
    showTheme(facts.themeId);
    sheet.querySelector("[data-new-session-here]").hidden = !context.canOpenSession;
  }

  function open(facts, context) {
    projectKey = facts.key;
    renderedHtml.clear();
    sheet.innerHTML = renderIslandShell();
    onOpen(facts);
    sheet.hidden = false;
    update(facts, context);
    sheet.querySelector("[data-close]").focus();
  }

  async function closeRoom() {
    const closedName = projectName;
    const wasClosed = await control.closeProject(projectKey).catch(() => false);
    announce(wasClosed ? `Sala ${closedName} ${CLOSED_ANNOUNCEMENT}` : `${CLOSE_FAILED} ${closedName}.`);
  }

  sheet.addEventListener("click", (event) => {
    if (!projectKey) return;
    if (event.target.closest("[data-close]")) return close();
    const member = event.target.closest("[data-agent]");
    if (member) return onOpenAgent(member.dataset.agent, member);
    if (event.target.closest("[data-new-session-here]")) return onNewSession(projectKey);
    if (event.target.closest("[data-close-room]")) return closeRoom();
    return undefined;
  });

  sheet.addEventListener("change", (event) => {
    if (projectKey && event.target.matches(THEME_FIELD)) control.setTemplate(projectKey, event.target.value);
  });

  return { open, update, close, openProjectKey: () => projectKey };
}
