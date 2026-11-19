import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, it, mock } from "node:test";
import { fileURLToPath } from "node:url";
import { agentMark, originOf, statusBadge } from "../scripts/view/office/agent-badges.js";
import { renderOffice } from "../scripts/view/office/room-view.js";
import { describeStatus } from "../scripts/view/office/status-display.js";
import { renderTabs } from "../scripts/view/office/tabs-view.js";
import { renderTeam } from "../scripts/view/office/team-view.js";
import { renderUsage } from "../scripts/view/office/usage-view.js";
import {
  renderAgentFacts, renderAgentIdentity, renderDrawerIdentity, renderDrawerShell, renderDrawerStatus, renderSheetShell,
} from "../scripts/view/sheet/agent-sheet-view.js";
import { accountUsage } from "../scripts/domain/office/account-usage.js";
import { dayTimeline } from "../scripts/domain/office/day-timeline.js";
import { renderAccounts } from "../scripts/view/hud/accounts-view.js";
import { renderAreaList } from "../scripts/view/hud/area-list-view.js";
import { renderConnection } from "../scripts/view/hud/connection-view.js";
import { renderDayTimeline } from "../scripts/view/hud/day-timeline-view.js";
import { renderLegend } from "../scripts/view/hud/legend-view.js";
import {
  arrivalsText, arrivalText, countdownText, renderAlertBody, renderAlertHead, requestsButtonLabel, warningText,
} from "../scripts/view/hud/pending-alert-view.js";
import { renderPendingCard, renderPendingStrip } from "../scripts/view/sheet/pending-request-view.js";
import { islandFacts } from "../scripts/domain/office/island-facts.js";
import { followingStoppedText, renderCameraControls, renderFollowing } from "../scripts/view/hud/camera-controls-view.js";
import { renderSearchResults, resultCountText } from "../scripts/view/hud/search-results-view.js";
import { renderIslandDay, renderIslandIdentity, renderIslandShell, renderIslandTeam } from "../scripts/view/sheet/island-sheet-view.js";

// ago(), clockTime() and resetTime() print in the machine's time zone; the recorded pages are in UTC.
process.env.TZ = "UTC";

const VIEW_FIXTURES = fileURLToPath(new URL("./fixtures/views/", import.meta.url));
const NOW = Date.UTC(2026, 10, 18, 15, 0, 0);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

before(() => mock.timers.enable({ apis: ["Date"], now: NOW }));
after(() => mock.timers.reset());

const recordedView = (name) => readFileSync(join(VIEW_FIXTURES, `${name}.html`), "utf8").replace(/\r\n/g, "\n").replace(/\n$/, "");

function assertMatchesRecording(name, html) {
  assert.equal(html, recordedView(name));
}

const agentOf = (key, extra = {}) => ({
  key, name: "Ana", label: "Claude Code", source: "claude", kind: "main", parentKey: null, status: "working", activity: "editing",
  action: "editando office-store.js", startedAt: NOW - 3 * HOUR, updatedAt: NOW - 5 * MINUTE, endedAt: null, tools: 12, ...extra,
});

const projectOf = (key, name, agents, extra = {}) => ({
  key, name, template: "cafe", team: [], updatedAt: NOW - MINUTE,
  stats: { prompts: 7, tools: 81, turns: 6, tokens: 552_000, costUsd: 4.1 },
  agents: Object.fromEntries(agents.map((agent) => [agent.key, agent])), ...extra,
});

const permission = {
  id: "req-permission", kind: "permission", agentKey: "claude:c1", toolName: "Bash",
  summary: "Aplicar as migrações do banco", detail: "npx prisma migrate deploy", createdAt: NOW, expiresAt: NOW + 2 * MINUTE,
};

const question = {
  id: "req-question", kind: "question", agentKey: "claude:d1", toolName: "AskUserQuestion", summary: "Tem uma pergunta para você", detail: "",
  createdAt: NOW, expiresAt: NOW + 2 * MINUTE,
  questions: [
    {
      question: "Qual motor de física usar?", header: "Física", multiSelect: false,
      options: [{ label: "Rapier", description: "Rápido e determinístico." }, { label: "Física própria", description: "" }],
    },
    { question: "Quais plataformas?", header: "", multiSelect: true, options: [{ label: "Web <canvas>" }, { label: "Desktop" }] },
  ],
};

const busyTeam = () => [
  agentOf("claude:c1", { name: "Caio", status: "needs_you", activity: "terminal", action: "pede permissão para usar Bash", updatedAt: NOW - 2 * MINUTE }),
  agentOf("claude:c1:s1", { name: "Bia", kind: "subagent", parentKey: "claude:c1", label: "code-reviewer", status: "reviewing", activity: "reading", action: "lendo server.js" }),
  agentOf("codex:b1", { name: "Nara", source: "codex", label: "Codex", status: "waiting", action: "", updatedAt: NOW - 2 * DAY }),
  agentOf("claude:e1", { name: "Eva", label: "<script>alert(1)</script>", status: "mystery", action: "a & b", updatedAt: NOW - 10 * MINUTE }),
];

describe("tabs", () => {
  it("lists the rooms with who needs you first, counting needs or activity, and marks the selected one", () => {
    const projects = {
      "c:/site": projectOf("c:/site", "site", [agentOf("claude:s1", { status: "idle" })], { updatedAt: NOW }),
      "c:/loja": projectOf("c:/loja", "loja <online> & cia", [agentOf("claude:l1"), agentOf("claude:l2", { status: "blocked" })], { updatedAt: NOW - HOUR }),
      "c:/orquestra": projectOf("c:/orquestra", "orquestra", [agentOf("claude:o1", { status: "needs_you" })], { updatedAt: NOW - DAY }),
    };
    assertMatchesRecording("tabs", renderTabs(projects, "c:/loja"));
  });
});

describe("team list", () => {
  it("shows each agent with origin, time, queue and the pending request strip", () => {
    const project = projectOf("c:/loja", "loja", busyTeam());
    const pendingByAgent = new Map([["claude:c1", permission]]);
    assertMatchesRecording("team-busy", renderTeam(project, { pendingByAgent, outbox: { "claude:c1": 2 } }));
  });

  it("says nobody is here in an empty room", () => {
    assertMatchesRecording("team-empty", renderTeam(projectOf("c:/vazio", "vazio", []), { pendingByAgent: new Map(), outbox: {} }));
  });
});

describe("room page", () => {
  it("shows the room header, the theme picker and the day's numbers, flagging who needs you", () => {
    assertMatchesRecording("office-busy", renderOffice(projectOf("c:/loja", "loja", busyTeam())));
  });

  it("falls back to the first theme and zeroed numbers for an empty room without stats", () => {
    const project = projectOf("c:/vazio", "vazio <novo>", [], { template: "unknown", stats: undefined });
    assertMatchesRecording("office-empty", renderOffice(project));
  });
});

describe("plan usage", () => {
  it("shows both windows, flags high usage and prints the reset as a time today or a date later", () => {
    const usage = { rateLimits: { fiveHour: { usedPercentage: 37.2, resetsAt: NOW + 2 * HOUR }, sevenDay: { usedPercentage: 84.6, resetsAt: NOW + 70 * HOUR } } };
    assertMatchesRecording("usage-both", renderUsage(usage));
  });

  it("shows only the windows it knows about and leaves out a missing reset", () => {
    assertMatchesRecording("usage-weekly", renderUsage({ rateLimits: { sevenDay: { usedPercentage: 12.4, resetsAt: null } } }));
  });

  it("shows nothing before the first usage reading", () => {
    assert.equal(renderUsage(null), "");
    assert.equal(renderUsage({ rateLimits: {} }), "");
  });
});

describe("pending request strip", () => {
  it("offers allow and deny for a permission", () => {
    assertMatchesRecording("pending-strip-permission", renderPendingStrip(permission));
  });

  it("has the card's hidden alert, to say when allow or deny could not be sent", () => {
    const failedDecisionAlert = '<p class="pending-error" role="alert" hidden></p>';
    assert.ok(renderPendingCard(permission, "Caio").includes(failedDecisionAlert));
    assert.ok(renderPendingStrip(permission).includes(failedDecisionAlert));
  });

  it("offers to open the agent to answer a question", () => {
    assertMatchesRecording("pending-strip-question", renderPendingStrip(question));
  });
});

describe("pending request card", () => {
  it("asks for a permission with the command, an optional reason and the time it goes back to the terminal", () => {
    assertMatchesRecording("pending-card-permission", renderPendingCard(permission, "Caio"));
  });

  it("asks each question with its options and a free answer field", () => {
    assertMatchesRecording("pending-card-question", renderPendingCard(question, "Duda <dev>"));
  });
});

describe("agent sheet", () => {
  it("has a composer and live terminal tools for a live session", () => {
    assertMatchesRecording("sheet-live", renderSheetShell({ canReceiveMessages: true, isLive: true }));
  });

  it("has a composer and a read-only history for a session that takes queued messages", () => {
    assertMatchesRecording("sheet-queued", renderSheetShell({ canReceiveMessages: true, isLive: false }));
  });

  it("has only the read-only history for an agent that cannot receive messages", () => {
    assertMatchesRecording("sheet-read-only", renderSheetShell({ canReceiveMessages: false, isLive: false }));
  });

  const identityOf = (agent) => renderAgentIdentity(agent, { mark: agentMark(agent), badge: statusBadge(agent), origin: originOf(agent) });

  it("names a subagent with its role and origin", () => {
    assertMatchesRecording("identity-subagent", identityOf(busyTeam()[1]));
  });

  it("does not repeat the origin when it is also the label", () => {
    assertMatchesRecording("identity-main", identityOf(agentOf("claude:a1")));
  });

  it("marks an agent from an origin named like a built-in of every object as unknown", () => {
    const unknownMark = agentMark(agentOf("shell:x1", { source: "shell" }));
    assert.deepEqual(["toString", "constructor", "__proto__"].map((source) => agentMark(agentOf("x:x1", { source }))), [unknownMark, unknownMark, unknownMark]);
  });

  it("names an agent of unknown origin and status without breaking the markup", () => {
    assertMatchesRecording("identity-unknown", identityOf(agentOf("shell:x1", { source: "shell", status: "mystery", label: "<b>x</b>" })));
  });

  it("lists what the agent is doing, its tool count and when it started and last changed", () => {
    assertMatchesRecording("facts-busy", renderAgentFacts(agentOf("claude:a1")));
  });

  it("fills the facts of an agent with no activity yet", () => {
    assertMatchesRecording("facts-new", renderAgentFacts(agentOf("claude:a1", { action: "", tools: undefined, startedAt: 0, updatedAt: NOW - 2 * DAY })));
  });
});

describe("headquarters agent drawer", () => {
  it("follows the mock-up for a live session: who, what now, follow and interrupt, the live terminal, then the message by name", () => {
    assertMatchesRecording("hq-drawer-live", renderDrawerShell({ agentName: "Heitor <dev>", canReceiveMessages: true, isLive: true, isFollowed: true }));
  });

  it("drops interrupting and says when a message arrives for a session that takes queued messages", () => {
    assertMatchesRecording("hq-drawer-queued", renderDrawerShell({ agentName: "Ana", canReceiveMessages: true, isLive: false, isFollowed: false }));
  });

  it("explains why an agent that cannot receive messages has no message box", () => {
    assertMatchesRecording("hq-drawer-read-only", renderDrawerShell({ agentName: "Ana", canReceiveMessages: false, isLive: false, isFollowed: false }));
  });

  it("names the agent with its role, origin and project", () => {
    const agent = busyTeam()[1];
    assertMatchesRecording("hq-drawer-identity", renderDrawerIdentity(agent, { mark: agentMark(agent), origin: originOf(agent), projectName: "loja <online>" }));
  });

  it("adds the account the agent works on, spelled out", () => {
    const agent = agentOf("claude:a1", { name: "Heitor" });
    const identity = renderDrawerIdentity(agent, { mark: agentMark(agent), origin: originOf(agent), projectName: "orquestra-office", accountLabel: "Pessoal <casa>" });
    assertMatchesRecording("hq-drawer-identity-account", identity);
  });

  it("writes the status out in words with what the agent is doing and since when", () => {
    assertMatchesRecording("hq-drawer-status", renderDrawerStatus(agentOf("claude:a1", { status: "needs_you", action: undefined, actionId: "permission-requested", subject: "Bash" })));
  });

  it("writes an unknown status as free and one tool in the singular", () => {
    assertMatchesRecording("hq-drawer-status-unknown", renderDrawerStatus(agentOf("claude:a1", { status: "mystery", action: "", tools: 1 })));
  });
});

describe("status names", () => {
  it("names each known status", () => {
    assert.deepEqual(["working", "needs_you", "break"].map(describeStatus), ["digitando", "precisa de você", "pausa"]);
  });

  it("names an unknown status as free, even one inherited from the prototype", () => {
    assert.deepEqual(["dancing", "toString", "constructor", undefined].map(describeStatus), ["livre", "livre", "livre", "livre"]);
  });
});

const withFields = (record, fields) => {
  const { action, summary, text, ...rest } = record;
  return { ...rest, ...fields };
};

describe("views fed with fields instead of ready-made text", () => {
  it("show the same team when the actions and the request summary come as fields", () => {
    const [caio, bia, nara, eva] = busyTeam();
    const team = [
      withFields(caio, { actionId: "permission-requested", subject: "Bash" }),
      withFields(bia, { actionId: "reading", subject: "server.js" }),
      withFields(nara, { actionId: null, subject: null }),
      eva,
    ];
    const pendingByAgent = new Map([["claude:c1", withFields(permission, { summaryId: "run-command", subject: "Aplicar as migrações do banco" })]]);
    assertMatchesRecording("team-busy", renderTeam(projectOf("c:/loja", "loja", team), { pendingByAgent, outbox: { "claude:c1": 2 } }));
  });

  it("show the same facts when the action comes as fields", () => {
    assertMatchesRecording("facts-busy", renderAgentFacts(withFields(agentOf("claude:a1"), { actionId: "editing", subject: "office-store.js" })));
    const fresh = withFields(agentOf("claude:a1", { tools: undefined, startedAt: 0, updatedAt: NOW - 2 * DAY }), { actionId: null, subject: null });
    assertMatchesRecording("facts-new", renderAgentFacts(fresh));
  });

  it("show the same request strip and card when the summary comes as fields", () => {
    const permissionFields = withFields(permission, { summaryId: "run-command", subject: "Aplicar as migrações do banco" });
    const questionFields = withFields(question, { summaryId: "ask-question", subject: null });
    assertMatchesRecording("pending-strip-permission", renderPendingStrip(permissionFields));
    assertMatchesRecording("pending-card-permission", renderPendingCard(permissionFields, "Caio"));
    assertMatchesRecording("pending-strip-question", renderPendingStrip(questionFields));
    assertMatchesRecording("pending-card-question", renderPendingCard(questionFields, "Duda <dev>"));
  });
});


describe("headquarters connection", () => {
  it("says whether the page is live, in the demo, connecting or cut off", () => {
    assertMatchesRecording("hq-connection-live", renderConnection("live"));
    assertMatchesRecording("hq-connection-demo", renderConnection("demo"));
    assert.equal(renderConnection("toString"), renderConnection("connecting"));
    assert.ok(renderConnection("offline").includes("sem conexão com o coletor"));
  });
});

describe("headquarters room list", () => {
  const census = {
    total: 8,
    projects: [
      { key: "c:/loja", name: "loja <online>", themeId: "cafe", total: 2, byStatus: [{ status: "needs_you", count: 1 }, { status: "break", count: 1 }] },
      { key: "c:/orquestra", name: "orquestra-office", themeId: "startup", total: 4, byStatus: [{ status: "working", count: 3 }, { status: "idle", count: 1 }] },
      { key: "c:/vazio", name: "vazio", themeId: "unknown", total: 0, byStatus: [] },
    ],
    areas: [{ id: "meeting", name: "Sala de reuniões", count: 0 }, { id: "pantry", name: "Copa", count: 2 }],
  };

  it("lists the whole building, each project with its most urgent status spelled out, and the common rooms", () => {
    assertMatchesRecording("hq-room-list", renderAreaList(census));
  });

  it("says no project is open yet", () => {
    assertMatchesRecording("hq-room-list-empty", renderAreaList({ total: 0, projects: [], areas: census.areas }));
  });

  it("marks as current the room the camera went to, and none after the camera is moved by hand", () => {
    const currentOf = (html) => [...html.matchAll(/data-(project|area|frame)="([^"]+)" aria-current="true"/g)].map(([, kind, id]) => `${kind}:${id}`);
    assert.deepEqual(currentOf(renderAreaList(census)), ["frame:whole"]);
    assert.deepEqual(currentOf(renderAreaList(census, { kind: "project", id: "c:/orquestra" })), ["project:c:/orquestra"]);
    assert.deepEqual(currentOf(renderAreaList(census, { kind: "area", id: "pantry" })), ["area:pantry"]);
    assert.deepEqual(currentOf(renderAreaList(census, null)), []);
  });
});

describe("headquarters search results", () => {
  const results = {
    agentGroups: [
      { room: "loja <online>", agents: [{ key: "claude:v", name: "Vitor", label: "Claude Code", room: "loja <online>", status: "needs_you", doing: "pede permissão para usar Bash" }] },
      { room: "orquestra-office", agents: [{ key: "codex:l", name: "Lívia", label: "Codex", room: "orquestra-office", status: "waiting", doing: "" }] },
    ],
    rooms: [{ id: "c:/loja", kind: "project", name: "loja <online>" }, { id: "pantry", kind: "area", name: "Copa" }],
    actions: [{ id: "go-to-request", label: "Ir para o pedido" }],
  };

  it("groups the agents by room with the status in words, then the rooms and the actions, numbered in order", () => {
    assertMatchesRecording("hq-search-results", renderSearchResults(results));
  });

  it("says nothing was found and how to search instead of an empty list", () => {
    assert.match(renderSearchResults({ agentGroups: [], rooms: [], actions: [] }), /Nada encontrado/);
    assert.deepEqual([0, 1, 7].map(resultCountText), ["Nenhum resultado", "1 resultado", "7 resultados"]);
  });
});

describe("headquarters camera controls", () => {
  it("has the minimap hidden from screen readers, zoom in and out, framing the whole building and room to say who is followed", () => {
    assertMatchesRecording("hq-camera", renderCameraControls());
  });

  it("says who the camera follows, with a button to stop, and announces when it stops", () => {
    assertMatchesRecording("hq-camera-following", renderFollowing("Heitor <dev>"));
    assert.equal(followingStoppedText("Heitor"), "A câmera parou de seguir Heitor.");
  });
});

describe("headquarters island sheet", () => {
  const island = () => islandFacts(projectOf("c:/loja", "loja <online>", busyTeam()));

  it("has the team, the day, the seven themes, a new session in the folder and closing the room", () => {
    assertMatchesRecording("hq-island-shell", renderIslandShell());
  });

  it("names the island with its folder and theme", () => {
    assertMatchesRecording("hq-island-identity", renderIslandIdentity(island()));
  });

  it("spells out the day's numbers, flagging who needs you", () => {
    assertMatchesRecording("hq-island-day", renderIslandDay(island().day));
  });

  it("lists who is on the island with the status in words, the most urgent first", () => {
    assertMatchesRecording("hq-island-team", renderIslandTeam(island().team));
  });

  it("shows next to the person how many messages wait in their queue, and nothing for whoever has none", () => {
    const team = islandFacts(projectOf("c:/loja", "loja <online>", busyTeam()), { "claude:c1": 2 }).team;
    const html = renderIslandTeam(team);
    const caio = html.split("</li>").find((item) => item.includes("<b>Caio</b>"));
    assert.match(caio, /<span class="hq-member-status">Precisa de você agora<\/span>\s*<span class="hq-member-queue">2 na fila<\/span>/);
    assert.equal(html.match(/hq-member-queue/g).length, 1);
  });

  it("says nobody works on an empty island and how the team shows up", () => {
    assert.match(renderIslandTeam([]), /Ninguém trabalhando aqui agora/);
  });
});

describe("headquarters legend", () => {
  it("explains every status color in words", () => {
    assertMatchesRecording("hq-legend", renderLegend());
  });
});

describe("headquarters accounts", () => {
  const reading = (fiveHour, sevenDay) => ({
    fiveHour: { usedPercentage: fiveHour, resetsAt: NOW + 2 * HOUR }, sevenDay: { usedPercentage: sevenDay, resetsAt: NOW + 70 * HOUR },
  });

  it("shows a ring per account with each window as a meter, flagging the high ones", () => {
    const accounts = {
      b: { id: "b", label: "Trabalho", rateLimits: reading(12, 41), updatedAt: NOW },
      a: { id: "a", label: "Pessoal <casa>", rateLimits: reading(37, 84), updatedAt: NOW },
      c: { id: "c", label: "nova", rateLimits: null, updatedAt: NOW },
    };
    assertMatchesRecording("hq-accounts", renderAccounts(accountUsage({ accounts })));
  });

  it("says there is no reading yet instead of inventing one", () => {
    assertMatchesRecording("hq-accounts-empty", renderAccounts(accountUsage({ accounts: null, usage: null })));
  });
});

describe("headquarters day", () => {
  const slotAt = (hour, extra) => ({
    start: Date.UTC(2026, 10, 18, hour), workingMs: 0, workingAgentMs: 0, needsYouMs: 0, needsYouAgentMs: 0, needsYouCount: 0, costUsd: 0, ...extra,
  });

  it("sums the day, draws a bar per hour with the marks and the current time, and keeps a table for screen readers", () => {
    const timeline = {
      slotMs: HOUR,
      slots: [
        slotAt(9, { workingMs: 40 * MINUTE, workingAgentMs: HOUR, costUsd: 2.5 }),
        slotAt(11, { workingMs: HOUR, workingAgentMs: 2 * HOUR, needsYouMs: 4 * MINUTE, needsYouAgentMs: 4 * MINUTE, needsYouCount: 1, costUsd: 4.25 }),
      ],
      open: { since: NOW - 10 * MINUTE, working: 1, needsYou: 0 },
    };
    assertMatchesRecording("hq-day", renderDayTimeline(dayTimeline(timeline, { now: NOW, dayStart: Date.UTC(2026, 10, 18) })));
  });

  it("says the collector does not send the day yet", () => {
    assertMatchesRecording("hq-day-empty", renderDayTimeline(null));
  });
});

describe("headquarters request alert", () => {
  const vitor = { name: "Vitor", projectName: "loja <online>" };

  it("says who asks, where, what for, and which of the waiting requests this is, with arrows between them", () => {
    assertMatchesRecording("hq-alert-head", renderAlertHead({ requester: vitor, intent: "quer rodar um comando", position: 1, total: 3, previousId: null, nextId: "b" }));
  });

  it("leaves out the arrows for a single request and names an agent that is gone", () => {
    assertMatchesRecording("hq-alert-head-single", renderAlertHead({ requester: null, intent: "tem uma pergunta", position: 1, total: 1, previousId: null, nextId: null }));
  });

  it("shows the command with allow and deny and their keys, the way back to the terminal and the error to fill when sending fails", () => {
    assertMatchesRecording("hq-alert-command", renderAlertBody(withFields(permission, { summaryId: "run-command", subject: "Aplicar as migrações <db>" })));
  });

  it("shows what a tool without a command wants", () => {
    const edit = { ...permission, id: "req-edit", toolName: "Edit", detail: "", summaryId: "edit-file", subject: "people.js" };
    assertMatchesRecording("hq-alert-tool", renderAlertBody(edit));
  });

  it("sends a question to the drawer of the agent who asks, where the room's card answers it", () => {
    assertMatchesRecording("hq-alert-question", renderAlertBody({ ...question, agentKey: "claude:<d1>" }));
  });

  it("counts down in minutes and seconds, and says when the request is going back", () => {
    assert.deepEqual([112_000, 59_001, 0, -5, null].map(countdownText), [
      "volta ao terminal em 1:52", "volta ao terminal em 1:00", "voltando ao terminal", "voltando ao terminal", "sem prazo para voltar ao terminal",
    ]);
  });

  it("announces who asks, in a sentence a screen reader can say", () => {
    assert.equal(arrivalText(vitor, "quer rodar um comando"), "Vitor, em loja <online>, quer rodar um comando.");
    assert.equal(arrivalText(null, "tem uma pergunta"), "Um agente tem uma pergunta.");
    assert.equal(arrivalsText([{ requester: vitor, intent: "quer rodar um comando" }, { requester: null, intent: "tem uma pergunta" }]), "2 pedidos novos. Vitor, em loja <online>, quer rodar um comando.");
    assert.equal(warningText(vitor), "Faltam 30 segundos para o pedido de Vitor voltar ao terminal.");
    assert.deepEqual([0, 1, 3].map(requestsButtonLabel), ["Pedidos: nenhum esperando você", "Pedidos: 1 esperando você", "Pedidos: 3 esperando você"]);
  });
});
