import { agentActionText } from "./agent-action-text.js";
import { statusOf } from "./agent-status.js";

const ACTIONS = [
  { id: "go-to-request", label: "Ir para o pedido", isOffered: ({ pendingCount }) => pendingCount > 0 },
  { id: "new-session", label: "Nova sessão", isOffered: ({ isRunnerAvailable }) => isRunnerAvailable },
  { id: "frame-whole", label: "Enquadrar a Sede inteira", isOffered: () => true },
  { id: "stop-following", label: "Parar de seguir com a câmera", isOffered: ({ isFollowing }) => isFollowing },
];

const agentEntry = (agent, room) => ({
  key: agent.key, name: agent.name, label: agent.label, room, status: statusOf(agent), doing: agentActionText(agent),
});

// Everything the Ctrl K search can find right now: the agents, the rooms on the floor and the actions that apply.
export function searchEntries({ projects, census, pendingCount, isRunnerAvailable, isFollowing }) {
  const now = { pendingCount, isRunnerAvailable, isFollowing };
  return {
    agents: Object.values(projects).flatMap((project) => Object.values(project.agents).map((agent) => agentEntry(agent, project.name))),
    rooms: [
      ...census.projects.map(({ key, name }) => ({ id: key, kind: "project", name })),
      ...census.areas.map(({ id, name }) => ({ id, kind: "area", name })),
    ],
    actions: ACTIONS.filter((action) => action.isOffered(now)).map(({ id, label }) => ({ id, label })),
  };
}
