const NEEDS_YOU = "needs_you";
const DIACRITICS = /\p{Diacritic}/gu;
const SPACES = /\s+/;

const normalized = (text) => (text ?? "").normalize("NFD").replace(DIACRITICS, "").toLocaleLowerCase("pt-BR");
const wordsOf = (query) => normalized(query).split(SPACES).filter(Boolean);
const matchesAll = (words, fields) => {
  const haystack = normalized(fields.join(" "));
  return words.every((word) => haystack.includes(word));
};

const needsYouFirst = (a, b) => Number(b.status === NEEDS_YOU) - Number(a.status === NEEDS_YOU) || a.name.localeCompare(b.name, "pt-BR");

function groupByRoom(agents) {
  const groups = new Map();
  for (const agent of agents) groups.set(agent.room, [...(groups.get(agent.room) ?? []), agent]);
  const listed = [...groups].map(([room, members]) => ({ room, agents: [...members].sort(needsYouFirst) }));
  const isUrgent = (group) => group.agents.some((agent) => agent.status === NEEDS_YOU);
  return listed.sort((a, b) => Number(isUrgent(b)) - Number(isUrgent(a)) || a.room.localeCompare(b.room, "pt-BR"));
}

// Every word must appear in the agent's name, kind, room or current activity; an empty query lists everything.
export function searchHeadquarters({ query = "", agents = [], rooms = [], actions = [] }) {
  const words = wordsOf(query);
  return {
    agentGroups: groupByRoom(agents.filter((agent) => matchesAll(words, [agent.name, agent.label, agent.room, agent.doing]))),
    rooms: rooms.filter((room) => matchesAll(words, [room.name])),
    actions: actions.filter((action) => matchesAll(words, [action.label])),
  };
}
