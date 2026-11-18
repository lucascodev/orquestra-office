import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeClaudeEvent } from "../../collector/src/claude/claude-event.js";
import { claudeHistoryEntry } from "../../collector/src/claude/claude-history-entry.js";
import { normalizeCodexEvent } from "../../collector/src/codex/codex-event.js";
import { createDeliverQueuedMessages } from "../../collector/src/control/application/deliver-queued-messages.js";
import { createHoldPermission } from "../../collector/src/control/application/hold-permission.js";
import { createHoldQuestion } from "../../collector/src/control/application/hold-question.js";
import { changesOf } from "../../runner/src/claude/stream-changes.js";
import { createSession } from "../../runner/src/sessions/session.js";
import { agentActionText, logEntryText } from "../scripts/domain/office/agent-action-text.js";
import { terminalEntryText } from "../scripts/domain/terminal/terminal-entry-text.js";
import { describeToolEntry } from "../scripts/domain/terminal/terminal-format.js";
import { toolSummaryText } from "../scripts/domain/terminal/tool-summary-text.js";

const SESSION = { session_id: "s1", cwd: "/repo" };
const ACTOR = { source: "claude", sessionId: "s1", agentId: null, agentType: null, cwd: "/repo", projectRoot: "" };
const LONG_PATH = `/repo/${"pasta/".repeat(40)}arquivo.ts`;
const NEVER_ABORTED = () => {};

const claude = (hook, extra = {}) => normalizeClaudeEvent({ ...SESSION, hook_event_name: hook, ...extra }, 1);
const tool = (name, input = {}) => claude("PreToolUse", { tool_name: name, tool_input: input });
const historyEntry = (hook, extra = {}) => claudeHistoryEntry({ ...SESSION, hook_event_name: hook, ...extra }, 1).entry;
const withoutText = ({ action, text, summary, ...fields }) => fields;

async function decided(decide) {
  const seen = { requests: [], events: [], notes: [] };
  const activity = { note: (actor, event, note) => { seen.events.push(event); seen.notes.push(note); } };
  const holdRequest = async (actor, request) => { seen.requests.push(request); return decide(request); };
  return { seen, holdPermission: createHoldPermission({ holdRequest, activity }), holdQuestion: createHoldQuestion({ holdRequest, activity }) };
}

async function permissionDecided(behavior, toolName, toolInput) {
  const { seen, holdPermission } = await decided(() => ({ behavior }));
  await holdPermission({ actor: ACTOR, toolName, toolInput, onAbort: NEVER_ABORTED });
  return { request: seen.requests[0], event: seen.events[0], note: seen.notes[0] };
}

async function questionAnswered(answers) {
  const { seen, holdQuestion } = await decided(() => ({ answers }));
  await holdQuestion({ actor: ACTOR, questions: [{ question: "Qual?" }], onAbort: NEVER_ABORTED });
  return { request: seen.requests[0], event: seen.events[0], note: seen.notes[0] };
}

function deliveredMessageEvent() {
  const applied = [];
  const deliver = createDeliverQueuedMessages({ store: { apply: (event) => applied.push(event) }, outbox: { take: () => ["oi"] } });
  deliver(ACTOR);
  return applied[0];
}

function runnerEntries(event) {
  return changesOf(event).filter((change) => change.type === "entry").map((change) => change.entry);
}

function endedSessionEntry(outcome) {
  let exit = null;
  const session = createSession({ cwd: "/repo", now: () => 1, startProcess: ({ onExit }) => { exit = onExit; return { send() {}, interrupt() {}, stop() {} }; } });
  exit(outcome);
  return session.transcript().entries.at(-1);
}

async function agentActions() {
  return [
    [claude("SessionStart"), "abriu a sessão"],
    [claude("SessionStart", { source: "resume" }), "retomou a sessão"],
    [claude("UserPromptSubmit", { prompt: "x" }), "recebeu um pedido seu"],
    [tool("Read", { file_path: "C:\\repo\\README.md" }), "lendo README.md"],
    [tool("Grep"), "procurando no código"],
    [tool("Edit", { file_path: "/repo/a.js" }), "editando a.js"],
    [tool("Write"), "editando um arquivo"],
    [tool("Bash", { command: "npm test" }), "rodando npm"],
    [tool("Bash"), "rodando um comando"],
    [tool("Agent", { subagent_type: "code-reviewer" }), "delegou para code-reviewer"],
    [tool("Task"), "delegou uma tarefa"],
    [tool("AskUserQuestion"), "tem uma pergunta para você"],
    [tool("ExitPlanMode"), "quer que você aprove o plano"],
    [tool("TodoWrite"), "atualizou a lista de tarefas"],
    [tool("WebSearch"), "pesquisando na web"],
    [tool("mcp__github__issues"), "usando github"],
    [tool("mcp__"), "usando um conector"],
    [tool("SlashCommand"), "usando SlashCommand"],
    [tool(""), "trabalhando"],
    [claude("PostToolUseFailure", { tool_name: "Edit" }), "falhou ao usar Edit"],
    [claude("PostToolUseFailure"), "falhou ao usar uma ferramenta"],
    [claude("PostToolUseFailure", { tool_name: "" }), "falhou ao usar "],
    [claude("PermissionRequest", { tool_name: "Bash" }), "pede permissão para usar Bash"],
    [claude("PermissionRequest"), "pede permissão para usar uma ferramenta"],
    [claude("Notification", { notification_type: "permission_prompt" }), "precisa de você no terminal"],
    [claude("Notification", { notification_type: "idle_prompt" }), "esperando sua resposta"],
    [claude("Stop"), "terminou o turno"],
    [claude("StopFailure"), "parou por erro da API"],
    [claude("SubagentStart", { agent_id: "a1" }), "começou a tarefa"],
    [claude("SubagentStop", { agent_id: "a1" }), "entregou a tarefa"],
    [claude("SessionEnd"), "fechou a sessão"],
    [normalizeCodexEvent({ type: "agent-turn-complete", "thread-id": "t1", cwd: "/repo" }, 1), "terminou o turno e espera você"],
    [deliveredMessageEvent(), "recebeu sua mensagem pelo escritório"],
    [(await permissionDecided("allow", "Bash", { command: "ls" })).event, "você aprovou Bash pelo escritório"],
    [(await permissionDecided("deny", "Bash", { command: "ls" })).event, "você recusou Bash pelo escritório"],
    [(await permissionDecided("allow", "", {})).event, "você aprovou  pelo escritório"],
    [(await questionAnswered({ "Qual?": "Rapier" })).event, "você respondeu pelo escritório"],
  ];
}

async function requestSummaries() {
  return [
    [(await permissionDecided("allow", "Bash", { command: "rm -rf dist", description: "Limpar a pasta dist" })).request, "Limpar a pasta dist"],
    [(await permissionDecided("allow", "Bash", { command: "ls" })).request, "Rodar um comando"],
    [(await permissionDecided("allow", "Write", { file_path: "C:\\repo\\notes.md" })).request, "Escrever C:\\repo\\notes.md"],
    [(await permissionDecided("allow", "Write", { file_path: LONG_PATH })).request, `${`Escrever ${LONG_PATH}`.slice(0, 160)}…`],
    [(await permissionDecided("allow", "Edit", { file_path: "/repo/a.js" })).request, "Editar /repo/a.js"],
    [(await permissionDecided("allow", "Read", { file_path: "/repo/a.md" })).request, "Ler /repo/a.md"],
    [(await permissionDecided("allow", "WebFetch", { url: "https://x" })).request, "Abrir uma página"],
    [(await permissionDecided("allow", "WebSearch", { query: "q" })).request, "Pesquisar na web"],
    [(await permissionDecided("allow", "Agent", { subagent_type: "Explore" })).request, "Delegar para Explore"],
    [(await permissionDecided("allow", "Task", {})).request, "Delegar para um subagente"],
    [(await permissionDecided("allow", "mcp__db__query", {})).request, "Usar mcp__db__query"],
    [(await permissionDecided("allow", "", {})).request, "Usar uma ferramenta"],
    [(await questionAnswered({ "Qual?": "Rapier" })).request, "Tem uma pergunta para você"],
  ];
}

async function terminalNotes() {
  return [
    [historyEntry("UserPromptSubmit", { prompt: "<task-notification>x</task-notification>" }), "uma tarefa em segundo plano terminou"],
    [historyEntry("PostToolUseFailure", { tool_name: "Bash", error: "x" }), "Bash falhou"],
    [historyEntry("PostToolUseFailure", { error: "x" }), "ferramenta falhou"],
    [historyEntry("StopFailure", { error: "x" }), "parou por erro da API"],
    [(await permissionDecided("allow", "Write", { file_path: "C:\\repo\\notes.md" })).note, "você aprovou: Escrever C:\\repo\\notes.md"],
    [(await permissionDecided("deny", "Bash", { command: "rm", description: "Limpar a pasta dist" })).note, "você recusou: Limpar a pasta dist"],
    [(await permissionDecided("allow", "mcp__db__query", {})).note, "você aprovou: Usar mcp__db__query"],
    [(await questionAnswered({ "Qual?": "Rapier", "E?": "web" })).note, "você respondeu: Rapier · web"],
    [runnerEntries({ type: "result", is_error: true, terminal_reason: "aborted_streaming" })[0], "turno interrompido"],
    [runnerEntries({ type: "result", is_error: true, subtype: "error_max_turns" })[0], "o turno terminou com erro"],
    [endedSessionEntry({ code: null, error: "spawn claude ENOENT" }), "a sessão caiu"],
    [endedSessionEntry({ code: 0, error: "" }), "sessão encerrada"],
    [endedSessionEntry({ code: 3, error: "" }), "sessão encerrada (código 3)"],
  ];
}

function terminalTools() {
  const runnerTool = (name, input) => runnerEntries({ type: "assistant", message: { content: [{ type: "tool_use", name, input }] } })[0];
  return [
    [historyEntry("PreToolUse", { tool_name: "Bash", tool_input: { command: "npm test", description: "Rodar os testes" } }), ["Bash", "Rodar os testes"]],
    [historyEntry("PreToolUse", { tool_name: "Write", tool_input: { file_path: "C:\\meu projeto\\main.ts", content: "x" } }), ["Write", "Escrever C:\\meu projeto\\main.ts"]],
    [historyEntry("PreToolUse", { tool_name: "Grep", tool_input: { pattern: "x" } }), ["Grep", ""]],
    [historyEntry("PreToolUse", { tool_name: "mcp__notion__search", tool_input: {} }), ["mcp__notion__search", ""]],
    [runnerTool("Read", { file_path: "/repo/server.test.js" }), ["Read", "Ler /repo/server.test.js"]],
    [runnerTool("Agent", { subagent_type: "Explore", prompt: "p" }), ["Agent", "Delegar para Explore"]],
  ];
}

describe("phrases the page writes from the collector's and the runner's fields", () => {
  it("say what the agent is doing, for every action the collector reports", async () => {
    for (const [event, expected] of await agentActions()) assert.equal(agentActionText(withoutText(event)), expected, JSON.stringify(event));
  });

  it("say the same in each line of the agent's log", async () => {
    for (const [event, expected] of await agentActions()) {
      const { actionId, subject } = event;
      assert.equal(logEntryText({ at: 1, actionId, subject }), expected);
    }
  });

  it("summarize every request the collector holds", async () => {
    for (const [request, expected] of await requestSummaries()) assert.equal(toolSummaryText(withoutText(request)), expected, JSON.stringify(request));
  });

  it("write every note and error of the history and of the live terminal", async () => {
    for (const [entry, expected] of await terminalNotes()) assert.equal(terminalEntryText(withoutText(entry)), expected, JSON.stringify(entry));
  });

  it("split every tool entry into its name and summary", () => {
    for (const [entry, expected] of terminalTools()) {
      const tool = describeToolEntry(withoutText(entry));
      assert.deepEqual([tool.toolName, tool.summary], expected);
    }
  });
});

describe("the text the collector and the runner still send while the page moves to the fields", () => {
  it("is what the page writes for every action", async () => {
    for (const [event, expected] of await agentActions()) assert.equal(event.action, expected);
  });

  it("is what the page writes for every request summary", async () => {
    for (const [request, expected] of await requestSummaries()) assert.equal(request.summary, expected);
  });

  it("is what the page writes for every note and error", async () => {
    for (const [entry, expected] of await terminalNotes()) assert.equal(entry.text, expected);
  });

  it("is what the page splits into tool name and summary", () => {
    for (const [entry, [toolName, summary]] of terminalTools()) assert.equal(entry.text, summary ? `${toolName}: ${summary}` : toolName);
  });
});
