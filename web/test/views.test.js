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
import { renderAgentFacts, renderAgentIdentity, renderSheetShell } from "../scripts/view/sheet/agent-sheet-view.js";
import { renderPendingCard, renderPendingStrip } from "../scripts/view/sheet/pending-request-view.js";

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

