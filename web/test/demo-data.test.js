import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AGENT_ACTIONS } from "../scripts/data/text/pt-br/agent-actions.js";
import { TERMINAL_NOTES } from "../scripts/data/text/pt-br/terminal-notes.js";
import { TOOL_SUMMARIES } from "../scripts/data/text/pt-br/tool-summaries.js";
import { createFreeTimeClock } from "../scripts/domain/behavior/free-time-clock.js";
import { placeAgents } from "../scripts/domain/behavior/room-places.js";
import { layoutHeadquarters } from "../scripts/domain/headquarters/headquarters-layout.js";
import { headquartersSpots } from "../scripts/domain/headquarters/headquarters-spots.js";
import { agentActionText, logEntryText } from "../scripts/domain/office/agent-action-text.js";
import { terminalEntryText } from "../scripts/domain/terminal/terminal-entry-text.js";
import { describeToolEntry } from "../scripts/domain/terminal/terminal-format.js";
import { toolSummaryText } from "../scripts/domain/terminal/tool-summary-text.js";
import { checklistProgress } from "../scripts/domain/work-sheet/checklist-progress.js";
import { planDocument } from "../scripts/domain/work-sheet/plan-document.js";
import { planOfRequest } from "../scripts/domain/work-sheet/plan-request.js";
import { planStatus } from "../scripts/domain/work-sheet/plan-status.js";
import { testsOverview } from "../scripts/domain/work-sheet/tests-overview.js";
import { demoPlanDocument } from "../scripts/infra/demo/demo-plans.js";
import { createDemoAsker } from "../scripts/infra/demo/demo-requests.js";
import { demoStressState } from "../scripts/infra/demo/demo-stress.js";
import { demoHistory } from "../scripts/infra/demo/demo-terminal.js";
import { demoState, resolveDemoRequest, tickDemo } from "../scripts/infra/demo/demo-world.js";

const TICKS = 40;
const SHOWCASE = "c:/projetos/demo/reacoes";
const isKnownAction = (actionId) => Object.hasOwn(AGENT_ACTIONS, actionId);

function playedDemo() {
  const state = demoState();
  for (let step = 0; step < TICKS; step += 1) tickDemo(state, step);
  resolveDemoRequest(state, "demo-permission", { behavior: "allow" });
  resolveDemoRequest(state, "demo-question", { answers: { "Qual motor de física usar no protótipo?": "Rapier" } });
  return state;
}

const agentsOf = (state) => Object.values(state.projects).flatMap((project) => Object.values(project.agents));

describe("the demonstration", () => {
  it("names every action with an id the page knows, without ready-made text, even after playing for a while", () => {
    for (const state of [demoState(), playedDemo()]) {
      for (const agent of agentsOf(state)) {
        assert.ok(isKnownAction(agent.actionId), `${agent.key}: ${agent.actionId}`);
        assert.equal(agent.action, undefined);
        for (const entry of agent.log) {
          assert.ok(isKnownAction(entry.actionId), `${agent.key} log: ${entry.actionId}`);
          assert.equal(entry.text, undefined);
        }
      }
    }
  });

  it("shows the same actions it showed when they were written as text", () => {
    const showcase = Object.values(demoState().projects[SHOWCASE].agents).map(agentActionText);
    assert.deepEqual(showcase, [
      "editando room-layout.js", "lendo README.md", "pesquisando na web", "rodando npm", "recebeu um pedido seu", "delegou para code-reviewer",
      "atualizou a lista de tarefas", "falhou ao usar Bash", "pede permissão para usar Bash", "tem uma pergunta para você", "esperando sua resposta",
      "parou por erro da API", "terminou o turno", "terminou o turno", "terminou o turno", "sem tarefa no momento", "sem tarefa no momento",
      "sem tarefa no momento", "sem tarefa no momento", "editando people.js",
    ]);
    const [agent] = Object.values(demoState().projects[SHOWCASE].agents);
    assert.deepEqual(agent.log.map(logEntryText), ["recebeu um pedido seu", "lendo README.md", "rodando npm", "editando room-layout.js"]);
  });

  it("notes a decision taken in the demonstration the way the collector does", () => {
    const agents = Object.fromEntries(agentsOf(playedDemo()).map((agent) => [agent.key, agent]));
    assert.equal(agentActionText(agents["claude:c1"]), "você aprovou Bash pelo escritório");
    assert.equal(agentActionText(agents["claude:d1"]), "você respondeu pelo escritório");
  });

  it("summarizes its pending requests with ids the page knows", () => {
    const requests = demoState().pending;
    for (const request of requests) {
      assert.ok(Object.hasOwn(TOOL_SUMMARIES, request.summaryId));
      assert.equal(request.summary, undefined);
    }
    assert.deepEqual(requests.map((request) => toolSummaryText(request)), ["Aplicar as migrações do banco", "Tem uma pergunta para você", "Usar ExitPlanMode"]);
  });

  it("writes its terminal from fields, with the same lines as before", () => {
    const target = { updatedAt: 0, actionId: "editing", subject: "server.js" };
    const entries = demoHistory(target);
    const tools = entries.filter((entry) => entry.kind === "tool");
    for (const entry of tools) assert.equal(entry.text, undefined);
    assert.deepEqual(tools.map((entry) => { const tool = describeToolEntry(entry); return `${tool.toolName}: ${tool.summary}`; }),
      ["Read: Ler server.test.js", "Bash: Rodar os testes", "Edit: Editar server.test.js", "Write: Escrever test/paths.js"]);
    const error = entries.find((entry) => entry.kind === "error");
    assert.ok(Object.hasOwn(TERMINAL_NOTES, error.textId));
    assert.equal(terminalEntryText(error), "Bash falhou");
    assert.equal(terminalEntryText(entries.at(-1)), "editando server.js");
  });
});

describe("the stress scene", () => {
  const STRESS_PROJECTS = 12;
  const STRESS_AGENTS = 60;

  it("fills the headquarters with as many projects and agents as it is designed for", () => {
    const state = demoStressState();
    const agents = agentsOf(state);
    assert.equal(Object.keys(state.projects).length, STRESS_PROJECTS);
    assert.equal(agents.length, STRESS_AGENTS);
    assert.equal(new Set(agents.map((agent) => agent.key)).size, STRESS_AGENTS);
    assert.ok(agents.some((agent) => agent.kind === "subagent"));
    for (const agent of agents) assert.ok(Object.hasOwn(AGENT_ACTIONS, agent.actionId), `${agent.key}: ${agent.actionId}`);
  });

  it("gives every project its own island and everybody somewhere to be, at a desk or on free time", () => {
    const state = demoStressState();
    const agents = agentsOf(state);
    const layout = layoutHeadquarters(state.projects);
    const ownedIslands = layout.islands.filter((island) => island.projectKey);
    assert.equal(new Set(ownedIslands.map((island) => island.projectKey)).size, STRESS_PROJECTS);
    const places = placeAgents({ agents, now: Date.now(), spots: headquartersSpots(layout), freeSince: createFreeTimeClock()(agents) });
    const stops = agents.map((agent) => places.get(agent.key)?.stop).filter(Boolean);
    assert.equal(stops.length, STRESS_AGENTS);
    assert.ok(stops.some((stop) => stop.isDesk) && stops.some((stop) => !stop.isDesk));
  });
});

describe("demo requests in the headquarters", () => {
  const TICK_MS = 4_000;

  it("asks again a few ticks after a request is decided, with a new id and the agent waiting for you", () => {
    const state = demoState();
    const start = state.pending[0].createdAt;
    const askAgain = createDemoAsker(state.pending);
    resolveDemoRequest(state, "demo-permission", { behavior: "allow" });
    for (let tick = 1; tick <= 2; tick += 1) askAgain(state, start + tick * TICK_MS);
    assert.deepEqual(state.pending.map((request) => request.id), ["demo-question", "demo-plan"]);
    askAgain(state, start + 3 * TICK_MS);
    const asked = state.pending.find((request) => request.agentKey === "claude:c1");
    assert.equal(asked.id, "demo-permission-1");
    assert.equal(asked.expiresAt, start + 3 * TICK_MS + 2 * 60_000);
    const agent = state.projects["c:/projetos/loja-online"].agents["claude:c1"];
    assert.deepEqual([agent.status, agent.actionId, agent.subject], ["needs_you", "permission-requested", "Bash"]);
  });

  it("sends an expired request back to the terminal before asking again", () => {
    const state = demoState();
    const askAgain = createDemoAsker(state.pending);
    const afterDeadline = Math.max(...state.pending.map((request) => request.expiresAt)) + 1;
    askAgain(state, afterDeadline);
    assert.deepEqual(state.pending, []);
  });
});

describe("checklist, plan and tests in the demonstration", () => {
  const MAIN = "claude:a1";
  const RUNNER = "claude:d2";
  const PLANNER = "claude:e2";
  const agentByKey = (state) => Object.fromEntries(agentsOf(state).map((agent) => [agent.key, agent]));

  it("gives the agents a list, a plan and tests as the collector sends them, and none to Codex", () => {
    const agents = agentByKey(demoState());
    assert.deepEqual(checklistProgress(agents[MAIN].checklist).current.position, 5);
    assert.equal(planStatus(agents[MAIN].plan).state, "approved");
    assert.equal(agents[MAIN].plan.text, undefined);
    assert.equal(testsOverview(agents["claude:c1"].tests).lastRun.verdict, "failed");
    assert.equal(planStatus(agents[PLANNER].plan).state, "proposed");
    assert.equal(agents["codex:b1"].checklist, undefined);
  });

  it("notes approved plans and finished rounds in the log the timeline reads", () => {
    const actions = agentsOf(demoState()).flatMap((agent) => agent.log.map((entry) => entry.actionId));
    for (const actionId of ["plan-approved", "tests-passed", "tests-failed"]) assert.ok(actions.includes(actionId), actionId);
  });

  it("sends the plan inside its request and answers the plan route with the text of the version shown", () => {
    const state = demoState();
    const request = state.pending.find((pending) => pending.id === "demo-plan");
    assert.equal(planOfRequest(request).isTruncated, false);
    const fetched = planDocument(demoPlanDocument(agentByKey(state)[PLANNER]));
    assert.equal(fetched.text, request.plan);
    assert.deepEqual(demoPlanDocument(agentByKey(state)["claude:d1"]), { plan: null });
  });

  it("approves the plan by the alert, noting it in the log, and asks for the next version later", () => {
    const state = demoState();
    const start = Date.now();
    const askAgain = createDemoAsker(state.pending);
    resolveDemoRequest(state, "demo-plan", { behavior: "allow" });
    const planner = agentByKey(state)[PLANNER];
    assert.equal(planner.plan.state, "approved");
    assert.equal(planner.log.at(-1).actionId, "plan-approved");
    for (let tick = 1; tick <= 3; tick += 1) askAgain(state, start + tick * 4_000);
    const asked = state.pending.find((pending) => pending.agentKey === PLANNER);
    assert.deepEqual([planner.plan.version, planner.plan.state, planner.actionId], [2, "proposed", "asking-plan-approval"]);
    assert.equal(asked.plan, demoPlanDocument(planner).text);
  });

  it("runs the tests of the platformer round and round: writes, runs, fails, fixes and passes", () => {
    const state = demoState();
    const seen = [];
    for (let step = 0; step < 12; step += 1) {
      tickDemo(state, step);
      const runner = agentByKey(state)[RUNNER];
      seen.push([runner.actionId, Boolean(runner.tests.running), runner.tests.lastRun?.isOk ?? null]);
    }
    assert.deepEqual(seen.map(([actionId]) => actionId), [
      "writing-tests", "writing-tests", "running-tests", "running-tests", "running-tests", "tests-failed",
      "writing-tests", "writing-tests", "running-tests", "running-tests", "running-tests", "tests-passed",
    ]);
    assert.deepEqual(seen[3], ["running-tests", true, null]);
    assert.deepEqual(seen[5], ["tests-failed", false, false]);
    assert.deepEqual(seen[11], ["tests-passed", false, true]);
    assert.equal(testsOverview(agentByKey(state)[RUNNER].tests).runsToday.length, 2);
  });
});
