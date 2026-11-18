import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FREE_TIME, freeTimePreferences } from "../scripts/domain/behavior/agent-reactions.js";
import { areaOfPoint } from "../scripts/domain/headquarters/area-of-point.js";
import { layoutHeadquarters } from "../scripts/domain/headquarters/headquarters-layout.js";
import { headquartersSpots } from "../scripts/domain/headquarters/headquarters-spots.js";
import { STANDING_HIP } from "../scripts/domain/room/room-dimensions.js";

const NOW = 1_800_000_000_000;
const MINUTE = 60_000;
const DECIMALS = 1e6;

const round = (value) => Math.round(value * DECIMALS) / DECIMALS;
const agentOf = (key, extra = {}) => ({
  key, kind: "main", source: "claude", parentKey: null, label: "Claude Code", status: "working", activity: "editing",
  startedAt: NOW - 60 * MINUTE, updatedAt: NOW, endedAt: null, ...extra,
});
const projectOf = (key, agents, extra = {}) => ({
  key, name: key, template: "startup", createdAt: NOW, updatedAt: NOW, team: [], agents: Object.fromEntries(agents.map((agent) => [agent.key, agent])), ...extra,
});
const officeWith = (projectCount, agentsPerProject = 1) => Object.fromEntries(Array.from({ length: projectCount }, (_, p) => {
  const agents = Array.from({ length: agentsPerProject }, (__, a) => agentOf(`claude:p${p}-a${a}`, { startedAt: NOW - MINUTE + a }));
  return [`c:/p${p}`, projectOf(`c:/p${p}`, agents, { createdAt: NOW + p })];
}));

const spotsOf = (office) => {
  const layout = layoutHeadquarters(office);
  return { layout, spots: headquartersSpots(layout) };
};
const allFreeTime = (spots) => [...spots.freeTime.values()].flat();
const countsOf = (spots) => Object.fromEntries([...spots.freeTime].map(([activity, list]) => [activity, list.length]).sort(([a], [b]) => a.localeCompare(b)));
const placeOf = ({ x, z }) => [round(x), round(z)];

describe("headquarters free time spots", () => {
  it("offers the spots of the approved plan, with the water cooler and plants of the corner", () => {
    const { spots } = spotsOf(officeWith(4));
    assert.deepEqual(countsOf(spots), { arcade: 1, board: 1, coffee: 7, meeting: 6, pingpong: 2, plant: 4, puff: 1, sofa: 3, water: 1, window: 1 });
    assert.equal(allFreeTime(spots).length, 27);
  });

  it("moves the water to the reception and loses the corner plants when no island place is left over", () => {
    const { spots } = spotsOf(officeWith(6));
    assert.deepEqual(spots.freeTime.get("water").map((spot) => spot.areaId), ["reception"]);
    assert.equal(spots.freeTime.get("plant").length, 2);
    assert.equal(allFreeTime(spots).length, 25);
  });

  it("names every spot once, after its area and activity, and keeps the names between layouts", () => {
    const { spots } = spotsOf(officeWith(4));
    const ids = allFreeTime(spots).map((spot) => spot.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const spot of allFreeTime(spots)) assert.match(spot.id, new RegExp(`^${spot.areaId}:${spot.activityId}:\\d+$`));
    assert.deepEqual(spotsOf(officeWith(4)).spots.freeTime.get("coffee").map((spot) => spot.id), spots.freeTime.get("coffee").map((spot) => spot.id));
    assert.deepEqual(spots.freeTime.get("coffee").map((spot) => spot.id), [0, 1, 2, 3, 4, 5, 6].map((n) => `pantry:coffee:${n}`));
  });

  it("puts every spot inside the area it says it belongs to", () => {
    for (const projectCount of [4, 6]) {
      const { layout, spots } = spotsOf(officeWith(projectCount));
      for (const spot of allFreeTime(spots)) assert.equal(areaOfPoint(layout, spot), spot.areaId, spot.id);
    }
  });

  it("seats people on the meeting chairs, the sofa and the puff, and has them stand everywhere else", () => {
    const { spots } = spotsOf(officeWith(4));
    const seated = new Set(["meeting", "sofa", "puff"]);
    for (const spot of allFreeTime(spots)) {
      assert.equal(spot.isSeat, seated.has(spot.activityId), spot.id);
      assert.equal(spot.isDesk, false);
      assert.equal(spot.hipY < STANDING_HIP, seated.has(spot.activityId), spot.id);
    }
  });

  it("gives every spot a way in from a walkway", () => {
    const { spots } = spotsOf(officeWith(4));
    for (const spot of allFreeTime(spots)) {
      assert.equal(typeof spot.laneZ, "number", spot.id);
      assert.ok(Array.isArray(spot.approach), spot.id);
    }
  });
});

describe("headquarters desks, arrival and exit", () => {
  it("gives each seated agent the chair of its island, facing the desk", () => {
    const { layout, spots } = spotsOf(officeWith(2, 3));
    assert.equal(spots.desks.size, 6);
    const first = layout.islands[0];
    const [north, south] = ["claude:p0-a0", "claude:p0-a1"].map((key) => spots.desks.get(key));
    assert.deepEqual(placeOf(north), [round(first.x + 0.6), round(first.z - 0.4)]);
    assert.deepEqual(placeOf(south), [round(first.x + 0.6), round(first.z + 1.9)]);
    assert.equal(north.facing, 0);
    assert.equal(south.facing, Math.PI);
    assert.ok(north.isDesk && north.isSeat);
  });

  it("does not give a desk to a role nobody is playing", () => {
    const office = { "c:/roles": projectOf("c:/roles", [agentOf("claude:only")], { team: ["code-reviewer"] }) };
    assert.deepEqual([...spotsOf(office).spots.desks.keys()], ["claude:only"]);
  });

  it("brings newcomers in from the path in the yard and lets people out through the main door", () => {
    for (const projectCount of [4, 7]) {
      const { layout, spots } = spotsOf(officeWith(projectCount));
      const { D } = layout.size;
      assert.deepEqual(placeOf(spots.arrival), [22.7, round(D + 3)]);
      assert.deepEqual(placeOf(spots.exit), [22.75, round(D + 0.6)]);
      assert.equal(areaOfPoint(layout, spots.arrival), "yard");
      assert.equal(spots.exit.isSeat, false);
    }
  });
});

describe("headquarters receptionist", () => {
  it("stands behind the reception counter, facing the main door, wherever the facade is", () => {
    for (const projectCount of [4, 9]) {
      const { spots } = spotsOf(officeWith(projectCount));
      assert.deepEqual(placeOf(spots.receptionist), [22.8, 11.1]);
      assert.equal(spots.receptionist.facing, 0);
      assert.equal(spots.receptionist.isSeat, false);
      assert.equal(spots.receptionist.hipY, STANDING_HIP);
    }
  });
});

describe("free time activities", () => {
  it("knows the new activities of the games room and how people react to them", () => {
    const reactions = Object.fromEntries(FREE_TIME.map((activity) => [activity.id, activity.reaction]));
    assert.deepEqual([reactions.pingpong, reactions.arcade, reactions.puff], ["playing", "gaming", "resting"]);
  });

  it("offers in the headquarters only activities it has spots for, every one of them known", () => {
    const { spots } = spotsOf(officeWith(4));
    const known = new Set(FREE_TIME.map((activity) => activity.id));
    assert.ok(spots.activities.every((id) => known.has(id)));
    assert.deepEqual([...spots.activities].sort(), [...spots.freeTime.keys()].sort());
  });

  it("orders each agent's activities only among the ones the catalog offers", () => {
    const agent = agentOf("claude:x", { status: "idle" });
    const offered = ["sofa", "coffee", "pingpong"];
    const order = freeTimePreferences(agent, null, NOW, offered);
    assert.deepEqual([...new Set(order)].sort(), [...offered].sort());
  });
});

describe("area of a point", () => {
  const layout = layoutHeadquarters(officeWith(4));

  it("tells the room, the corridor, the work area, the reception and the yard apart", () => {
    const samples = [[3, 3, "meeting"], [10, 2, "pantry"], [17, 4, "games"], [23, 2, "lounge"], [12, 7, "corridor"], [2, 10, "work"], [23, 12, "reception"], [22, 21, "yard"], [-1, 5, "yard"]];
    assert.deepEqual(samples.map(([x, z]) => areaOfPoint(layout, { x, z })), samples.map(([, , area]) => area));
  });
});
