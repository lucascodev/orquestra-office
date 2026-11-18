import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { THEMES } from "../scripts/data/themes.js";
import { freeTimePreferences } from "../scripts/domain/behavior/agent-reactions.js";
import { assignPlaces } from "../scripts/domain/behavior/room-places.js";
import { layoutRoom } from "../scripts/domain/room/room-layout.js";
import { nearestLaneZ, routeBetween, routeWithin } from "../scripts/domain/room/room-routes.js";
import { exitStop, roomSpots, seatStop } from "../scripts/domain/room/room-spots.js";
import { planWall } from "../scripts/domain/room/wall-plan.js";

const ROOM_FIXTURES = fileURLToPath(new URL("./fixtures/rooms/", import.meta.url));
const NOW = 1_800_000_000_000;
const MINUTE = 60_000;
const MIN_ROOM = { W: 12, D: 7 };
const CROWD_SIZE = 40;
const MORE_PEOPLE_THAN_SPOTS = 60;
const RECORDED_DECIMALS = 1e6;

const agentOf = (key, extra = {}) => ({
  key, kind: "main", source: "claude", parentKey: null, label: "Claude Code", status: "working", activity: "editing",
  startedAt: NOW - 60 * MINUTE, updatedAt: NOW, endedAt: null, ...extra,
});
const subagentOf = (parentKey, id, label, extra = {}) => agentOf(`${parentKey}:${id}`, { kind: "subagent", parentKey, label, ...extra });
const projectOf = (agents, team = []) => ({ key: "c:/demo", name: "demo", team, agents: Object.fromEntries(agents.map((agent) => [agent.key, agent])) });
const emptyProject = () => projectOf([]);

const ROLES = ["code-reviewer", "security-engineer", "test-engineer", "tech-writer"];

function busyProject() {
  return projectOf([
    agentOf("claude:a1", { startedAt: NOW - 60 * MINUTE }),
    subagentOf("claude:a1", "s1", "code-reviewer", { startedAt: NOW - 30 * MINUTE }),
    subagentOf("claude:a1", "s2", "security-engineer", { startedAt: NOW - 20 * MINUTE }),
    agentOf("codex:b1", { source: "codex", label: "Codex", startedAt: NOW - 50 * MINUTE }),
    agentOf("claude:c1", { label: "Claude Code 2", startedAt: NOW - 40 * MINUTE, endedAt: NOW - MINUTE }),
    subagentOf("claude:c1", "s3", "test-engineer", { startedAt: NOW - 35 * MINUTE, endedAt: NOW - 2 * MINUTE }),
    agentOf("claude:d1", { label: "Claude Code 3", startedAt: NOW - 10 * MINUTE }),
  ], ROLES);
}

const seatsOf = (layout) => layout.pods.flatMap((pod) => pod.seats);
const podOfAgent = (layout, key) => layout.pods.find((pod) => pod.seats.some((seat) => seat.agent?.key === key));
const occupantsOf = (pod) => pod.seats.map((seat) => seat.agent?.key ?? seat.role).filter(Boolean);
const isVacant = (pod) => pod.seats.every((seat) => !seat.agent && !seat.role);
const commonsStartOf = (layout) => layout.zones.partitions[0].x;

const rounded = (value) => (typeof value === "number" ? Math.round(value * RECORDED_DECIMALS) / RECORDED_DECIMALS : value);
const recordable = (layout) => JSON.parse(JSON.stringify(layout, (key, value) => (key === "agent" ? value?.key ?? null : rounded(value))));
const recordedLayout = (theme) => JSON.parse(readFileSync(join(ROOM_FIXTURES, `${theme.id}.json`), "utf8"));

describe("back wall plan", () => {
  it("hangs the items in the theme's order, one after the other", () => {
    assert.deepEqual(planWall(["clock", "window"], { start: 0, end: 10 }), [
      { name: "clock", x: 0, width: 1 }, { name: "window", x: 1.35, width: 1.4 },
    ]);
  });

  it("skips an item that does not fit and lets a narrower one further down take the space", () => {
    assert.deepEqual(planWall(["clock", "shelf", "cooler"], { start: 0, end: 2.2 }), [
      { name: "clock", x: 0, width: 1 }, { name: "cooler", x: 1.35, width: 0.6 },
    ]);
  });

  it("fits an item that ends exactly at the end of the wall and nothing wider", () => {
    assert.deepEqual(planWall(["window"], { start: 1, end: 2.4 }), [{ name: "window", x: 1, width: 1.4 }]);
    assert.deepEqual(planWall(["window"], { start: 1, end: 2.39 }), []);
  });

  it("gives an item it does not know a default width", () => {
    assert.deepEqual(planWall(["mystery"], { start: 0, end: 5 }), [{ name: "mystery", x: 0, width: 1.6 }]);
  });
});

describe("desk layout", () => {
  it("seats a main agent with its subagents and packs small teams on the same desk island", () => {
    const layout = layoutRoom(busyProject(), THEMES[0]);
    assert.deepEqual(occupantsOf(podOfAgent(layout, "claude:a1")), ["claude:a1", "claude:a1:s1", "claude:a1:s2", "codex:b1", "claude:c1", "claude:c1:s3"]);
  });

  it("starts a new desk island when the next team does not fit in the current one", () => {
    const teamOf = (main, size, startedAt) => [agentOf(main, { startedAt }), ...Array.from({ length: size - 1 }, (_, i) => subagentOf(main, `s${i}`, "helper", { startedAt }))];
    const layout = layoutRoom(projectOf([...teamOf("claude:a", 4, NOW - 2 * MINUTE), ...teamOf("claude:b", 4, NOW - MINUTE)]), THEMES[0]);
    assert.notEqual(podOfAgent(layout, "claude:a"), podOfAgent(layout, "claude:b"));
    assert.equal(occupantsOf(podOfAgent(layout, "claude:b"))[0], "claude:b");
  });

  it("grows past the minimum size to fit a crowded office, keeping every desk out of the commons", () => {
    const crowd = Array.from({ length: CROWD_SIZE }, (_, i) => agentOf(`claude:m${i}`, { startedAt: NOW - i * MINUTE }));
    const layout = layoutRoom(projectOf(crowd), THEMES[0]);
    assert.ok(layout.W > MIN_ROOM.W && layout.D > MIN_ROOM.D, `${layout.W} x ${layout.D}`);
    assert.equal(seatsOf(layout).filter((seat) => seat.agent).length, CROWD_SIZE);
    assert.ok(layout.pods.every((pod) => pod.desk.x + pod.desk.w <= commonsStartOf(layout)));
  });
});

for (const theme of THEMES) {
  describe(`room in the ${theme.id} theme`, () => {
    it("keeps the minimum size and one empty desk island for an empty room", () => {
      const layout = layoutRoom(emptyProject(), theme);
      assert.deepEqual({ W: layout.W, D: layout.D }, MIN_ROOM);
      assert.ok(layout.pods.length > 0 && layout.pods.every(isVacant));
    });

    it("keeps a named empty desk for every project role nobody present is playing", () => {
      const reserved = seatsOf(layoutRoom(busyProject(), theme)).filter((seat) => seat.role);
      assert.deepEqual(reserved.map((seat) => [seat.role, seat.agent]), [["test-engineer", null], ["tech-writer", null]]);
    });

    it("fills the rest of each row with empty desks up to the commons", () => {
      const layout = layoutRoom(busyProject(), theme);
      const rows = Map.groupBy(layout.pods, (pod) => pod.desk.z);
      const vacancyByRow = [...rows.values()].map((pods) => pods.toSorted((a, b) => a.desk.x - b.desk.x).map(isVacant));
      assert.ok(vacancyByRow.flat().includes(true));
      assert.ok(vacancyByRow.every((row) => row.every((isEmpty, i) => !row[i - 1] || isEmpty)));
      assert.ok(layout.pods.every((pod) => pod.desk.x + pod.desk.w <= commonsStartOf(layout)));
    });

    it("lays the room out exactly as recorded before the reorganization", () => {
      assert.deepEqual(recordable(layoutRoom(busyProject(), theme)), recordedLayout(theme));
    });
  });
}

const FREE_TIME_SPOTS_BY_THEME = {
  startup: { board: 1, coffee: 3, filing: 1, meeting: 2, plant: 2, sofa: 2, water: 1, window: 1 },
  cafe: { board: 1, books: 1, coffee: 3, meeting: 2, plant: 2, sofa: 2, window: 1 },
  biblioteca: { board: 1, books: 1, coffee: 3, meeting: 2, sofa: 2, window: 1 },
  garagem: { board: 1, filing: 1, meeting: 2, sofa: 2 },
  estacao: { board: 1, filing: 1, meeting: 2, plant: 2, sofa: 2 },
  jardim: { board: 1, meeting: 2, plant: 1, sofa: 2, water: 1 },
  fliperama: { board: 1, coffee: 3, meeting: 2, plant: 2, sofa: 2 },
};

function freeTimeSpotsOffered(theme) {
  const idle = Array.from({ length: MORE_PEOPLE_THAN_SPOTS }, (_, i) => agentOf(`claude:f${i}`, { status: "idle", activity: null }));
  const places = [...assignPlaces(idle, null, layoutRoom(emptyProject(), theme), new Map()).values()].filter((place) => place.isFreeTime);
  const counts = {};
  for (const place of places) {
    const activity = place.stop.activityId;
    counts[activity] = (counts[activity] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

describe("free time spots", () => {
  for (const theme of THEMES) {
    it(`offers the ${theme.id} room the free time spots its furniture allows`, () => {
      assert.deepEqual(freeTimeSpotsOffered(theme), FREE_TIME_SPOTS_BY_THEME[theme.id]);
    });
  }
});

const ORDER_BEFORE_THE_HEADQUARTERS = {
  "claude:a1": ["coffee", "coffee", "board", "sofa", "plant", "window", "water", "books", "copier", "meeting", "filing"],
  "codex:b1": ["coffee", "sofa", "meeting", "water", "plant", "window", "coffee", "copier", "filing", "board", "books"],
  "claude:a1:s2": ["coffee", "filing", "books", "copier", "water", "plant", "meeting", "sofa", "board", "window", "coffee"],
};

describe("free time order in the room", () => {
  it("gives each agent the same personal order of activities as before the headquarters existed", () => {
    const { activities } = roomSpots(layoutRoom(emptyProject(), THEMES[0]));
    for (const [key, order] of Object.entries(ORDER_BEFORE_THE_HEADQUARTERS)) {
      assert.deepEqual(freeTimePreferences(agentOf(key, { status: "break" }), null, 0, activities), order, key);
    }
  });
});

describe("routes", () => {
  const lanes = { left: 1, right: 9 };

  it("walks along the lane, down the nearer side corridor and up to the spot", () => {
    assert.deepEqual(routeBetween({ x: 2, z: 1.5, laneZ: 1 }, { x: 3, z: 5.5, laneZ: 5 }, lanes), [
      { x: 2, z: 1 }, { x: 1, z: 1 }, { x: 1, z: 5 }, { x: 3, z: 5 }, { x: 3, z: 5.5 },
    ]);
    assert.deepEqual(routeBetween({ x: 7, z: 1.5, laneZ: 1 }, { x: 8, z: 5.5, laneZ: 5 }, lanes), [
      { x: 7, z: 1 }, { x: 9, z: 1 }, { x: 9, z: 5 }, { x: 8, z: 5 }, { x: 8, z: 5.5 },
    ]);
  });

  it("takes the corridor a spot asks for even when the other one is shorter", () => {
    assert.deepEqual(routeBetween({ x: 2, z: 1.5, laneZ: 1 }, { x: 3, z: 5.5, laneZ: 5, spine: "right" }, lanes), [
      { x: 2, z: 1 }, { x: 9, z: 1 }, { x: 9, z: 5 }, { x: 3, z: 5 }, { x: 3, z: 5.5 },
    ]);
  });

  it("stays on the lane when both spots share it", () => {
    assert.deepEqual(routeBetween({ x: 2, z: 1.5, laneZ: 1 }, { x: 5, z: 1.5, laneZ: 1 }, lanes), [{ x: 2, z: 1 }, { x: 5, z: 1 }, { x: 5, z: 1.5 }]);
  });

  it("never repeats a point, not even the one the walker stands on", () => {
    assert.deepEqual(routeBetween({ x: 1, z: 1, laneZ: 1 }, { x: 1, z: 5, laneZ: 5 }, lanes), [{ x: 1, z: 5 }]);
    assert.deepEqual(routeBetween({ x: 2, z: 1, laneZ: 1 }, { x: 2, z: 1, laneZ: 1 }, lanes), []);
  });

  it("goes in and out of a walled spot through its own way in", () => {
    const meetingChair = { x: 6, z: 2, laneZ: 4, laneX: 5, approach: [{ x: 5, z: 3 }, { x: 6, z: 3 }] };
    const desk = { x: 2, z: 4.5, laneZ: 4 };
    assert.deepEqual(routeBetween(desk, meetingChair, lanes), [{ x: 2, z: 4 }, { x: 5, z: 4 }, { x: 5, z: 3 }, { x: 6, z: 3 }, { x: 6, z: 2 }]);
    assert.deepEqual(routeBetween(meetingChair, desk, lanes), [{ x: 6, z: 3 }, { x: 5, z: 3 }, { x: 5, z: 4 }, { x: 2, z: 4 }, { x: 2, z: 4.5 }]);
  });

  it("takes everyone from their desk to the door and back without repeating a point", () => {
    const layout = layoutRoom(busyProject(), THEMES[0]);
    const door = exitStop(layout);
    const desks = layout.pods.flatMap((pod) => pod.seats.map((seat) => seatStop(pod, seat)));
    const isRepeat = (path) => path.some((point, i) => i > 0 && point.x === path[i - 1].x && point.z === path[i - 1].z);
    for (const desk of desks) {
      for (const [from, to] of [[desk, door], [door, desk]]) {
        const path = routeBetween(from, to, layout.zones.lanes);
        assert.equal(isRepeat(path), false);
        assert.deepEqual(path.at(-1), { x: to.x, z: to.z });
      }
    }
  });

  it("brings a loose point into the nearest lane before walking", () => {
    const route = routeWithin({ ...lanes, laneZs: [1, 4, 8] });
    assert.deepEqual(route({ x: 2, z: 3.4 }, { x: 3, z: 7.5, laneZ: 8 }), [
      { x: 2, z: 4 }, { x: 1, z: 4 }, { x: 1, z: 8 }, { x: 3, z: 8 }, { x: 3, z: 7.5 },
    ]);
  });

  it("walks from a stop on its own lane exactly as a route between stops does", () => {
    const routeLanes = { ...lanes, laneZs: [1, 4, 8] };
    const meetingChair = { x: 6, z: 2, laneZ: 4, laneX: 5, spine: "right", approach: [{ x: 5, z: 3 }, { x: 6, z: 3 }] };
    const desk = { x: 2, z: 7.5, laneZ: 8 };
    assert.deepEqual(routeWithin(routeLanes)(meetingChair, desk), routeBetween(meetingChair, desk, routeLanes));
  });

  it("snaps to the nearest lane, keeping the first one on a tie", () => {
    const laneZs = [1, 4, 8];
    assert.deepEqual([3, 2.5, 20, -3].map((z) => nearestLaneZ(z, laneZs)), [4, 1, 8, 1]);
  });
});
