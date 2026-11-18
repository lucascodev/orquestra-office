import { conversationMoment, socialCircles, workConversations } from "./conversations.js";

function centroidOf(points) {
  const sum = points.reduce((total, point) => ({ x: total.x + point.x, z: total.z + point.z }), { x: 0, z: 0 });
  return { x: sum.x / points.length, z: sum.z / points.length };
}

function candidatesOf({ people, agents, places, nowMs }, finished) {
  const still = people.filter((person) => person.isStill);
  const stillKeys = new Set(still.map((person) => person.key));
  const work = workConversations(agents, places, nowMs)
    .filter((talk) => !finished.has(talk.id) && talk.keys.every((key) => stillKeys.has(key)));
  const chatters = still
    .filter((person) => places.get(person.key)?.isFreeTime)
    .map((person) => ({ ...person, areaId: person.areaId ?? places.get(person.key).stop.areaId }));
  const chats = socialCircles(chatters).map((keys) => ({ id: `chat|${keys.join("+")}`, kind: "chat", keys }));
  return [...work, ...chats];
}

export function createConversationTracker() {
  let startedAt = new Map();
  const finished = new Set();

  return function follow(scene) {
    const { people, agents, seconds } = scene;
    const names = new Map(agents.map((agent) => [agent.key, agent.name ?? agent.label]));
    const positions = new Map(people.map((person) => [person.key, person]));
    const roles = new Map();
    const nextStartedAt = new Map();
    for (const talk of candidatesOf(scene, finished)) {
      if (talk.keys.some((key) => roles.has(key))) continue;
      const since = startedAt.get(talk.id) ?? seconds;
      const moment = conversationMoment(talk, names, seconds - since);
      if (moment.isOver) {
        finished.add(talk.id);
        continue;
      }
      nextStartedAt.set(talk.id, since);
      for (const key of talk.keys) {
        const isSpeaking = key === moment.speakerKey;
        const focus = centroidOf(talk.keys.filter((other) => other !== key).map((other) => positions.get(other)));
        roles.set(key, { isSpeaking, focus, speech: isSpeaking ? moment.text : null });
      }
    }
    startedAt = nextStartedAt;
    return roles;
  };
}
