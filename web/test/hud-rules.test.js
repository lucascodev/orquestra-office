import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { insetsAroundPanels, PANEL_GAP } from "../scripts/domain/camera/frame-insets.js";
import { areaBounds, projectBounds } from "../scripts/domain/camera/frame-target.js";
import { layoutHeadquarters } from "../scripts/domain/headquarters/headquarters-layout.js";
import { accountUsage, HIGH_USAGE_PERCENT } from "../scripts/domain/office/account-usage.js";
import { areaCensus } from "../scripts/domain/office/area-census.js";
import { dayTimeline } from "../scripts/domain/office/day-timeline.js";
import { searchHeadquarters } from "../scripts/domain/office/headquarters-search.js";
import { crossesWarning, newArrivals, pendingInFocus, requesterOf, serverClockNow } from "../scripts/domain/office/pending-queue.js";
import { requestIntentText } from "../scripts/domain/office/request-intent-text.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY_START = 1_800_000_000_000 - (1_800_000_000_000 % HOUR);
const NOW = DAY_START + 18 * HOUR + 5 * MINUTE;

const requestOf = (id, expiresInMs, extra = {}) => ({
  id, kind: "permission", agentKey: `claude:${id}`, toolName: "Bash", summaryId: "run-command", subject: null, detail: "npm test",
  createdAt: NOW - MINUTE, expiresAt: NOW + expiresInMs, ...extra,
});

describe("pending queue", () => {
  const queue = [requestOf("late", 5 * MINUTE), requestOf("soon", MINUTE), requestOf("middle", 2 * MINUTE)];

  it("shows the request closest to going back to the terminal first, as 1 of N", () => {
    const focus = pendingInFocus(queue, { now: NOW });
    assert.equal(focus.request.id, "soon");
    assert.equal(focus.position, 1);
    assert.equal(focus.total, 3);
    assert.equal(focus.remainingMs, MINUTE);
    assert.equal(focus.previousId, null);
    assert.equal(focus.nextId, "middle");
  });

  it("keeps showing the request the person moved to, even when a more urgent one arrives", () => {
    const urgent = requestOf("urgent", 10_000);
    const focus = pendingInFocus([...queue, urgent], { shownId: "middle", now: NOW });
    assert.equal(focus.request.id, "middle");
    assert.equal(focus.position, 3);
    assert.equal(focus.previousId, "soon");
    assert.equal(focus.nextId, "late");
  });

  it("goes back to the most urgent request when the one shown is gone", () => {
    assert.equal(pendingInFocus(queue, { shownId: "decided", now: NOW }).request.id, "soon");
  });

  it("has nothing to show on an empty queue", () => {
    assert.equal(pendingInFocus([], { now: NOW }), null);
  });

  it("never counts below zero and leaves the time open for a request without a deadline", () => {
    const expired = pendingInFocus([requestOf("old", -MINUTE)], { now: NOW });
    assert.equal(expired.remainingMs, 0);
    const open = pendingInFocus([requestOf("open", 0, { expiresAt: null }), requestOf("timed", MINUTE)], { now: NOW });
    assert.equal(open.request.id, "timed");
    assert.equal(open.nextId, "open");
    assert.equal(pendingInFocus([requestOf("open", 0, { expiresAt: null })], { now: NOW }).remainingMs, null);
  });

  it("breaks ties between equal deadlines by arrival and then by id, so the order never flickers", () => {
    const tied = [requestOf("b", MINUTE, { createdAt: NOW - 2 * MINUTE }), requestOf("c", MINUTE), requestOf("a", MINUTE)];
    const order = [];
    for (let id = pendingInFocus(tied, { now: NOW }).request.id; id; id = pendingInFocus(tied, { shownId: id, now: NOW }).nextId) order.push(id);
    assert.deepEqual(order, ["b", "a", "c"]);
  });

  it("leaves the queue it was given untouched", () => {
    const ids = queue.map((request) => request.id);
    pendingInFocus(queue, { now: NOW });
    assert.deepEqual(queue.map((request) => request.id), ids);
  });

  it("counts down with the collector's clock when the state says what time it was there", () => {
    const localNow = NOW + 5_000;
    assert.equal(serverClockNow({ localNow, generatedAt: NOW - 40_000, receivedAt: NOW }), NOW - 35_000);
    assert.equal(serverClockNow({ localNow, generatedAt: null, receivedAt: NOW }), localNow);
    assert.equal(serverClockNow({ localNow }), localNow);
  });

  it("finds the requests that were not there before, most urgent first", () => {
    const arrived = newArrivals(new Set(["late"]), queue);
    assert.deepEqual(arrived.map((request) => request.id), ["soon", "middle"]);
    assert.deepEqual(newArrivals(new Set(queue.map((request) => request.id)), queue), []);
  });

  it("warns once, when the time left crosses thirty seconds", () => {
    assert.equal(crossesWarning(31_000, 30_000), true);
    assert.equal(crossesWarning(30_000, 29_000), false);
    assert.equal(crossesWarning(null, 10_000), false);
    assert.equal(crossesWarning(40_000, null), false);
  });

  it("names who asks and in which room", () => {
    const projects = { "c:/loja": { name: "loja-online", agents: { "claude:c1": { key: "claude:c1", name: "Vitor" } } } };
    assert.deepEqual(requesterOf(projects, "claude:c1"), { name: "Vitor", projectName: "loja-online" });
    assert.equal(requesterOf(projects, "claude:gone"), null);
  });
});

describe("request intent", () => {
  it("says what the agent wants to do, from the request fields", () => {
    assert.equal(requestIntentText(requestOf("a", MINUTE)), "quer rodar um comando");
    assert.equal(requestIntentText(requestOf("b", MINUTE, { summaryId: "edit-file", toolName: "Edit", subject: "people.js" })), "quer editar people.js");
    assert.equal(requestIntentText(requestOf("c", MINUTE, { summaryId: "use-tool", toolName: "mcp__x", subject: "mcp__x" })), "quer usar mcp__x");
    assert.equal(requestIntentText(requestOf("d", MINUTE, { summaryId: "use-tool", subject: null })), "quer usar uma ferramenta");
    assert.equal(requestIntentText({ kind: "question", summaryId: "ask-question" }), "tem uma pergunta");
  });

  it("falls back to the kind and the tool for a request that predates the fields or has an unknown id", () => {
    assert.equal(requestIntentText({ kind: "question" }), "tem uma pergunta");
    assert.equal(requestIntentText({ kind: "permission", toolName: "Write" }), "quer usar Write");
    assert.equal(requestIntentText({ kind: "permission", summaryId: "toString", toolName: "Write" }), "quer usar Write");
    assert.equal(requestIntentText({ kind: "permission" }), "quer usar uma ferramenta");
  });
});

const slotAt = (hour, extra = {}) => ({
  start: DAY_START + hour * HOUR, workingMs: 0, workingAgentMs: 0, needsYouMs: 0, needsYouAgentMs: 0, needsYouCount: 0, costUsd: 0, ...extra,
});

describe("day timeline", () => {
  const closedTimeline = (slots) => ({ slotMs: HOUR, slots, open: { since: null, working: 0, needsYou: 0 } });

  it("shows the hours from 8 to 20 on a quiet day, with the current hour placed on the bar", () => {
    const day = dayTimeline(closedTimeline([]), { now: NOW, dayStart: DAY_START });
    assert.equal(day.from, 8);
    assert.equal(day.until, 20);
    assert.deepEqual(day.hours.map(({ hour }) => hour), [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    assert.deepEqual(day.nowAt, { hour: 18, minute: 5, position: (10 + 5 / 60) / 13 });
    assert.deepEqual(day.hours.filter((hour) => hour.isNow).map(({ hour }) => hour), [18]);
    assert.deepEqual(day.hours.filter((hour) => hour.isPast).map(({ hour }) => hour), [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
    assert.deepEqual(day.totals, { workingMs: 0, needsYouMs: 0, costUsd: 0 });
  });

  it("adds up the day and scales each bar by the busiest hour", () => {
    const day = dayTimeline(closedTimeline([
      slotAt(9, { workingMs: 30 * MINUTE, workingAgentMs: HOUR, costUsd: 1.5 }),
      slotAt(10, { workingMs: HOUR, workingAgentMs: 2 * HOUR, needsYouMs: 4 * MINUTE, needsYouAgentMs: 4 * MINUTE, needsYouCount: 2, costUsd: 2.25 }),
    ]), { now: NOW, dayStart: DAY_START });
    assert.deepEqual(day.totals, { workingMs: 90 * MINUTE, needsYouMs: 4 * MINUTE, costUsd: 3.75 });
    const [nine, ten] = day.hours.filter(({ hour }) => hour === 9 || hour === 10);
    assert.equal(nine.level, 0.5);
    assert.equal(nine.averageWorking, 1);
    assert.equal(ten.averageWorking, 2);
    assert.equal(ten.level, 1);
    assert.equal(nine.needsYouCount, 0);
    assert.equal(nine.isMarked, false);
    assert.equal(ten.needsYouCount, 2);
    assert.equal(ten.isMarked, true);
  });

  it("widens the range to hours with work before 8 or after 20, and to the current hour late at night", () => {
    const early = dayTimeline(closedTimeline([slotAt(6, { workingMs: MINUTE, workingAgentMs: MINUTE })]), { now: NOW, dayStart: DAY_START });
    assert.equal(early.from, 6);
    assert.equal(early.until, 20);
    const late = dayTimeline(closedTimeline([]), { now: DAY_START + 22 * HOUR + 30 * MINUTE, dayStart: DAY_START });
    assert.equal(late.until, 22);
    const marked = dayTimeline(closedTimeline([slotAt(21, { needsYouCount: 1 })]), { now: NOW, dayStart: DAY_START });
    assert.equal(marked.until, 21);
  });

  it("leaves out the slots of yesterday and counts only today", () => {
    const day = dayTimeline(closedTimeline([slotAt(-2, { workingMs: HOUR, workingAgentMs: HOUR, costUsd: 9 }), slotAt(9, { costUsd: 1 })]), { now: NOW, dayStart: DAY_START });
    assert.equal(day.from, 8);
    assert.deepEqual(day.totals, { workingMs: 0, needsYouMs: 0, costUsd: 1 });
  });

  it("closes the open stretch at the current time, splitting it at the turn of the hour", () => {
    const timeline = { slotMs: HOUR, slots: [slotAt(17, { workingMs: 10 * MINUTE, workingAgentMs: 10 * MINUTE })], open: { since: NOW - 15 * MINUTE, working: 2, needsYou: 1 } };
    const day = dayTimeline(timeline, { now: NOW, dayStart: DAY_START });
    assert.deepEqual(day.totals, { workingMs: 25 * MINUTE, needsYouMs: 15 * MINUTE, costUsd: 0 });
    const [five, six] = day.hours.filter(({ hour }) => hour === 17 || hour === 18);
    assert.equal(five.level, 1);
    assert.equal(six.level, 10 / 30);
  });

  it("starts the open stretch at midnight when it began yesterday", () => {
    const timeline = { slotMs: HOUR, slots: [], open: { since: DAY_START - HOUR, working: 1, needsYou: 0 } };
    const day = dayTimeline(timeline, { now: DAY_START + 30 * MINUTE, dayStart: DAY_START });
    assert.equal(day.totals.workingMs, 30 * MINUTE);
    assert.equal(day.from, 0);
  });

  it("has nothing to show before the collector sends a timeline", () => {
    assert.equal(dayTimeline(null, { now: NOW, dayStart: DAY_START }), null);
    assert.equal(dayTimeline(undefined, { now: NOW, dayStart: DAY_START }), null);
  });
});

describe("account usage", () => {
  const windowOf = (usedPercentage, resetsAt = NOW + HOUR) => ({ usedPercentage, resetsAt });

  it("lists each account by name with its windows rounded, flagging the ones at 80 percent or more", () => {
    const accounts = {
      b1: { id: "b1", label: "Trabalho", rateLimits: { fiveHour: windowOf(12.4), sevenDay: windowOf(41) }, updatedAt: NOW },
      a1: { id: "a1", label: "Pessoal", rateLimits: { fiveHour: windowOf(37), sevenDay: windowOf(79.6) }, updatedAt: NOW },
    };
    const [personal, work] = accountUsage({ accounts });
    assert.equal(HIGH_USAGE_PERCENT, 80);
    assert.deepEqual(personal, {
      id: "a1", label: "Pessoal", initial: "P",
      windows: [{ id: "fiveHour", percent: 37, resetsAt: NOW + HOUR, isHigh: false }, { id: "sevenDay", percent: 80, resetsAt: NOW + HOUR, isHigh: true }],
      peak: { id: "sevenDay", percent: 80, isHigh: true },
    });
    assert.equal(work.label, "Trabalho");
    assert.deepEqual(work.peak, { id: "sevenDay", percent: 41, isHigh: false });
  });

  it("shows the single reading of the plan as the Claude account while the collector has no accounts", () => {
    const [only, ...rest] = accountUsage({ accounts: null, usage: { rateLimits: { fiveHour: windowOf(37) } } });
    assert.deepEqual(rest, []);
    assert.equal(only.id, "default");
    assert.equal(only.label, "Claude");
    assert.deepEqual(only.windows.map(({ id, percent }) => [id, percent]), [["fiveHour", 37]]);
  });

  it("keeps an account that has not read its usage yet, with no windows and no peak", () => {
    const [account] = accountUsage({ accounts: { x: { id: "x", label: "nova", rateLimits: null, updatedAt: NOW } } });
    assert.deepEqual(account, { id: "x", label: "nova", initial: "N", windows: [], peak: null });
  });

  it("has no accounts before any reading", () => {
    assert.deepEqual(accountUsage({ accounts: null, usage: null }), []);
    assert.deepEqual(accountUsage({ accounts: {}, usage: { rateLimits: {} } }), []);
    assert.deepEqual(accountUsage({}), []);
  });
});

const agentOf = (key, status, extra = {}) => ({ key, name: key.split(":")[1], label: "Claude Code", status, ...extra });
const projectOf = (key, name, agents, template = "cafe") => ({ key, name, template, updatedAt: NOW, agents: Object.fromEntries(agents.map((agent) => [agent.key, agent])) });

const busyProjects = () => ({
  "c:/loja": projectOf("c:/loja", "loja-online", [agentOf("claude:Vitor", "needs_you"), agentOf("claude:Otto", "break")]),
  "c:/orquestra": projectOf("c:/orquestra", "orquestra-office", [
    agentOf("claude:Heitor", "working"), agentOf("claude:Davi", "reviewing"), agentOf("claude:Nina", "idle"), agentOf("claude:Eva", "mystery"),
  ], "startup"),
  "c:/jogo": projectOf("c:/jogo", "jogo-de-plataforma", [agentOf("claude:Rui", "blocked"), agentOf("claude:Teo", "working")], "fliperama"),
});

describe("area census", () => {
  it("counts everyone, each project by status from the most urgent, and the people in each common room", () => {
    const projects = busyProjects();
    const layout = layoutHeadquarters(projects);
    const pantry = layout.areas.find((area) => area.id === "pantry");
    const games = layout.areas.find((area) => area.id === "games");
    const stops = new Map([
      ["claude:Otto", { x: pantry.x + 1, z: pantry.z + 1 }],
      ["claude:Nina", { x: pantry.x + 2, z: pantry.z + 1 }],
      ["claude:Eva", { x: games.x + 1, z: games.z + 1 }],
    ]);
    const census = areaCensus({ layout, projects, stops });
    assert.equal(census.total, 8);
    const byKey = Object.fromEntries(census.projects.map((project) => [project.key, project]));
    assert.deepEqual(byKey["c:/loja"].byStatus, [{ status: "needs_you", count: 1 }, { status: "break", count: 1 }]);
    assert.deepEqual(byKey["c:/orquestra"].byStatus, [{ status: "working", count: 2 }, { status: "idle", count: 2 }]);
    assert.deepEqual(byKey["c:/jogo"].byStatus, [{ status: "blocked", count: 1 }, { status: "working", count: 1 }]);
    assert.deepEqual(byKey["c:/jogo"], { key: "c:/jogo", name: "jogo-de-plataforma", themeId: "fliperama", total: 2, byStatus: byKey["c:/jogo"].byStatus });
    assert.deepEqual(census.areas, [
      { id: "meeting", name: "Sala de reuniões", count: 0 },
      { id: "pantry", name: "Copa", count: 2 },
      { id: "games", name: "Sala de jogos", count: 1 },
      { id: "lounge", name: "Lounge", count: 0 },
    ]);
  });

  it("lists the projects in the order of their islands on the floor", () => {
    const projects = busyProjects();
    const layout = layoutHeadquarters(projects);
    const islandOrder = [...new Set(layout.islands.map((island) => island.projectKey).filter(Boolean))];
    assert.deepEqual(areaCensus({ layout, projects, stops: new Map() }).projects.map((project) => project.key), islandOrder);
  });

  it("lists an empty project with no counts", () => {
    const projects = { "c:/vazio": projectOf("c:/vazio", "vazio", []) };
    const census = areaCensus({ layout: layoutHeadquarters(projects), projects, stops: new Map() });
    assert.equal(census.total, 0);
    assert.deepEqual(census.projects, [{ key: "c:/vazio", name: "vazio", themeId: "cafe", total: 0, byStatus: [] }]);
  });
});

describe("room bounds", () => {
  it("frames every island of a project and a common room by its walls", () => {
    const projects = busyProjects();
    const layout = layoutHeadquarters(projects);
    const islands = layout.islands.filter((island) => island.projectKey === "c:/loja");
    const bounds = projectBounds(layout, "c:/loja");
    assert.equal(bounds.minX, Math.min(...islands.map((island) => island.rug.x)));
    assert.equal(bounds.maxZ, Math.max(...islands.map((island) => island.rug.z + island.rug.d)));
    assert.ok(bounds.maxY > 0);
    const pantry = layout.areas.find((area) => area.id === "pantry");
    assert.deepEqual(areaBounds(layout, "pantry"), { minX: pantry.x, maxX: pantry.x + pantry.w, minZ: pantry.z, maxZ: pantry.z + pantry.d, minY: 0, maxY: 2.4 });
  });

  it("has no bounds for a project or a room that is not on the floor", () => {
    const layout = layoutHeadquarters(busyProjects());
    assert.equal(projectBounds(layout, "c:/fechado"), null);
    assert.equal(areaBounds(layout, "toString"), null);
  });
});

describe("headquarters search", () => {
  const people = [
    { key: "claude:v", name: "Vitor", label: "Claude Code", room: "loja-online", status: "needs_you", doing: "Pedindo permissão para usar Bash" },
    { key: "claude:o", name: "Otto", label: "Explore", room: "loja-online", status: "break", doing: "Entregou a tarefa" },
    { key: "claude:h", name: "Heitor", label: "Claude Code", room: "orquestra-office", status: "working", doing: "Editando people.js" },
    { key: "codex:l", name: "Lívia", label: "Codex", room: "orquestra-office", status: "waiting", doing: "" },
  ];
  const rooms = [{ id: "c:/loja", name: "loja-online" }, { id: "pantry", name: "Copa" }];
  const actions = [{ id: "new-session", label: "Nova sessão" }, { id: "frame-whole", label: "Enquadrar a Sede inteira" }];
  const search = (query) => searchHeadquarters({ query, agents: people, rooms, actions });
  const keysOf = (result) => result.agentGroups.map(({ room, agents }) => [room, agents.map((agent) => agent.key)]);

  it("lists everyone by room with no query, the rooms where someone needs you first and those people first in them", () => {
    const result = search("");
    assert.deepEqual(keysOf(result), [["loja-online", ["claude:v", "claude:o"]], ["orquestra-office", ["claude:h", "codex:l"]]]);
    assert.deepEqual(result.rooms.map(({ id }) => id), ["c:/loja", "pantry"]);
    assert.deepEqual(result.actions.map(({ id }) => id), ["new-session", "frame-whole"]);
  });

  it("finds people by name without caring for case or accents", () => {
    assert.deepEqual(keysOf(search("LIVIA")), [["orquestra-office", ["codex:l"]]]);
  });

  it("finds people by their room, by what they are and by what they are doing now", () => {
    assert.deepEqual(keysOf(search("orquestra")), [["orquestra-office", ["claude:h", "codex:l"]]]);
    assert.deepEqual(keysOf(search("explore")), [["loja-online", ["claude:o"]]]);
    assert.deepEqual(keysOf(search("people.js")), [["orquestra-office", ["claude:h"]]]);
    assert.deepEqual(keysOf(search("permissao")), [["loja-online", ["claude:v"]]]);
  });

  it("needs every word of the query, in any order", () => {
    assert.deepEqual(keysOf(search("code heitor")), [["orquestra-office", ["claude:h"]]]);
    assert.deepEqual(keysOf(search("heitor loja")), []);
  });

  it("finds rooms and actions by name", () => {
    const result = search("  sessao ");
    assert.deepEqual(result.actions.map(({ id }) => id), ["new-session"]);
    assert.deepEqual(search("copa").rooms.map(({ id }) => id), ["pantry"]);
    assert.deepEqual(search("copa").agentGroups, []);
  });
});

describe("frame insets around the floating panels", () => {
  const viewport = { width: 1440, height: 900 };
  const rect = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height });

  it("keeps the map clear of the panels docked on each side, with a gap", () => {
    const insets = insetsAroundPanels(viewport, {
      left: [rect(16, 16, 268, 500), rect(16, 700, 220, 184)],
      top: [rect(440, 16, 560, 84), rect(1080, 16, 344, 52)],
      bottom: [rect(252, 760, 600, 124), rect(868, 770, 148, 114)],
      right: [],
    });
    assert.deepEqual(insets, { left: 300, right: PANEL_GAP, top: 116, bottom: 156 });
  });

  it("keeps only the gap on a side without panels", () => {
    assert.deepEqual(insetsAroundPanels(viewport, { left: [], right: [], top: [], bottom: [] }), { left: 16, right: 16, top: 16, bottom: 16 });
  });

  it("lets the map run under the panels of a direction that would leave it too little room, as on a phone", () => {
    const phone = { width: 390, height: 800 };
    const insets = insetsAroundPanels(phone, { left: [rect(16, 80, 220, 300)], right: [rect(260, 80, 120, 40)], top: [rect(16, 16, 358, 60)], bottom: [rect(16, 640, 358, 144)] });
    assert.deepEqual(insets, { left: 16, right: 16, top: 92, bottom: 176 });
  });
});
