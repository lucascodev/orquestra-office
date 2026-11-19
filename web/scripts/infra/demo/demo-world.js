import { PERSONAL_ACCOUNT, WORK_ACCOUNT } from "./demo-accounts.js";

const MIN = 60_000;
const HOUR = 60 * MIN;
const ORQUESTRA = "c:/projetos/orquestra";

const did = (actionId, subject = null) => ({ actionId, subject });

function agent(key, label, status, doing, minutesAgo, extra = {}) {
  const at = Date.now() - minutesAgo * MIN;
  return {
    key, label, status, ...doing, source: "claude", kind: "main", parentKey: null,
    startedAt: at - 40 * MIN, updatedAt: at, endedAt: null, tools: 12 + (key.length % 30),
    log: [
      { at: at - 9 * MIN, ...did("prompt-received") },
      { at: at - 6 * MIN, ...did("reading", "README.md") },
      { at: at - 3 * MIN, ...did("running", "npm") },
      { at, ...doing },
    ],
    ...extra,
  };
}

function project(key, name, template, minutesAgo, agents, team = []) {
  return {
    key, name, template, team, createdAt: 0, updatedAt: Date.now() - minutesAgo * MIN,
    stats: { prompts: 4 + agents.length, tools: 30 + agents.length * 17, turns: 3 + agents.length, tokens: 184_000 * agents.length, costUsd: 1.37 * agents.length },
    agents: Object.fromEntries(agents.map((a) => [a.key, a])),
  };
}

// The Claude Code sessions of a folder and their subagents run on the account installed there; Codex has no Claude account.
const onAccount = (account, agents) => agents.map((a) => (a.source === "claude" ? { ...a, accountId: account.id } : a));

const SHOWCASE = "c:/projetos/demo/reacoes";
const WALKER = "claude:r-walker";
const NO_TASK = did("no-task");
const TURN_FINISHED = did("turn-finished");
const SHOWCASE_CAST = [
  ["digitando código", "working", "editing", did("editing", "room-layout.js")],
  ["lendo um arquivo", "reviewing", "reading", did("reading", "README.md")],
  ["pesquisando na web", "reviewing", "web", did("searching-web")],
  ["rodando um comando", "working", "terminal", did("running", "npm")],
  ["pensando", "working", "thinking", did("prompt-received")],
  ["delegando", "working", "delegating", did("delegating", "code-reviewer")],
  ["organizando tarefas", "working", "planning", did("updating-todos")],
  ["ferramenta falhou", "working", "failed", did("tool-failed", "Bash")],
  ["pedindo permissão", "needs_you", "terminal", did("permission-requested", "Bash")],
  ["com uma pergunta", "needs_you", "asking", did("asking-question")],
  ["esperando você", "waiting", null, did("waiting-for-reply")],
  ["bloqueado", "blocked", null, did("api-error")],
  ["em pausa", "break", null, TURN_FINISHED],
  ["em pausa", "break", null, TURN_FINISHED],
  ["em pausa", "break", null, TURN_FINISHED],
  ["livre", "idle", null, NO_TASK],
  ["livre", "idle", null, NO_TASK],
  ["livre", "idle", null, NO_TASK],
  ["livre", "idle", null, NO_TASK],
];
const WALKER_ROUTINE = [
  ["working", "editing", did("editing", "people.js")], ["working", "terminal", did("running", "npm")], ["break", null, TURN_FINISHED],
  ["break", null, TURN_FINISHED], ["idle", null, NO_TASK], ["idle", null, NO_TASK],
  ["working", "thinking", did("prompt-received")],
];

function showcaseProject() {
  const cast = SHOWCASE_CAST.map(([label, status, activity, doing], i) => agent(`claude:r${String(i).padStart(2, "0")}`, label, status, doing, 1 + i, { activity }));
  const walker = agent(WALKER, "andando pela sala", "working", did("editing", "people.js"), 0, { activity: "editing" });
  return project(SHOWCASE, "reações", "startup", 0, [...cast, walker]);
}

function pendingRequests() {
  const now = Date.now();
  const hold = { createdAt: now, expiresAt: now + 2 * MIN };
  return [
    { ...hold, id: "demo-permission", kind: "permission", agentKey: "claude:c1", toolName: "Bash", summaryId: "run-command", subject: "Aplicar as migrações do banco", detail: "npx prisma migrate deploy" },
    { ...hold, id: "demo-question", kind: "question", agentKey: "claude:d1", toolName: "AskUserQuestion", summaryId: "ask-question", subject: null, detail: "",
      questions: [{
        question: "Qual motor de física usar no protótipo?", header: "Física", multiSelect: false,
        options: [
          { label: "Rapier", description: "Rápido e determinístico, bom para replays." },
          { label: "Física própria", description: "Menos dependências, mais trabalho." },
        ],
      }] },
  ];
}

export function demoState() {
  const sub = (parent, id, label, status, doing, minutesAgo) =>
    agent(`${parent}:${id}`, label, status, doing, minutesAgo, { kind: "subagent", parentKey: parent });
  return {
    pending: pendingRequests(),
    outbox: {},
    runner: { isAvailable: true, sessions: [{ id: "demo-live", sessionId: "a1", cwd: ORQUESTRA, status: "working" }] },
    usage: { updatedAt: Date.now(), rateLimits: { fiveHour: { usedPercentage: 37, resetsAt: Date.now() + 2 * HOUR }, sevenDay: { usedPercentage: 84, resetsAt: Date.now() + 70 * HOUR } } },
    projects: {
      [SHOWCASE]: showcaseProject(),
      [ORQUESTRA]: project(ORQUESTRA, "orquestra", "startup", 0, onAccount(PERSONAL_ACCOUNT, [
        agent("claude:a1", "Claude Code", "working", did("editing", "office-store.js"), 0),
        sub("claude:a1", "s1", "code-reviewer", "reviewing", did("reading", "server.js"), 1),
        sub("claude:a1", "s2", "security-engineer", "reviewing", did("reading"), 2),
        agent("codex:b1", "Codex", "waiting", did("turn-finished-waiting"), 4, { source: "codex" }),
      ]), ["code-reviewer", "security-engineer", "test-engineer", "tech-writer", "board-keeper"]),
      "c:/projetos/loja-online": project("c:/projetos/loja-online", "loja-online", "cafe", 3, onAccount(WORK_ACCOUNT, [
        agent("claude:c1", "Claude Code", "needs_you", did("permission-requested", "Bash"), 1),
        sub("claude:c1", "s3", "Explore", "break", did("task-delivered"), 6),
      ])),
      "c:/projetos/jogo-de-plataforma": project("c:/projetos/jogo-de-plataforma", "jogo-de-plataforma", "fliperama", 12, onAccount(PERSONAL_ACCOUNT, [
        agent("claude:d1", "Claude Code", "needs_you", did("asking-question"), 2),
        agent("claude:d2", "Claude Code 2", "blocked", did("api-error"), 15),
      ])),
      "c:/projetos/site-institucional": project("c:/projetos/site-institucional", "site-institucional", "jardim", 40, onAccount(WORK_ACCOUNT, [
        agent("claude:e1", "Claude Code", "idle", did("session-closed"), 40),
      ])),
    },
  };
}

const CYCLE = [
  ["working", "editing", did("editing", "office-view.js")], ["reviewing", "reading", did("reading", "templates.js")], ["working", "terminal", did("running", "node")],
  ["working", "planning", did("updating-todos")], ["working", "thinking", did("prompt-received")],
];
const WALKER_TICKS_PER_STEP = 3;
const HELPER_KEY = "claude:a1:s9";
const HELPER_CYCLE_TICKS = 16;
const HELPER_ENDS_AT_TICK = 6;
const HELPER_LEAVES_AT_TICK = 12;

function cycleHelper(project, step) {
  const tick = step % HELPER_CYCLE_TICKS;
  const now = Date.now();
  if (tick === 0) {
    const helper = agent(HELPER_KEY, "test-engineer", "working", did("task-started"), 0, {
      kind: "subagent", parentKey: "claude:a1", activity: "editing", accountId: PERSONAL_ACCOUNT.id,
    });
    project.agents = { ...project.agents, [HELPER_KEY]: { ...helper, startedAt: now } };
    return;
  }
  const helper = project.agents[HELPER_KEY];
  if (!helper) return;
  if (tick === HELPER_ENDS_AT_TICK) {
    act(helper, "break", did("task-delivered"));
    helper.endedAt = now;
  }
  if (tick === HELPER_LEAVES_AT_TICK) {
    project.agents = Object.fromEntries(Object.entries(project.agents).filter(([key]) => key !== HELPER_KEY));
  }
}

function act(agentToUpdate, status, { actionId, subject }, activity = agentToUpdate.activity) {
  agentToUpdate.status = status;
  agentToUpdate.activity = activity;
  agentToUpdate.actionId = actionId;
  agentToUpdate.subject = subject;
  agentToUpdate.updatedAt = Date.now();
  agentToUpdate.log = [...agentToUpdate.log, { at: agentToUpdate.updatedAt, actionId, subject }].slice(-20);
}

export function tickDemo(state, step) {
  const main = state.projects[ORQUESTRA]?.agents["claude:a1"];
  if (main) {
    const [status, activity, doing] = CYCLE[step % CYCLE.length];
    act(main, status, doing, activity);
  }
  if (state.projects[ORQUESTRA]) cycleHelper(state.projects[ORQUESTRA], step);
  const walker = state.projects[SHOWCASE]?.agents[WALKER];
  if (walker && step % WALKER_TICKS_PER_STEP === 0) {
    const [status, activity, doing] = WALKER_ROUTINE[(step / WALKER_TICKS_PER_STEP) % WALKER_ROUTINE.length];
    act(walker, status, doing, activity);
  }
}

function findAgent(state, agentKey) {
  return Object.values(state.projects).map((p) => p.agents[agentKey]).find(Boolean) ?? null;
}

export function resolveDemoRequest(state, id, body) {
  const request = state.pending.find((item) => item.id === id);
  if (!request) return false;
  state.pending = state.pending.filter((item) => item.id !== id);
  const target = findAgent(state, request.agentKey);
  if (!target || body.behavior === "terminal") return true;
  const outcome = body.answers ? did("question-answered") : did(body.behavior === "allow" ? "permission-approved" : "permission-denied", request.toolName);
  act(target, "working", outcome);
  return true;
}

export function queueDemoMessage(state, agentKey) {
  state.outbox = { ...state.outbox, [agentKey]: (state.outbox[agentKey] ?? 0) + 1 };
  return true;
}
