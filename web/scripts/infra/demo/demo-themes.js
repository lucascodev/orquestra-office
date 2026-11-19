import { THEMES } from "../../data/themes.js";

const MIN = 60_000;
const ROOT = "c:/projetos/temas";
const CREW = [
  ["Claude Code", "working", "editando o layout"],
  ["code-reviewer", "reviewing", "lendo o diff"],
  ["Codex", "waiting", "terminou o turno e espera você"],
  ["test-engineer", "idle", "sem tarefa no momento"],
];
const ROLES = ["tech-writer", "security-engineer"];

function crewMember(projectIndex, memberIndex, [label, status, action]) {
  const at = Date.now() - (projectIndex + memberIndex) * MIN;
  return {
    key: `demo:temas-${projectIndex}-${memberIndex}`, label, status, action, activity: null, source: label === "Codex" ? "codex" : "claude",
    kind: "main", parentKey: null, startedAt: at - 30 * MIN + memberIndex, updatedAt: at, endedAt: null, tools: 10 + memberIndex,
    log: [{ at, text: action }],
  };
}

// Each project brings a different number of people, so lit screens, empty chairs and reserved desks show on every theme.
function themeProject(theme, index) {
  const key = `${ROOT}/${theme.id}`;
  const crew = CREW.slice(0, 1 + (index % CREW.length)).map((member, memberIndex) => crewMember(index, memberIndex, member));
  return {
    key, name: theme.id, template: theme.id, team: ROLES.slice(0, index % (ROLES.length + 1)), createdAt: index, updatedAt: Date.now(),
    stats: { prompts: 3, tools: 20, turns: 2, tokens: 90_000, costUsd: 0.8 },
    agents: Object.fromEntries(crew.map((agent) => [agent.key, agent])),
  };
}

export function demoThemesState() {
  return {
    pending: [],
    outbox: {},
    runner: { isAvailable: false, sessions: [] },
    usage: null,
    projects: Object.fromEntries(THEMES.map(themeProject).map((project) => [project.key, project])),
  };
}
