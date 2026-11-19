import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AGENT_ACTIONS } from "../scripts/data/text/pt-br/agent-actions.js";
import { TERMINAL_NOTES } from "../scripts/data/text/pt-br/terminal-notes.js";
import { TOOL_SUMMARIES } from "../scripts/data/text/pt-br/tool-summaries.js";
import { agentActionText, logEntryText } from "../scripts/domain/office/agent-action-text.js";
import { terminalEntryText } from "../scripts/domain/terminal/terminal-entry-text.js";
import { describeToolEntry } from "../scripts/domain/terminal/terminal-format.js";
import { toolSummaryText } from "../scripts/domain/terminal/tool-summary-text.js";
import { createDemoAsker } from "../scripts/infra/demo/demo-requests.js";
import { demoHistory } from "../scripts/infra/demo/demo-terminal.js";
import { demoState, resolveDemoRequest, tickDemo } from "../scripts/infra/demo/demo-world.js";

const TICKS = 40;
const SHOWCASE = "c:/projetos/demo/reacoes";

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
        assert.ok(Object.hasOwn(AGENT_ACTIONS, agent.actionId), `${agent.key}: ${agent.actionId}`);
        assert.equal(agent.action, undefined);
        for (const entry of agent.log) {
          assert.ok(Object.hasOwn(AGENT_ACTIONS, entry.actionId), `${agent.key} log: ${entry.actionId}`);
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
    assert.deepEqual(requests.map((request) => toolSummaryText(request)), ["Aplicar as migrações do banco", "Tem uma pergunta para você"]);
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

describe("demo requests in the headquarters", () => {
  const TICK_MS = 4_000;

  it("asks again a few ticks after a request is decided, with a new id and the agent waiting for you", () => {
    const state = demoState();
    const start = state.pending[0].createdAt;
    const askAgain = createDemoAsker(state.pending);
    resolveDemoRequest(state, "demo-permission", { behavior: "allow" });
    for (let tick = 1; tick <= 2; tick += 1) askAgain(state, start + tick * TICK_MS);
    assert.deepEqual(state.pending.map((request) => request.id), ["demo-question"]);
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
