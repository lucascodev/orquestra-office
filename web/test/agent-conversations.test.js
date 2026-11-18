import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { THEMES } from "../scripts/data/themes.js";
import { assignPlaces } from "../scripts/domain/behavior/room-places.js";
import { createConversationTracker } from "../scripts/domain/conversations/conversation-tracker.js";
import { conversationMoment, socialCircles, workConversations } from "../scripts/domain/conversations/conversations.js";
import { layoutRoom } from "../scripts/domain/room/room-layout.js";

const NOW = 1_800_000_000_000;
const MAIN = "claude:m1";
const SUB = "claude:m1:s1";

function agentOf(key, status, extra = {}) {
  return { key, kind: "main", parentKey: null, status, activity: "editing", action: "", startedAt: NOW - 3_600_000, updatedAt: NOW - 3_600_000, endedAt: null, ...extra };
}

const mainAgent = (status = "working") => agentOf(MAIN, status, { name: "Ana" });
const subAgent = (extra = {}) => agentOf(SUB, "working", { kind: "subagent", parentKey: MAIN, name: "Bia", ...extra });

function placesFor(agents, now = NOW) {
  const project = { key: "c:/demo", agents: Object.fromEntries(agents.map((agent) => [agent.key, agent])), team: [] };
  return assignPlaces(agents, now, layoutRoom(project, THEMES[0]), new Map());
}

describe("finished subagent", () => {
  it("walks to the main agent's desk with the result and stands beside the chair", () => {
    const agents = [mainAgent(), subAgent({ status: "break", endedAt: NOW - 1_000 })];
    const places = placesFor(agents);
    const main = places.get(MAIN).stop;
    const handoff = places.get(SUB);
    assert.equal(handoff.reaction, "handingOver");
    assert.equal(handoff.stop.isSeat, false);
    assert.equal(handoff.stop.z, main.z);
    assert.ok(Math.abs(handoff.stop.x - main.x) < 1);
  });

  it("goes straight home once the handoff is long past", () => {
    const places = placesFor([mainAgent(), subAgent({ status: "break", endedAt: NOW - 60_000 })]);
    assert.equal(places.get(SUB).reaction, "leaving");
  });

  it("goes straight home when the main agent is away from the desk", () => {
    const places = placesFor([mainAgent("idle"), subAgent({ status: "break", endedAt: NOW - 1_000 })]);
    assert.equal(places.get(SUB).reaction, "leaving");
  });
});

describe("work conversations", () => {
  it("has the main agent brief a subagent that just sat down, both still at their desks", () => {
    const agents = [mainAgent(), subAgent({ startedAt: NOW - 2_000 })];
    const places = placesFor(agents);
    const [talk] = workConversations(agents, places, NOW);
    assert.deepEqual(talk, { id: `delegation|${SUB}`, kind: "delegation", keys: [MAIN, SUB] });
    assert.equal(places.get(MAIN).stop.isDesk, true);
    assert.equal(places.get(SUB).stop.isDesk, true);
  });

  it("does not brief a subagent that has been working for a while", () => {
    const agents = [mainAgent(), subAgent()];
    assert.deepEqual(workConversations(agents, placesFor(agents), NOW), []);
  });

  it("has the subagent speak first when handing the result over", () => {
    const agents = [mainAgent(), subAgent({ status: "break", endedAt: NOW - 1_000 })];
    const [talk] = workConversations(agents, placesFor(agents), NOW);
    assert.equal(talk.kind, "handoff");
    assert.deepEqual(talk.keys, [SUB, MAIN]);
    const moment = conversationMoment(talk, new Map([[MAIN, "Ana"], [SUB, "Bia"]]), 0.5);
    assert.equal(moment.speakerKey, SUB);
  });
});

describe("conversation turns", () => {
  const names = new Map([[MAIN, "Ana"], [SUB, "Bia"]]);
  const briefing = { id: `delegation|${SUB}`, kind: "delegation", keys: [MAIN, SUB] };

  it("alternates speakers, names the other person and ends a work talk", () => {
    const first = conversationMoment(briefing, names, 0.5);
    const second = conversationMoment(briefing, names, 3.8);
    assert.equal(first.speakerKey, MAIN);
    assert.equal(second.speakerKey, SUB);
    assert.ok(!first.text.includes("{outro}"));
    assert.ok(first.text.includes("Bia") || !first.text.includes("Ana"));
    assert.equal(conversationMoment(briefing, names, 60).isOver, true);
  });

  it("keeps a chat going with new topics", () => {
    const chat = { id: "chat|a+b", kind: "chat", keys: ["a", "b"] };
    const later = Array.from({ length: 30 }, (_, i) => conversationMoment(chat, new Map(), i * 7));
    assert.ok(later.every((moment) => !moment.isOver));
    assert.ok(later.some((moment) => moment.speakerKey === "a") && later.some((moment) => moment.speakerKey === "b"));
  });
});

describe("social circles", () => {
  it("groups people close to each other and leaves loners out", () => {
    const circles = socialCircles([{ key: "a", x: 0, z: 0 }, { key: "b", x: 0.5, z: 0 }, { key: "c", x: 2.3, z: 0 }, { key: "d", x: 9, z: 9 }]);
    assert.deepEqual(circles, [["a", "b", "c"]]);
  });
});

describe("conversation tracker", () => {
  it("puts each person in one conversation at a time, facing the others", () => {
    const agents = [mainAgent(), subAgent({ startedAt: NOW - 2_000 })];
    const places = placesFor(agents);
    const people = agents.map((agent) => ({ key: agent.key, x: places.get(agent.key).stop.x, z: places.get(agent.key).stop.z, isStill: true }));
    const roles = createConversationTracker()({ people, agents, places, nowMs: NOW, seconds: 100 });
    assert.equal(roles.get(MAIN).isSpeaking, true);
    assert.ok(roles.get(MAIN).speech.length > 0);
    assert.deepEqual(roles.get(MAIN).focus, { x: people[1].x, z: people[1].z });
    assert.equal(roles.get(SUB).isSpeaking, false);
  });

  it("does not start talking until both are in place", () => {
    const agents = [mainAgent(), subAgent({ startedAt: NOW - 2_000 })];
    const places = placesFor(agents);
    const people = agents.map((agent) => ({ key: agent.key, x: 0, z: 0, isStill: agent.key === MAIN }));
    assert.equal(createConversationTracker()({ people, agents, places, nowMs: NOW, seconds: 100 }).size, 0);
  });
});
