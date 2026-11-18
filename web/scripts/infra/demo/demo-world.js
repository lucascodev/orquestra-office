const MIN = 60_000;
const HOUR = 60 * MIN;
const ORQUESTRA = "c:/projetos/orquestra";

function agent(key, label, status, action, minutesAgo, extra = {}) {
  const at = Date.now() - minutesAgo * MIN;
  return {
    key, label, status, action, source: "claude", kind: "main", parentKey: null,
    startedAt: at - 40 * MIN, updatedAt: at, endedAt: null, tools: 12 + (key.length % 30),
    log: [
      { at: at - 9 * MIN, text: "recebeu um pedido seu" },
      { at: at - 6 * MIN, text: "lendo README.md" },
      { at: at - 3 * MIN, text: "rodando npm" },
      { at, text: action },
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

const SHOWCASE = "c:/projetos/demo/reacoes";
const WALKER = "claude:r-walker";
const SHOWCASE_CAST = [
  ["digitando código", "working", "editing", "editando room-layout.js"],
  ["lendo um arquivo", "reviewing", "reading", "lendo README.md"],
  ["pesquisando na web", "reviewing", "web", "pesquisando na web"],
  ["rodando um comando", "working", "terminal", "rodando npm"],
  ["pensando", "working", "thinking", "recebeu um pedido seu"],
  ["delegando", "working", "delegating", "delegou para code-reviewer"],
  ["organizando tarefas", "working", "planning", "atualizou a lista de tarefas"],
  ["ferramenta falhou", "working", "failed", "falhou ao usar Bash"],
  ["pedindo permissão", "needs_you", "terminal", "pede permissão para usar Bash"],
  ["com uma pergunta", "needs_you", "asking", "tem uma pergunta para você"],
  ["esperando você", "waiting", null, "esperando sua resposta"],
  ["bloqueado", "blocked", null, "parou por erro da API"],
  ["em pausa", "break", null, "terminou o turno"],
  ["em pausa", "break", null, "terminou o turno"],
  ["em pausa", "break", null, "terminou o turno"],
  ["livre", "idle", null, "sem tarefa no momento"],
  ["livre", "idle", null, "sem tarefa no momento"],
  ["livre", "idle", null, "sem tarefa no momento"],
  ["livre", "idle", null, "sem tarefa no momento"],
];
const WALKER_ROUTINE = [
  ["working", "editing", "editando people.js"], ["working", "terminal", "rodando npm"], ["break", null, "terminou o turno"],
  ["break", null, "terminou o turno"], ["idle", null, "sem tarefa no momento"], ["idle", null, "sem tarefa no momento"],
  ["working", "thinking", "recebeu um pedido seu"],
];

function showcaseProject() {
  const cast = SHOWCASE_CAST.map(([label, status, doing, action], i) => agent(`claude:r${String(i).padStart(2, "0")}`, label, status, action, 1 + i, { activity: doing }));
  const walker = agent(WALKER, "andando pela sala", "working", "editando people.js", 0, { activity: "editing" });
  return project(SHOWCASE, "reações", "startup", 0, [...cast, walker]);
}

function pendingRequests() {
  const now = Date.now();
  const hold = { createdAt: now, expiresAt: now + 2 * MIN };
  return [
    { ...hold, id: "demo-permission", kind: "permission", agentKey: "claude:c1", toolName: "Bash", summary: "Aplicar as migrações do banco", detail: "npx prisma migrate deploy" },
    { ...hold, id: "demo-question", kind: "question", agentKey: "claude:d1", toolName: "AskUserQuestion", summary: "Tem uma pergunta para você", detail: "",
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
  const sub = (parent, id, label, status, action, minutesAgo) =>
    agent(`${parent}:${id}`, label, status, action, minutesAgo, { kind: "subagent", parentKey: parent });
  return {
    pending: pendingRequests(),
    outbox: {},
    runner: { isAvailable: true, sessions: [{ id: "demo-live", sessionId: "a1", cwd: ORQUESTRA, status: "working" }] },
    usage: { updatedAt: Date.now(), rateLimits: { fiveHour: { usedPercentage: 37, resetsAt: Date.now() + 2 * HOUR }, sevenDay: { usedPercentage: 84, resetsAt: Date.now() + 70 * HOUR } } },
    projects: {
      [SHOWCASE]: showcaseProject(),
      [ORQUESTRA]: project(ORQUESTRA, "orquestra", "startup", 0, [
        agent("claude:a1", "Claude Code", "working", "editando office-store.js", 0),
        sub("claude:a1", "s1", "code-reviewer", "reviewing", "lendo server.js", 1),
        sub("claude:a1", "s2", "security-engineer", "reviewing", "procurando no código", 2),
        agent("codex:b1", "Codex", "waiting", "terminou o turno e espera você", 4, { source: "codex" }),
      ], ["code-reviewer", "security-engineer", "test-engineer", "tech-writer", "board-keeper"]),
      "c:/projetos/loja-online": project("c:/projetos/loja-online", "loja-online", "cafe", 3, [
        agent("claude:c1", "Claude Code", "needs_you", "pede permissão para usar Bash", 1),
        sub("claude:c1", "s3", "Explore", "break", "entregou a tarefa", 6),
      ]),
      "c:/projetos/jogo-de-plataforma": project("c:/projetos/jogo-de-plataforma", "jogo-de-plataforma", "fliperama", 12, [
        agent("claude:d1", "Claude Code", "needs_you", "tem uma pergunta para você", 2),
        agent("claude:d2", "Claude Code 2", "blocked", "parou por erro da API", 15),
      ]),
      "c:/projetos/site-institucional": project("c:/projetos/site-institucional", "site-institucional", "jardim", 40, [
        agent("claude:e1", "Claude Code", "idle", "fechou a sessão", 40),
      ]),
    },
  };
}

const CYCLE = [
  ["working", "editing", "editando office-view.js"], ["reviewing", "reading", "lendo templates.js"], ["working", "terminal", "rodando node"],
  ["working", "planning", "atualizou a lista de tarefas"], ["working", "thinking", "recebeu um pedido seu"],
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
    const helper = agent(HELPER_KEY, "test-engineer", "working", "começou a tarefa", 0, { kind: "subagent", parentKey: "claude:a1", activity: "editing" });
    project.agents = { ...project.agents, [HELPER_KEY]: { ...helper, startedAt: now } };
    return;
  }
  const helper = project.agents[HELPER_KEY];
  if (!helper) return;
  if (tick === HELPER_ENDS_AT_TICK) {
    act(helper, "break", "entregou a tarefa");
    helper.endedAt = now;
  }
  if (tick === HELPER_LEAVES_AT_TICK) {
    project.agents = Object.fromEntries(Object.entries(project.agents).filter(([key]) => key !== HELPER_KEY));
  }
}

function act(agentToUpdate, status, action, doing = agentToUpdate.activity) {
  agentToUpdate.status = status;
  agentToUpdate.activity = doing;
  agentToUpdate.action = action;
  agentToUpdate.updatedAt = Date.now();
  agentToUpdate.log = [...agentToUpdate.log, { at: agentToUpdate.updatedAt, text: action }].slice(-20);
}

export function tickDemo(state, step) {
  const main = state.projects[ORQUESTRA]?.agents["claude:a1"];
  if (main) {
    const [status, doing, action] = CYCLE[step % CYCLE.length];
    act(main, status, action, doing);
  }
  if (state.projects[ORQUESTRA]) cycleHelper(state.projects[ORQUESTRA], step);
  const walker = state.projects[SHOWCASE]?.agents[WALKER];
  if (walker && step % WALKER_TICKS_PER_STEP === 0) {
    const [status, doing, action] = WALKER_ROUTINE[(step / WALKER_TICKS_PER_STEP) % WALKER_ROUTINE.length];
    act(walker, status, action, doing);
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
  const outcome = body.answers ? "você respondeu pelo escritório" : `você ${body.behavior === "allow" ? "aprovou" : "recusou"} ${request.toolName} pelo escritório`;
  act(target, "working", outcome);
  return true;
}

export function queueDemoMessage(state, agentKey) {
  state.outbox = { ...state.outbox, [agentKey]: (state.outbox[agentKey] ?? 0) + 1 };
  return true;
}
