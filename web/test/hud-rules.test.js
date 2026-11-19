import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALERT_WIDTH, alertPlacement, insetsAroundPanels, PANEL_GAP } from "../scripts/domain/camera/frame-insets.js";
import { areaBounds, projectBounds } from "../scripts/domain/camera/frame-target.js";
import { projectAtPoint } from "../scripts/domain/headquarters/area-of-point.js";
import { layoutHeadquarters } from "../scripts/domain/headquarters/headquarters-layout.js";
import { accountUsage, agentAccountLabel, HIGH_USAGE_PERCENT } from "../scripts/domain/office/account-usage.js";
import { areaCensus } from "../scripts/domain/office/area-census.js";
import { dayTimeline } from "../scripts/domain/office/day-timeline.js";
import { decisionForKey } from "../scripts/domain/office/decision-shortcuts.js";
import { searchHeadquarters } from "../scripts/domain/office/headquarters-search.js";
import { islandFacts } from "../scripts/domain/office/island-facts.js";
import { movedCursor, TAB_KEYS } from "../scripts/domain/office/option-cursor.js";
import { isDismissedByDrag } from "../scripts/domain/shared/drag-dismiss.js";
import { searchEntries } from "../scripts/domain/office/search-entries.js";
import { crossesWarning, newArrivals, pendingInFocus, requesterOf, serverClockNow } from "../scripts/domain/office/pending-queue.js";
import { queuedCountOf, queuedText } from "../scripts/domain/office/queued-messages.js";
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

  it("names the account an agent works on only when there is more than one account to tell apart", () => {
    const accounts = {
      a1: { id: "a1", label: "Pessoal", rateLimits: null, updatedAt: NOW },
      b1: { id: "b1", label: "Trabalho", rateLimits: null, updatedAt: NOW },
    };
    assert.equal(agentAccountLabel({ accounts, accountId: "b1" }), "Trabalho");
    assert.equal(agentAccountLabel({ accounts, accountId: "gone" }), null);
    assert.equal(agentAccountLabel({ accounts, accountId: "toString" }), null);
    assert.equal(agentAccountLabel({ accounts, accountId: null }), null);
    assert.equal(agentAccountLabel({ accounts: { a1: accounts.a1 }, accountId: "a1" }), null);
    assert.equal(agentAccountLabel({ accounts: null, accountId: "a1" }), null);
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

describe("island sheet facts", () => {
  const withStats = (project, stats) => ({ ...project, stats });

  it("adds up the open sessions and the day of the project, counting who needs you", () => {
    const project = withStats(projectOf("c:/loja", "loja-online", [
      agentOf("claude:Vitor", "needs_you"),
      agentOf("claude:Otto", "break", { kind: "subagent", parentKey: "claude:Vitor" }),
      agentOf("claude:Ana", "working", { kind: "main" }),
      agentOf("claude:Rui", "idle", { kind: "main", endedAt: NOW - MINUTE }),
    ]), { prompts: 7, tools: 81, turns: 6, tokens: 552_000, costUsd: 4.1 });
    const facts = islandFacts(project);
    assert.deepEqual(facts.day, { sessions: 2, prompts: 7, tools: 81, turns: 6, tokens: 552_000, costUsd: 4.1, needsYou: 1 });
    assert.deepEqual([facts.key, facts.name, facts.themeId], ["c:/loja", "loja-online", "cafe"]);
  });

  it("lists who is on the island, the most urgent first and then by name", () => {
    const facts = islandFacts(busyProjects()["c:/orquestra"]);
    assert.deepEqual(facts.team.map(({ name, status }) => [name, status]), [
      ["Davi", "reviewing"], ["Heitor", "working"], ["Eva", "idle"], ["Nina", "idle"],
    ]);
    assert.deepEqual(Object.keys(facts.team[0]), ["key", "name", "label", "status", "kind", "queued"]);
  });

  it("counts the messages waiting in each person's queue, none for a key only the prototype knows", () => {
    const project = projectOf("c:/loja", "loja-online", [agentOf("claude:Vitor", "working"), agentOf("claude:Otto", "idle")]);
    const facts = islandFacts(project, { "claude:Vitor": 2, toString: 9 });
    assert.deepEqual(facts.team.map(({ name, queued }) => [name, queued]), [["Vitor", 2], ["Otto", 0]]);
    assert.deepEqual(islandFacts(project).team.map(({ queued }) => queued), [0, 0]);
  });
});

describe("queued messages", () => {
  it("counts an agent's queue, none without an outbox or for a key only the prototype knows", () => {
    assert.deepEqual([queuedCountOf({ "claude:a": 3 }, "claude:a"), queuedCountOf({}, "claude:a"), queuedCountOf(null, "claude:a"), queuedCountOf({}, "constructor")], [3, 0, 0, 0]);
  });

  it("says how many messages wait in the queue, and nothing when none does", () => {
    assert.deepEqual([0, 1, 4].map(queuedText), ["", "1 na fila", "4 na fila"]);
  });

  it("zeroes the day of a project the collector has not counted yet", () => {
    const facts = islandFacts(projectOf("c:/vazio", "vazio", []));
    assert.deepEqual(facts.day, { sessions: 0, prompts: 0, tools: 0, turns: 0, tokens: 0, costUsd: 0, needsYou: 0 });
    assert.deepEqual(facts.team, []);
  });
});

describe("island under a point", () => {
  it("finds the project whose island rug is under the point, and nothing on a free island or off the islands", () => {
    const layout = layoutHeadquarters(busyProjects());
    const taken = layout.islands.find((island) => island.projectKey === "c:/jogo");
    const free = layout.islands.find((island) => !island.projectKey);
    const middleOf = ({ x, z, w, d }) => ({ x: x + w / 2, z: z + d / 2 });
    assert.equal(projectAtPoint(layout, middleOf(taken.rug)), "c:/jogo");
    assert.equal(projectAtPoint(layout, middleOf(free.rug)), null);
    assert.equal(projectAtPoint(layout, { x: -50, z: -50 }), null);
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

describe("what the search looks through", () => {
  const census = {
    total: 3,
    projects: [{ key: "c:/loja", name: "loja-online", themeId: "cafe", total: 2, byStatus: [] }],
    areas: [{ id: "pantry", name: "Copa", count: 1 }],
  };
  const projects = {
    "c:/loja": projectOf("c:/loja", "loja-online", [
      agentOf("claude:Vitor", "needs_you", { actionId: "permission-requested", subject: "Bash" }),
      agentOf("claude:Otto", "mystery", { kind: "subagent", label: "Explore", action: "lendo README.md" }),
    ]),
  };
  const entriesOf = (extra = {}) => searchEntries({ projects, census, pendingCount: 0, isRunnerAvailable: false, isFollowing: false, ...extra });

  it("lists every agent with its room, its status and what it is doing now in words", () => {
    assert.deepEqual(entriesOf().agents, [
      { key: "claude:Vitor", name: "Vitor", label: "Claude Code", room: "loja-online", status: "needs_you", doing: "pede permissão para usar Bash" },
      { key: "claude:Otto", name: "Otto", label: "Explore", room: "loja-online", status: "idle", doing: "lendo README.md" },
    ]);
  });

  it("lists the islands and then the common rooms", () => {
    assert.deepEqual(entriesOf().rooms, [
      { id: "c:/loja", kind: "project", name: "loja-online" },
      { id: "pantry", kind: "area", name: "Copa" },
    ]);
  });

  it("offers only the actions that make sense now, the request first when there is one", () => {
    assert.deepEqual(entriesOf().actions.map(({ id }) => id), ["frame-whole"]);
    const busy = entriesOf({ pendingCount: 2, isRunnerAvailable: true, isFollowing: true });
    assert.deepEqual(busy.actions.map(({ id }) => id), ["go-to-request", "new-session", "frame-whole", "stop-following"]);
    assert.deepEqual(busy.actions.map(({ label }) => label), ["Ir para o pedido", "Nova sessão", "Enquadrar a Sede inteira", "Parar de seguir com a câmera"]);
  });
});

describe("option cursor", () => {
  it("moves down and up through the options and wraps around the ends", () => {
    assert.equal(movedCursor({ count: 3, index: 0, key: "ArrowDown" }), 1);
    assert.equal(movedCursor({ count: 3, index: 2, key: "ArrowDown" }), 0);
    assert.equal(movedCursor({ count: 3, index: 0, key: "ArrowUp" }), 2);
    assert.equal(movedCursor({ count: 3, index: -1, key: "ArrowDown" }), 0);
    assert.equal(movedCursor({ count: 3, index: -1, key: "ArrowUp" }), 2);
  });

  it("goes to the first and last option with Page Up and Page Down, and ignores other keys or an empty list", () => {
    assert.equal(movedCursor({ count: 5, index: 2, key: "PageUp" }), 0);
    assert.equal(movedCursor({ count: 5, index: 2, key: "PageDown" }), 4);
    assert.equal(movedCursor({ count: 5, index: 2, key: "Enter" }), null);
    assert.equal(movedCursor({ count: 0, index: -1, key: "ArrowDown" }), null);
  });

  it("moves through tabs sideways with the arrows, Home and End", () => {
    const tab = (index, key) => movedCursor({ count: 4, index, key, keys: TAB_KEYS });
    assert.deepEqual([tab(0, "ArrowRight"), tab(3, "ArrowRight"), tab(0, "ArrowLeft"), tab(2, "Home"), tab(1, "End")], [1, 0, 3, 0, 3]);
    assert.equal(tab(1, "ArrowDown"), null);
  });
});

describe("bottom sheet drag", () => {
  it("closes the sheet dragged down far enough, a quarter of its height or a fixed distance on a tall sheet", () => {
    assert.equal(isDismissedByDrag({ distance: 50, sheetHeight: 400 }), false);
    assert.equal(isDismissedByDrag({ distance: 100, sheetHeight: 400 }), true);
    assert.equal(isDismissedByDrag({ distance: 120, sheetHeight: 1000 }), true);
    assert.equal(isDismissedByDrag({ distance: -200, sheetHeight: 400 }), false);
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

describe("decision shortcuts", () => {
  const press = (key, extra = {}) => decisionForKey({ key, hasModifier: false, isTyping: false, ...extra });

  it("allows with A and denies with N, in either case", () => {
    assert.deepEqual(["a", "A", "n", "N"].map((key) => press(key)), ["allow", "allow", "deny", "deny"]);
  });

  it("ignores every other key, a key held with a modifier and a key typed into a field", () => {
    assert.equal(press("x"), null);
    assert.equal(press("Enter"), null);
    assert.equal(press("toString"), null);
    assert.equal(press("a", { hasModifier: true }), null);
    assert.equal(press("n", { isTyping: true }), null);
  });
});

describe("request alert placement", () => {
  const rect = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height });
  const capsule = rect(16, 16, 268, 40);

  it("stays centered on the screen when it fits between the brand and the accounts", () => {
    assert.deepEqual(alertPlacement({ viewportWidth: 1920, left: capsule, right: rect(1500, 16, 404, 52) }), { isLowered: false, left: (1920 - ALERT_WIDTH) / 2, width: ALERT_WIDTH });
  });

  it("narrows around the center rather than sliding away from wide accounts, as in the mock-up at 1440 pixels", () => {
    const placement = alertPlacement({ viewportWidth: 1440, left: capsule, right: rect(975, 16, 449, 52) });
    const halfWidth = 975 - PANEL_GAP - 720;
    assert.deepEqual(placement, { isLowered: false, left: 720 - halfWidth, width: 2 * halfWidth });
  });

  it("slides away from wide accounts when staying centered would leave it too narrow, keeping a gap to both neighbors", () => {
    const placement = alertPlacement({ viewportWidth: 1280, left: capsule, right: rect(860, 16, 404, 52) });
    assert.deepEqual(placement, { isLowered: false, left: 284 + PANEL_GAP, width: 860 - PANEL_GAP - (284 + PANEL_GAP) });
    const roomy = alertPlacement({ viewportWidth: 1600, left: capsule, right: rect(1000, 16, 584, 52) });
    assert.deepEqual(roomy, { isLowered: false, left: 1000 - PANEL_GAP - ALERT_WIDTH, width: ALERT_WIDTH });
  });

  it("narrows down to fit the gap, and drops under the top row when even that is too tight", () => {
    const narrow = alertPlacement({ viewportWidth: 1200, left: capsule, right: rect(760, 16, 424, 52) });
    assert.deepEqual(narrow, { isLowered: false, left: 284 + PANEL_GAP, width: 760 - PANEL_GAP - (284 + PANEL_GAP) });
    assert.deepEqual(alertPlacement({ viewportWidth: 900, left: capsule, right: rect(480, 16, 404, 52) }), { isLowered: true, left: null, width: null });
  });

  it("uses the screen edges when a neighbor is missing", () => {
    assert.deepEqual(alertPlacement({ viewportWidth: 1440, left: null, right: null }), { isLowered: false, left: (1440 - ALERT_WIDTH) / 2, width: ALERT_WIDTH });
  });
});
