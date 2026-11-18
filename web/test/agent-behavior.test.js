import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { THEMES } from "../scripts/data/themes.js";
import { temperamentOf } from "../scripts/domain/behavior/agent-temperament.js";
import { freshestThoughts, thoughtAt } from "../scripts/domain/behavior/agent-thoughts.js";
import { createFreeTimeClock } from "../scripts/domain/behavior/free-time-clock.js";
import { assignPlaces } from "../scripts/domain/behavior/room-places.js";
import { fidgetAt } from "../scripts/domain/behavior/seated-fidgets.js";
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
  const thought = (overrides) => thoughtAt({ agentKey: KEY, reactionId: "typing", action: "editando people.js", sinceSeconds: 0, nowSeconds: 1, gapSeconds: 10, ...overrides });

  it("has a thought shortly after starting something and then stays quiet for a while", () => {
    assert.equal(thought({ nowSeconds: 0.2 }), null);
    assert.ok(thought({ nowSeconds: 1 }));
    assert.equal(thought({ nowSeconds: 8 }), null);
  });

  it("names the file or command the agent is dealing with and never leaves the slot empty", () => {
    const texts = Array.from({ length: 40 }, (_, cycle) => thought({ nowSeconds: 1 + cycle * 14.5 })?.text).filter(Boolean);
    assert.ok(texts.every((text) => !text.includes("{alvo}")));
    const withoutSubject = Array.from({ length: 40 }, (_, cycle) => thought({ action: "procurando no código", nowSeconds: 1 + cycle * 14.5 })?.text).filter(Boolean);
    assert.ok(withoutSubject.every((text) => !text.includes("{alvo}")));
  });

  it("shows only the freshest few at once", () => {
    const entries = [1, 5, 3, 9, 7].map((startedAt) => [`k${startedAt}`, { startedAt }]);
    assert.deepEqual([...freshestThoughts(entries)].sort(), ["k5", "k7", "k9"]);
  });
});
