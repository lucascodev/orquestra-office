import { THEMES } from "../../data/themes.js";

const MIN = 60_000;
const ROOT = "c:/projetos/estresse";
const PROJECTS = 12;
const MAIN_AGENTS = 4;
const ROLES = ["code-reviewer", "test-engineer"];
const DOINGS = [
  ["working", "editing", "editing", "people.js"],
  ["working", "terminal", "running", "npm"],
  ["reviewing", "reading", "reading", "README.md"],
  ["working", "thinking", "prompt-received", null],
  ["break", null, "turn-finished", null],
  ["idle", null, "no-task", null],
  ["working", "planning", "updating-todos", null],
  ["reviewing", "web", "searching-web", null],
  ["needs_you", "asking", "asking-question", null],
  ["break", null, "task-delivered", null],
  ["working", "delegating", "delegating", "Explore"],
  ["waiting", null, "turn-finished-waiting", null],
  ["idle", null, "no-task", null],
  ["working", "editing", "editing", "office-store.js"],
  ["reviewing", "reading", "reading", "server.js"],
  ["break", null, "turn-finished", null],
  ["blocked", null, "api-error", null],
  ["working", "terminal", "running", "node"],
  ["idle", null, "no-task", null],
  ["break", null, "turn-finished", null],
];

function stressAgent(projectIndex, memberIndex, parentKey) {
  const order = projectIndex * (MAIN_AGENTS + 1) + memberIndex;
  const [status, activity, actionId, subject] = DOINGS[order % DOINGS.length];
  const at = Date.now() - (order % 17) * MIN;
  const key = parentKey ? `${parentKey}:s${memberIndex}` : `demo:estresse-${projectIndex}-${memberIndex}`;
  return {
    key, label: parentKey ? ROLES[projectIndex % ROLES.length] : "Claude Code", status, activity, actionId, subject,
    source: memberIndex === MAIN_AGENTS - 1 ? "codex" : "claude", kind: parentKey ? "subagent" : "main", parentKey: parentKey ?? null,
    startedAt: at - 30 * MIN, updatedAt: at, endedAt: null, tools: 8 + (order % 23),
    log: [{ at, actionId, subject }],
  };
}

function stressProject(index) {
  const theme = THEMES[index % THEMES.length];
  const key = `${ROOT}/projeto-${String(index + 1).padStart(2, "0")}`;
  const mains = Array.from({ length: MAIN_AGENTS }, (_, member) => stressAgent(index, member, null));
  const helper = stressAgent(index, MAIN_AGENTS, mains[0].key);
  return {
    key, name: `projeto-${index + 1}`, template: theme.id, team: [], createdAt: index, updatedAt: Date.now(),
    stats: { prompts: 6, tools: 60, turns: 5, tokens: 240_000, costUsd: 2.1 },
    agents: Object.fromEntries([...mains, helper].map((agent) => [agent.key, agent])),
  };
}

// As many projects and agents as the headquarters is designed for, with a working day's mix of desks and free time, to measure.
export function demoStressState() {
  return {
    pending: [],
    outbox: {},
    runner: { isAvailable: false, sessions: [] },
    usage: null,
    projects: Object.fromEntries(Array.from({ length: PROJECTS }, (_, index) => stressProject(index)).map((project) => [project.key, project])),
  };
}
