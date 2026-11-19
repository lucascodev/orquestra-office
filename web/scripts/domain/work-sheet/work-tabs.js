import { checklistProgress } from "./checklist-progress.js";
import { hasFailedLastRun } from "./test-fields.js";

export const FIRST_TAB = "now";
const TAB_ORDER = [FIRST_TAB, "todos", "plan", "tests"];
const TESTS_TAB = "tests";
const TODOS_TAB = "todos";
// Codex only reports the end of a turn, so it never has a list, a plan or tests; only Claude Code sessions get the tabs.
const SOURCE_WITH_WORK = "claude";

export const hasWorkTabs = (agent) => agent?.source === SOURCE_WITH_WORK;

export const shownTabOf = (agent, wanted) => (hasWorkTabs(agent) && TAB_ORDER.includes(wanted) ? wanted : FIRST_TAB);

// The tabs of the agent's sheet: the list's progress on Tarefas, and a mark on Testes while the last round failed and that
// tab is not the one open. An agent without tabs gets none.
export function workTabs(agent, wanted) {
  if (!hasWorkTabs(agent)) return [];
  const selected = shownTabOf(agent, wanted);
  const progress = checklistProgress(agent.checklist);
  return TAB_ORDER.map((id) => ({
    id,
    isSelected: id === selected,
    progress: id === TODOS_TAB && progress ? { done: progress.done, total: progress.total } : null,
    hasAlert: id === TESTS_TAB && id !== selected && hasFailedLastRun(agent.tests),
  }));
}
