import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NEUTRAL_ISLAND_THEME } from "../scripts/data/headquarters-palette.js";
import { THEMES } from "../scripts/data/themes.js";
import { layoutHeadquarters } from "../scripts/domain/headquarters/headquarters-layout.js";

const NOW = 1_800_000_000_000;
const MINUTE = 60_000;
const DECIMALS = 1e6;
const SEAT_COUNT = 6;

const round = (value) => Math.round(value * DECIMALS) / DECIMALS;
const agentOf = (key, extra = {}) => ({
  key, kind: "main", source: "claude", parentKey: null, label: "Claude Code", status: "working", activity: "editing",
  startedAt: NOW - 60 * MINUTE, updatedAt: NOW, endedAt: null, ...extra,
});
const subagentOf = (parentKey, id, extra = {}) => agentOf(`${parentKey}:${id}`, { kind: "subagent", parentKey, label: `helper-${id}`, ...extra });
const teamOf = (main, size, startedAt) => [agentOf(main, { startedAt }), ...Array.from({ length: size - 1 }, (_, i) => subagentOf(main, `s${i}`, { startedAt: startedAt + i + 1 }))];
const projectOf = (key, agents, extra = {}) => ({
  key, name: key.split("/").at(-1), template: "startup", createdAt: NOW, updatedAt: NOW, team: [],
  agents: Object.fromEntries(agents.map((agent) => [agent.key, agent])), ...extra,
});
const officeOf = (projects) => Object.fromEntries(projects.map((project) => [project.key, project]));
const projectsWithOneAgent = (count) => Array.from({ length: count }, (_, i) => projectOf(`c:/p${String(i).padStart(2, "0")}`, [agentOf(`claude:p${i}`)], { createdAt: NOW + i }));

const fourApproved = () => officeOf([
  projectOf("c:/orquestra-office", teamOf("claude:heitor", 4, NOW - 50 * MINUTE), { createdAt: NOW - 4 * MINUTE }),
  projectOf("c:/loja-online", teamOf("claude:vitor", 2, NOW - 40 * MINUTE), { template: "cafe", createdAt: NOW - 3 * MINUTE }),
  projectOf("c:/jogo-de-plataforma", teamOf("claude:teo", 3, NOW - 30 * MINUTE), { template: "fliperama", createdAt: NOW - 2 * MINUTE }),
  projectOf("c:/site-institucional", teamOf("claude:malu", 1, NOW - 20 * MINUTE), { template: "jardim", createdAt: NOW - MINUTE }),
]);

const placeOf = ({ x, z }) => [round(x), round(z)];
const rectOf = ({ x, z, w, d }) => [round(x), round(z), round(w), round(d)];
const byId = (items, id) => items.find((item) => item.id === id);
const occupantsOf = (island) => island.seats.map((seat) => seat.agent?.key ?? seat.role ?? null);
const islandsOf = (layout, projectKey) => layout.islands.filter((island) => island.projectKey === projectKey);

describe("headquarters plan with the four approved projects", () => {
  const layout = layoutHeadquarters(fourApproved());

  it("is 26 wide and 18 deep with two rows of islands, and the map reaches into the yard", () => {
    assert.deepEqual(layout.size, { W: 26, D: 18 });
    assert.equal(layout.rows, 2);
    assert.deepEqual(layout.bounds, { minX: -2, maxX: 28, minZ: -2, maxZ: 27 });
  });

  it("splits the floor into the back rooms, the corridor, the work area and the reception", () => {
    const areas = Object.fromEntries(layout.areas.map((area) => [area.id, rectOf(area)]));
    assert.deepEqual(areas, {
      meeting: [0, 0, 7, 6], pantry: [7, 0, 7, 6], games: [14, 0, 6, 6], lounge: [20, 0, 6, 6],
      corridor: [0, 6, 26, 2], work: [0, 8, 20, 10], reception: [20, 8, 6, 10],
    });
  });

  it("puts the islands on a grid of four columns, the occupied ones first in order of creation", () => {
    assert.deepEqual(layout.islands.map(placeOf), [[1, 9.8], [6, 9.8], [11, 9.8], [16, 9.8], [1, 14.4], [6, 14.4]]);
    assert.deepEqual(layout.islands.map((island) => island.projectKey), [
      "c:/orquestra-office", "c:/loja-online", "c:/jogo-de-plataforma", "c:/site-institucional", null, null,
    ]);
  });

  it("builds every island 3.6 by 1.5 with three seats on each side, 1.2 apart", () => {
    for (const island of layout.islands) {
      assert.deepEqual(rectOf(island.desk), [island.x, island.z, 3.6, 1.5].map(round));
      assert.equal(island.seats.length, SEAT_COUNT);
      assert.deepEqual(island.seats.map((seat) => round(seat.cx - island.x)), [0.6, 0.6, 1.8, 1.8, 3, 3]);
      assert.deepEqual(island.seats.map((seat) => seat.direction), [1, -1, 1, -1, 1, -1]);
    }
  });

  it("lays a rug of 4.6 by 3.7 under each island, half a unit to the left and 1.1 behind the desk", () => {
    assert.deepEqual(layout.islands.map((island) => rectOf(island.rug)), layout.islands.map((island) => [island.x - 0.5, island.z - 1.1, 4.6, 3.7].map(round)));
  });

  it("closes the building with the walls, low walls and doors of the approved plan", () => {
    assert.deepEqual(rectOf(byId(layout.walls, "back-wall")), [0, 0, 26, 0.2]);
    assert.deepEqual(rectOf(byId(layout.walls, "left-wall")), [0, 0, 0.2, 18]);
    assert.deepEqual(rectOf(byId(layout.walls, "reception-divider-front")), [20, 13, 0.12, 5]);
    const facade = layout.walls.filter((wall) => wall.kind === "facade");
    assert.deepEqual(facade.map(rectOf), [0, 5, 10, 15].map((x) => [x, 17.9, 5, 0.12]));
    assert.ok(facade.every((bay) => bay.height === 0.5 && bay.glassTop === 2));
    assert.deepEqual(rectOf(byId(layout.doors, "main-door")), [21.5, 17.9, 2.5, 0.12]);
    assert.deepEqual(layout.doors.filter((door) => door.from === "corridor" && door.to === "work").map((door) => [door.x, round(door.x + door.w)]), [[3.4, 5.2], [9.4, 11.2], [15.4, 17.2]]);
  });

  it("furnishes the common rooms where the approved plan has them", () => {
    assert.deepEqual(rectOf(byId(layout.decor, "meeting-table")), [1.4, 2, 4, 1.8]);
    assert.equal(layout.decor.filter((item) => item.kind === "chair" && item.areaId === "meeting").length, 6);
    assert.deepEqual(rectOf(byId(layout.decor, "pingpong-table")), [15, 2, 3, 1.6]);
    assert.deepEqual(rectOf(byId(layout.decor, "sofa")), [21, 1, 3, 1]);
    assert.deepEqual(rectOf(byId(layout.decor, "reception-counter")), [21.4, 11.6, 3, 0.9]);
    assert.deepEqual(rectOf(byId(layout.decor, "waiting-bench")), [21, 15.2, 2.6, 0.8]);
  });

  it("turns the island places left over on the last row into a corner with a water cooler and plants", () => {
    assert.deepEqual(layout.corners.map(placeOf), [[11, 14.4], [16, 14.4]]);
    const cornerItems = layout.decor.filter((item) => item.areaId === "work").map((item) => [item.kind, ...rectOf(item).slice(0, 2)]);
    assert.deepEqual(cornerItems, [["waterCooler", 12, 14.6], ["plant", 13.6, 15], ["plant", 17.6, 14.6]]);
  });

  it("lays the yard out in front of the facade", () => {
    assert.deepEqual(rectOf(layout.yard.path), [21.5, 18, 2.4, 9]);
    assert.deepEqual(rectOf(layout.yard.sign.block), [10.4, 21.6, 10.6, 1]);
    assert.deepEqual(placeOf(layout.yard.flagpole), [24.6, 21.2]);
    assert.deepEqual(placeOf(layout.yard.arrival), [22.7, 21]);
    assert.deepEqual(layout.yard.trees.map(placeOf).slice(-3), [[27, 3], [27, 9], [27, 14]]);
    assert.deepEqual(layout.yard.trees.map(placeOf)[0], [-1.4, 19]);
  });
});

describe("headquarters growth", () => {
  for (const [occupied, rows] of [[0, 2], [1, 2], [6, 2], [7, 3], [10, 3], [11, 4], [12, 4]]) {
    it(`gives ${occupied} occupied islands ${rows} rows and keeps two free islands right after them`, () => {
      const layout = layoutHeadquarters(officeOf(projectsWithOneAgent(occupied)));
      assert.equal(layout.rows, rows);
      assert.equal(round(layout.size.D), round(13.4 + 4.6 * (rows - 1)));
      const owners = layout.islands.map((island) => island.projectKey);
      assert.deepEqual(owners, [...owners.slice(0, occupied), null, null]);
      assert.equal(owners.filter((key) => key !== null).length, occupied);
    });
  }

  it("moves the facade, the doors and the yard with the depth of the building", () => {
    const layout = layoutHeadquarters(officeOf(projectsWithOneAgent(7)));
    assert.equal(round(layout.size.D), 22.6);
    assert.equal(round(byId(layout.doors, "main-door").z), 22.5);
    assert.equal(round(byId(layout.decor, "waiting-bench").z), 19.8);
    assert.equal(round(layout.yard.arrival.z), 25.6);
    assert.equal(round(layout.bounds.maxZ), 31.6);
  });

  it("moves the water cooler to the reception when no island place is left over", () => {
    const layout = layoutHeadquarters(officeOf(projectsWithOneAgent(6)));
    assert.deepEqual(layout.corners, []);
    const cooler = layout.decor.filter((item) => item.kind === "waterCooler");
    assert.deepEqual(cooler.map((item) => [item.areaId, ...rectOf(item)]), [["reception", 25, 15, 0.8, 1.2]]);
  });
});

describe("islands per project", () => {
  it("keeps the order in which projects were created, not who needs you or who was active last", () => {
    const projects = [
      projectOf("c:/b", [agentOf("claude:b", { status: "needs_you" })], { createdAt: NOW + 2, updatedAt: NOW + 50 }),
      projectOf("c:/a", [agentOf("claude:a")], { createdAt: NOW + 3, updatedAt: NOW + 90 }),
      projectOf("c:/c", [agentOf("claude:c")], { createdAt: NOW + 1, updatedAt: NOW }),
      projectOf("c:/d", [agentOf("claude:d")], { createdAt: NOW + 2, updatedAt: NOW }),
    ];
    const owners = layoutHeadquarters(officeOf(projects)).islands.map((island) => island.projectKey).filter(Boolean);
    assert.deepEqual(owners, ["c:/c", "c:/b", "c:/d", "c:/a"]);
  });

  it("gives a project with eight agents two islands side by side and seats everyone once", () => {
    const layout = layoutHeadquarters(officeOf([
      projectOf("c:/big", teamOf("claude:big", 8, NOW - 30 * MINUTE), { createdAt: NOW }),
      projectOf("c:/next", [agentOf("claude:next")], { createdAt: NOW + 1 }),
    ]));
    const big = islandsOf(layout, "c:/big");
    assert.deepEqual(big.map((island) => island.index), [0, 1]);
    const seated = big.flatMap(occupantsOf).filter(Boolean);
    assert.equal(seated.length, 8);
    assert.equal(new Set(seated).size, 8);
    assert.deepEqual(islandsOf(layout, "c:/next").map((island) => island.index), [2]);
  });

  it("keeps a session and its subagents on the same island when they fit", () => {
    const project = projectOf("c:/two-teams", [...teamOf("claude:a", 4, NOW - 20 * MINUTE), ...teamOf("claude:b", 4, NOW - 10 * MINUTE)]);
    const [first, second] = islandsOf(layoutHeadquarters(officeOf([project])), project.key).map((island) => occupantsOf(island).filter(Boolean));
    assert.deepEqual(first, ["claude:a", "claude:a:s0", "claude:a:s1", "claude:a:s2"]);
    assert.deepEqual(second, ["claude:b", "claude:b:s0", "claude:b:s1", "claude:b:s2"]);
  });

  it("keeps the seat of someone who is leaving until the collector forgets them", () => {
    const project = projectOf("c:/leaving", [agentOf("claude:gone", { endedAt: NOW - MINUTE }), agentOf("claude:here")]);
    assert.deepEqual(occupantsOf(islandsOf(layoutHeadquarters(officeOf([project])), project.key)[0]).filter(Boolean), ["claude:gone", "claude:here"]);
  });

  it("keeps the island of a project with nobody present", () => {
    const layout = layoutHeadquarters(officeOf([projectOf("c:/quiet", [])]));
    assert.equal(islandsOf(layout, "c:/quiet").length, 1);
    assert.equal(layout.islands.length, 3);
  });

  it("puts the project roles nobody is playing only on chairs left empty, and drops the ones that do not fit", () => {
    const roles = ["code-reviewer", "security-engineer", "test-engineer", "tech-writer"];
    const agents = [...teamOf("claude:a", 4, NOW - 20 * MINUTE), agentOf("claude:b", { label: "code-reviewer", startedAt: NOW - 10 * MINUTE })];
    const project = projectOf("c:/roles", agents, { team: roles });
    const islands = islandsOf(layoutHeadquarters(officeOf([project])), project.key);
    assert.equal(islands.length, 1);
    assert.deepEqual(occupantsOf(islands[0]), ["claude:a", "claude:a:s0", "claude:a:s1", "claude:a:s2", "claude:b", "security-engineer"]);
  });

  it("spreads the unplayed roles over the empty chairs of every island of the project, in order", () => {
    const roles = ["r0", "r1", "r2", "r3", "r4"];
    const agents = [...teamOf("claude:a", 4, NOW - 20 * MINUTE), ...teamOf("claude:b", 3, NOW - 10 * MINUTE)];
    const islands = islandsOf(layoutHeadquarters(officeOf([projectOf("c:/spread", agents, { team: roles })])), "c:/spread");
    assert.deepEqual(islands.map((island) => occupantsOf(island).filter((key) => roles.includes(key))), [["r0", "r1"], ["r2", "r3", "r4"]]);
  });

  it("paints each island with its project's theme and the free ones with the neutral theme", () => {
    const projects = THEMES.map((theme, i) => projectOf(`c:/${theme.id}`, [agentOf(`claude:${theme.id}`)], { template: theme.id, createdAt: NOW + i }));
    const layout = layoutHeadquarters(officeOf(projects));
    assert.deepEqual(layout.islands.map((island) => island.theme.id), [...THEMES.map((theme) => theme.id), NEUTRAL_ISLAND_THEME.id, NEUTRAL_ISLAND_THEME.id]);
    assert.deepEqual(Object.keys(NEUTRAL_ISLAND_THEME).sort(), Object.keys(THEMES[0]).sort());
  });
});
