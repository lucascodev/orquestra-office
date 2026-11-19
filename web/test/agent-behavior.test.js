import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { THEMES } from "../scripts/data/themes.js";
import { FREE_TIME, freeTimePreferences } from "../scripts/domain/behavior/agent-reactions.js";
import { temperamentOf } from "../scripts/domain/behavior/agent-temperament.js";
import { freshestThoughts, thoughtAt } from "../scripts/domain/behavior/agent-thoughts.js";
import { createFreeTimeClock } from "../scripts/domain/behavior/free-time-clock.js";
import { planMovement } from "../scripts/domain/behavior/movement-plan.js";
import { assignPlaces, placeAgents } from "../scripts/domain/behavior/room-places.js";
import { fidgetAt } from "../scripts/domain/behavior/seated-fidgets.js";
import { layoutHeadquarters } from "../scripts/domain/headquarters/headquarters-layout.js";
import { headquartersSpots } from "../scripts/domain/headquarters/headquarters-spots.js";
import { layoutRoom } from "../scripts/domain/room/room-layout.js";
import { exitStop } from "../scripts/domain/room/room-spots.js";

const NOW = 1_800_000_000_000;
const LONG_AGO = NOW - 60 * 60_000;
const KEY = "claude:s1";

function agentWith(status, extra = {}) {
  return { key: KEY, kind: "main", parentKey: null, status, activity: null, action: "", startedAt: LONG_AGO, updatedAt: LONG_AGO, endedAt: null, ...extra };
}

function placeOf(agent, { now = NOW, freeSince = new Map() } = {}) {
  const project = { key: "c:/demo", agents: { [agent.key]: agent }, team: [] };
  const layout = layoutRoom(project, THEMES[0]);
  return { place: assignPlaces([agent], now, layout, freeSince).get(agent.key), layout };
}

describe("where agents go", () => {
  for (const [status, activity] of [["working", "editing"], ["working", "terminal"], ["reviewing", "reading"], ["needs_you", "asking"], ["blocked", null]]) {
    it(`keeps a ${status}/${activity ?? "-"} agent seated at the desk and hurries them there`, () => {
      const { place } = placeOf(agentWith(status, { activity }));
      assert.equal(place.stop.isDesk, true);
      assert.equal(place.stop.isSeat, true);
      assert.equal(place.isUrgent, true);
    });
  }

  it("types at the desk on work of an unknown kind, even one named like a built-in of every object", () => {
    const reactions = ["compiling", "toString", "constructor", "__proto__"].map((activity) => placeOf(agentWith("working", { activity })).place.reaction);
    assert.deepEqual(reactions, ["typing", "typing", "typing", "typing"]);
  });

  it("leaves a waiting agent free to walk around the office", () => {
    const { place } = placeOf(agentWith("waiting"));
    assert.notEqual(place.stop.isDesk, true);
    assert.equal(place.isUrgent, false);
  });

  it("lets someone who just finished sit back at the desk before getting up", () => {
    const freeSince = new Map([[KEY, NOW - 1_000]]);
    const { place } = placeOf(agentWith("break", { updatedAt: NOW - 1_000 }), { freeSince });
    assert.equal(place.stop.isDesk, true);
    assert.equal(place.reaction, "unwinding");
  });

  it("sends someone out for a break once their personal wait is over", () => {
    const freeSince = new Map([[KEY, NOW - temperamentOf(KEY).lingerMs - 1_000]]);
    const { place } = placeOf(agentWith("break"), { freeSince });
    assert.notEqual(place.stop.isDesk, true);
    assert.equal(place.reaction, "coffee");
  });

  it("skips the wait when motion is reduced", () => {
    const freeSince = new Map([[KEY, NOW - 1_000]]);
    const { place } = placeOf(agentWith("break"), { now: null, freeSince });
    assert.equal(place.reaction, "coffee");
  });

  it("walks someone who left out the door without hurrying", () => {
    const { place, layout } = placeOf(agentWith("idle", { endedAt: NOW }));
    assert.deepEqual(place.stop, exitStop(layout));
    assert.equal(place.isUrgent, false);
  });
});

describe("where agents go in the headquarters", () => {
  const PROJECTS = 6;
  const PER_PROJECT = 5;
  const OUT_FOR_A_WHILE = NOW - 17_000;

  const hqAgent = (key, status, extra = {}) => agentWith(status, { key, updatedAt: OUT_FOR_A_WHILE, ...extra });
  const headquartersOf = (agents) => {
    const byProject = Map.groupBy(agents, (agent) => agent.key.split("-")[0]);
    const projects = Object.fromEntries([...byProject].sort(([a], [b]) => a.localeCompare(b)).map(([key, members], i) => [key, {
      key, name: key, template: "startup", createdAt: i, updatedAt: NOW, team: [], agents: Object.fromEntries(members.map((agent) => [agent.key, agent])),
    }]));
    return headquartersSpots(layoutHeadquarters(projects));
  };
  const placesIn = (agents, { previous = new Map(), now = NOW } = {}) => {
    const spots = headquartersOf(agents);
    const freeSince = new Map(agents.map((agent) => [agent.key, agent.updatedAt]));
    return { spots, places: placeAgents({ agents, now, spots, freeSince, previous }) };
  };
  const crowdOnBreak = () => Array.from({ length: PROJECTS * PER_PROJECT }, (_, i) => hqAgent(`claude:p${Math.floor(i / PER_PROJECT)}-a${i % PER_PROJECT}`, "break"));

  it("never gives the same spot to two of 30 agents from 6 projects who all want a coffee", () => {
    const { places } = placesIn(crowdOnBreak());
    const ids = [...places.values()].filter((place) => place.isFreeTime).map((place) => place.stop.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(ids.filter((id) => id.startsWith("pantry:coffee:")).length, 7);
    assert.equal(ids.length, 25);
    assert.equal([...places.values()].filter((place) => place.reaction === "stretching").length, 5);
  });

  it("lets someone keep the spot they are on, or walking to, when a colleague with a smaller key wants the same", () => {
    const agents = [hqAgent("claude:p0-a", "break"), hqAgent("claude:p1-b", "break")];
    const before = placesIn(agents).places;
    assert.equal(before.get("claude:p0-a").stop.id, "pantry:coffee:0");
    const previous = new Map([["claude:p1-b", before.get("claude:p0-a")]]);
    const { places } = placesIn(agents, { previous });
    assert.equal(places.get("claude:p1-b").stop.id, "pantry:coffee:0");
    assert.equal(places.get("claude:p0-a").stop.id, "pantry:coffee:1");
  });

  it("stays on the same spot rather than moving to an earlier free one of the same activity", () => {
    const agent = hqAgent("claude:p0-a", "break");
    const { spots } = placesIn([agent]);
    const fourth = spots.freeTime.get("coffee")[3];
    const previous = new Map([[agent.key, { stop: fourth, reaction: "coffee", isUrgent: false, isFreeTime: true }]]);
    assert.equal(placesIn([agent], { previous }).places.get(agent.key).stop.id, fourth.id);
  });

  it("keeps its spot in the next activity it likes when the first one is full, instead of an earlier spot there", () => {
    const keepers = Array.from({ length: 7 }, (_, i) => hqAgent(`claude:p1-k${i}`, "break"));
    const nextChoice = (agent, spots) => freeTimePreferences(agent, NOW, agent.updatedAt, spots.activities).find((id) => id !== "coffee");
    const hasRoom = (agent) => {
      const { spots } = placesIn([...keepers, agent]);
      return spots.freeTime.get(nextChoice(agent, spots)).length > 1;
    };
    const latecomer = Array.from({ length: 30 }, (_, i) => hqAgent(`claude:p0-t${i}`, "break")).find(hasRoom);
    const { spots } = placesIn([...keepers, latecomer]);
    const coffee = spots.freeTime.get("coffee");
    const lastOfNext = spots.freeTime.get(nextChoice(latecomer, spots)).at(-1);
    const previous = new Map([...keepers.map((keeper, i) => [keeper.key, { stop: coffee[i] }]), [latecomer.key, { stop: lastOfNext }]]);
    assert.equal(placesIn([...keepers, latecomer], { previous }).places.get(latecomer.key).stop.id, lastOfNext.id);
  });

  it("lets someone keep a spot of a later choice when the earlier ones are full, even against a newcomer with a smaller key", () => {
    const onSofa = ["claude:s0", "claude:s1", "claude:s2"].map((key) => hqAgent(key, "idle"));
    const keeper = hqAgent("claude:z1", "idle");
    const newcomer = hqAgent("claude:a0", "break");
    const agents = [...onSofa, keeper, newcomer];
    const { spots } = placesIn(agents);
    const on = (stop) => ({ stop, isFreeTime: true });
    const previous = new Map([...onSofa.map((agent, i) => [agent.key, on(spots.freeTime.get("sofa")[i])]), [keeper.key, on(spots.freeTime.get("coffee")[0])]]);
    const { places } = placesIn(agents, { previous });
    assert.deepEqual(onSofa.map((agent) => places.get(agent.key).stop.id), ["lounge:sofa:0", "lounge:sofa:1", "lounge:sofa:2"]);
    assert.equal(places.get(keeper.key).stop.id, "pantry:coffee:0");
    assert.equal(places.get(newcomer.key).stop.id, "pantry:coffee:1");
  });

  it("lets someone keep the only spot of an activity against a newcomer with a smaller key", () => {
    const spotOf = (activityId) => ({ id: `${activityId}:0`, activityId, x: 0, z: 0 });
    const sofa = spotOf("sofa");
    const coffee = spotOf("coffee");
    const onSofa = hqAgent("claude:k", "idle");
    const keeper = hqAgent("claude:z", "idle");
    const newcomer = hqAgent("claude:a", "break");
    const agents = [onSofa, keeper, newcomer];
    const spots = {
      activities: ["sofa", "coffee"],
      freeTime: new Map([["sofa", [sofa]], ["coffee", [coffee]]]),
      desks: new Map(agents.map((agent) => [agent.key, { isDesk: true, x: 0, z: 0 }])),
      exit: { x: 0, z: 0 },
    };
    const freeSince = new Map(agents.map((agent) => [agent.key, agent.updatedAt]));
    const previous = new Map([[onSofa.key, { stop: sofa, isFreeTime: true }], [keeper.key, { stop: coffee, isFreeTime: true }]]);
    const places = placeAgents({ agents, now: NOW, spots, freeSince, previous });
    assert.equal(places.get(onSofa.key).stop.id, sofa.id);
    assert.equal(places.get(keeper.key).stop.id, coffee.id);
    assert.equal(places.get(newcomer.key).stop.isDesk, true);
  });

  it("leaves the spot once the first choice is something else", () => {
    const agent = hqAgent("claude:p0-a", "idle");
    const { spots } = placesIn([agent]);
    const coffee = spots.freeTime.get("coffee")[0];
    const previous = new Map([[agent.key, { stop: coffee, reaction: "coffee", isUrgent: false, isFreeTime: true }]]);
    assert.equal(placesIn([agent], { previous }).places.get(agent.key).stop.activityId, "sofa");
  });

  it("seats a working agent at its own desk on its project's island and hurries it there", () => {
    const agents = [hqAgent("claude:p0-a", "working"), hqAgent("claude:p1-b", "needs_you")];
    const { spots, places } = placesIn(agents);
    for (const agent of agents) {
      assert.equal(places.get(agent.key).stop, spots.desks.get(agent.key));
      assert.equal(places.get(agent.key).isUrgent, true);
    }
  });

  it("brings a finished subagent's result to the side of the main agent's desk, on the same island", () => {
    const main = hqAgent("claude:p0-m", "working");
    const sub = hqAgent("claude:p0-m:s1", "break", { kind: "subagent", parentKey: main.key, endedAt: NOW - 1_000 });
    const { spots, places } = placesIn([main, sub]);
    const desk = spots.desks.get(main.key);
    const handoff = places.get(sub.key);
    assert.equal(handoff.reaction, "handingOver");
    assert.equal(handoff.stop.z, desk.z);
    assert.ok(Math.abs(handoff.stop.x - desk.x) < 1);
  });

  it("seats a working subagent whose main agent is gone at a desk of its project, so it can be walked there", () => {
    const orphan = hqAgent("claude:p0-gone:s1", "working", { kind: "subagent", parentKey: "claude:gone" });
    const { spots, places } = placesIn([hqAgent("claude:p0-here", "working"), orphan]);
    const place = places.get(orphan.key);
    assert.equal(place.stop, spots.desks.get(orphan.key));
    assert.equal(place.stop.isDesk, true);
    const person = { stop: null, position: null, isWalking: false, isHurrying: false, lastSeen: { x: 12, z: 7, wasAtDesk: false } };
    const room = { door: spots.arrival, hasVisited: true, routeFor: (from, to) => [{ x: to.x, z: to.z }] };
    assert.equal(planMovement({ person, place, room, isMotionReduced: false }).kind, "walk");
  });

  it("walks someone who left out through the main door", () => {
    const { spots, places } = placesIn([hqAgent("claude:p0-a", "idle", { endedAt: NOW })]);
    assert.equal(places.get("claude:p0-a").stop, spots.exit);
  });

  it("gives the same places on every device, whatever order the agents come in", () => {
    const crowd = crowdOnBreak();
    const placesOf = (agents) => [...placesIn(agents).places].map(([key, place]) => [key, place.stop.id ?? null, place.reaction]).sort();
    assert.deepEqual(placesOf([...crowd].reverse()), placesOf(crowd));
  });
});

describe("free time clock", () => {
  it("keeps counting while the status moves between free states and restarts after work", () => {
    const observe = createFreeTimeClock();
    observe([agentWith("break", { updatedAt: 100 })]);
    assert.equal(observe([agentWith("waiting", { updatedAt: 900 })]).get(KEY), 100);
    assert.equal(observe([agentWith("working", { updatedAt: 1_000 })]).has(KEY), false);
    assert.equal(observe([agentWith("break", { updatedAt: 2_000 })]).get(KEY), 2_000);
  });
});

describe("seated fidgets", () => {
  it("interrupts work for a short moment in each cycle and is the same on every frame", () => {
    const every = 12;
    const frames = Array.from({ length: every * 12 }, (_, i) => i / 12);
    const fidgeting = frames.filter((t) => fidgetAt(KEY, t, every));
    assert.ok(fidgeting.length > 0 && fidgeting.length < frames.length / 2);
    for (const t of fidgeting) {
      const fidget = fidgetAt(KEY, t, every);
      assert.ok(fidget.progress >= 0 && fidget.progress <= 1);
      assert.deepEqual(fidgetAt(KEY, t, every), fidget);
    }
  });
});

describe("thoughts", () => {
  const thought = (overrides) => thoughtAt({ agentKey: KEY, reactionId: "typing", subject: "people.js", sinceSeconds: 0, nowSeconds: 1, gapSeconds: 10, ...overrides });

  it("has a thought shortly after starting something and then stays quiet for a while", () => {
    assert.equal(thought({ nowSeconds: 0.2 }), null);
    assert.ok(thought({ nowSeconds: 1 }));
    assert.equal(thought({ nowSeconds: 8 }), null);
  });

  it("names the file or command the agent is dealing with and never leaves the slot empty", () => {
    const texts = Array.from({ length: 40 }, (_, cycle) => thought({ nowSeconds: 1 + cycle * 14.5 })?.text).filter(Boolean);
    assert.ok(texts.every((text) => !text.includes("{alvo}")));
    assert.ok(texts.some((text) => text.includes("people.js")));
    const withoutSubject = Array.from({ length: 40 }, (_, cycle) => thought({ subject: null, nowSeconds: 1 + cycle * 14.5 })?.text).filter(Boolean);
    assert.ok(withoutSubject.every((text) => !text.includes("{alvo}")));
  });

  it("has something to think about in every free time activity, the games room included", () => {
    const silent = FREE_TIME.filter((activity) => !thoughtAt({ agentKey: KEY, reactionId: activity.reaction, action: "", sinceSeconds: 0, nowSeconds: 1, gapSeconds: 10 }));
    assert.deepEqual(silent.map((activity) => activity.id), []);
  });

  it("shows only the freshest few at once", () => {
    const entries = [1, 5, 3, 9, 7].map((startedAt) => [`k${startedAt}`, { startedAt }]);
    assert.deepEqual([...freshestThoughts(entries)].sort(), ["k5", "k7", "k9"]);
  });
});
