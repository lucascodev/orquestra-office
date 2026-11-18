import { CONVERSATIONS } from "../data/conversations.js";
import { HANDING_OVER } from "../domain/behavior/agent-reactions.js";
import { hashOf } from "../domain/shared/seeded-random.js";

const CHAT_DISTANCE = 2;
const DELEGATION_WINDOW_MS = 25_000;
const LINE_SECONDS = 2.8;
const PAUSE_BETWEEN_LINES_SECONDS = 0.5;
const PAUSE_BETWEEN_TOPICS_SECONDS = 5;
const ADDRESSEE_SLOT = "{outro}";
const ONE_SHOT_KINDS = new Set(["delegation", "handoff"]);

const LINE_SLOT_SECONDS = LINE_SECONDS + PAUSE_BETWEEN_LINES_SECONDS;

function rootOf(parents, key) {
  let root = key;
  while (parents.get(root) !== root) root = parents.get(root);
  return root;
}

export function socialCircles(people) {
  const parents = new Map(people.map(({ key }) => [key, key]));
  people.forEach((a, i) => people.slice(i + 1).forEach((b) => {
    if (Math.hypot(a.x - b.x, a.z - b.z) <= CHAT_DISTANCE) parents.set(rootOf(parents, a.key), rootOf(parents, b.key));
  }));
  const circles = new Map();
  for (const { key } of people) {
    const root = rootOf(parents, key);
    circles.set(root, [...(circles.get(root) ?? []), key]);
  }
  return [...circles.values()].filter((keys) => keys.length > 1).map((keys) => [...keys].sort());
}

export function workConversations(agents, places, now) {
  const present = new Set(agents.map((agent) => agent.key));
  const isAtDesk = (key) => places.get(key)?.stop?.isDesk === true;
  const talks = [];
  for (const agent of agents) {
    if (agent.kind !== "subagent" || !present.has(agent.parentKey)) continue;
    const isNew = !agent.endedAt && now - agent.startedAt < DELEGATION_WINDOW_MS;
    if (isNew && isAtDesk(agent.key) && isAtDesk(agent.parentKey)) {
      talks.push({ id: `delegation|${agent.key}`, kind: "delegation", keys: [agent.parentKey, agent.key] });
    }
    if (places.get(agent.key)?.reaction === HANDING_OVER) {
      talks.push({ id: `handoff|${agent.key}`, kind: "handoff", keys: [agent.key, agent.parentKey] });
    }
  }
  return talks;
}

function topicAt(conversation, topic) {
  const scripts = CONVERSATIONS[conversation.kind];
  const seed = hashOf(`${conversation.id}|${topic}`);
  const isOneShot = ONE_SHOT_KINDS.has(conversation.kind);
  return { lines: scripts[seed % scripts.length], firstSpeaker: isOneShot ? 0 : seed % conversation.keys.length };
}

export function conversationMoment(conversation, names, elapsedSeconds) {
  const { kind, keys } = conversation;
  const isOneShot = ONE_SHOT_KINDS.has(kind);
  let topicStart = 0;
  for (let topic = 0; ; topic += 1) {
    const { lines, firstSpeaker } = topicAt(conversation, topic);
    const topicSeconds = lines.length * LINE_SLOT_SECONDS;
    const into = elapsedSeconds - topicStart;
    if (into < topicSeconds) {
      const line = Math.floor(into / LINE_SLOT_SECONDS);
      if (into - line * LINE_SLOT_SECONDS > LINE_SECONDS) return { speakerKey: null, text: null, isOver: false };
      const speaker = (firstSpeaker + line) % keys.length;
      const addressee = keys[(speaker + 1) % keys.length];
      return { speakerKey: keys[speaker], text: lines[line].replace(ADDRESSEE_SLOT, names.get(addressee) ?? ""), isOver: false };
    }
    if (isOneShot) return { speakerKey: null, text: null, isOver: true };
    topicStart += topicSeconds + PAUSE_BETWEEN_TOPICS_SECONDS;
    if (into < topicSeconds + PAUSE_BETWEEN_TOPICS_SECONDS) return { speakerKey: null, text: null, isOver: false };
  }
}
