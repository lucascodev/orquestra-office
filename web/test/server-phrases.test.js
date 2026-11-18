import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { thoughtSubjectOf } from "../scripts/domain/behavior/agent-thoughts.js";
import { agentActionText, logEntryText } from "../scripts/domain/office/agent-action-text.js";
import { terminalEntryText } from "../scripts/domain/terminal/terminal-entry-text.js";
import { describeToolEntry } from "../scripts/domain/terminal/terminal-format.js";
import { toolSummaryText } from "../scripts/domain/terminal/tool-summary-text.js";
import { fillPhrase } from "../scripts/domain/text/fill-phrase.js";

const SUMMARY_LIMIT = 160;
const INHERITED_NAMES = ["toString", "constructor", "__proto__"];

describe("filling a phrase", () => {
  it("puts each slot value in its place", () => {
    assert.equal(fillPhrase("{summary} e {answers}", { summary: "a", answers: "b" }), "a e b");
  });

  it("picks the phrase without a subject only when there is none, so an empty subject still counts", () => {
    const phrase = { withSubject: "usando {subject}", withoutSubject: "trabalhando" };
    assert.deepEqual([fillPhrase(phrase, { subject: "x" }), fillPhrase(phrase, { subject: null }), fillPhrase(phrase, {}), fillPhrase(phrase, { subject: "" })],
      ["usando x", "trabalhando", "trabalhando", "usando "]);
  });

  it("leaves a slot it has no value for empty", () => {
    assert.equal(fillPhrase("Escrever {subject}", {}), "Escrever ");
  });
});

describe("what the agent is doing", () => {
  it("is written from the action and its subject", () => {
    assert.equal(agentActionText({ actionId: "editing", subject: "a.js", action: "ignored" }), "editando a.js");
    assert.equal(agentActionText({ actionId: "editing", subject: null }), "editando um arquivo");
  });

  it("is the text the collector sent when there is no action id, as in a state saved before the fields", () => {
    assert.equal(agentActionText({ action: "editando legado.js" }), "editando legado.js");
    assert.equal(agentActionText({ actionId: null, action: "" }), "");
    assert.equal(agentActionText({}), "");
  });

  it("falls back to the text for an action id it does not know, even one named like a built-in of every object", () => {
    for (const actionId of ["something-new", ...INHERITED_NAMES]) assert.equal(agentActionText({ actionId, action: "fazendo algo" }), "fazendo algo");
  });

  it("can be handed straight to map, which also passes the index", () => {
    assert.deepEqual([{ actionId: "running", subject: "npm" }].map(agentActionText), ["rodando npm"]);
    assert.deepEqual([{ actionId: "running", subject: "npm" }].map(logEntryText), ["rodando npm"]);
    assert.deepEqual([{ summaryId: "read-file", subject: "a.md" }].map(toolSummaryText), ["Ler a.md"]);
    assert.deepEqual([{ textId: "turn-interrupted" }].map(terminalEntryText), ["turno interrompido"]);
  });

  it("is written the same way for each line of the agent's log", () => {
    assert.equal(logEntryText({ at: 1, actionId: "running", subject: "npm", text: "ignored" }), "rodando npm");
    assert.equal(logEntryText({ at: 1, text: "rodando npm" }), "rodando npm");
  });
});

describe("the summary of a tool", () => {
  it("is written from the summary and its subject", () => {
    assert.equal(toolSummaryText({ summaryId: "write-file", subject: "C:\\a b\\main.ts" }), "Escrever C:\\a b\\main.ts");
    assert.equal(toolSummaryText({ summaryId: "run-command", subject: null }), "Rodar um comando");
    assert.equal(toolSummaryText({ summaryId: "run-command", subject: "Rodar os testes" }), "Rodar os testes");
  });

  it("is cut at the same length the collector used to cut it", () => {
    const path = "p".repeat(SUMMARY_LIMIT * 2);
    const written = toolSummaryText({ summaryId: "write-file", subject: `${path.slice(0, SUMMARY_LIMIT)}…` });
    assert.equal(written, `${`Escrever ${path}`.slice(0, SUMMARY_LIMIT)}…`);
  });

  it("is empty for a tool with nothing to summarize and is the text sent when there is no summary id", () => {
    assert.equal(toolSummaryText({ summaryId: null, subject: null }), "");
    assert.equal(toolSummaryText({ summary: "Aplicar as migrações" }), "Aplicar as migrações");
    assert.equal(toolSummaryText({ summaryId: "toString", summary: "texto" }), "texto");
  });
});

describe("notes and errors in the terminal", () => {
  it("are written from their text id", () => {
    assert.equal(terminalEntryText({ kind: "error", textId: "tool-failed", subject: "Bash" }), "Bash falhou");
    assert.equal(terminalEntryText({ kind: "error", textId: "tool-failed", subject: null }), "ferramenta falhou");
    assert.equal(terminalEntryText({ kind: "note", textId: "session-ended", subject: "3" }), "sessão encerrada (código 3)");
  });

  it("write a decision with the summary of the tool and an answer with every answer given", () => {
    assert.equal(terminalEntryText({ kind: "note", textId: "permission-denied", toolName: "Bash", summaryId: "run-command", subject: "Limpar dist" }), "você recusou: Limpar dist");
    assert.equal(terminalEntryText({ kind: "note", textId: "question-answered", answers: ["Rapier", "web"] }), "você respondeu: Rapier · web");
  });

  it("are the text sent when there is no text id or it is unknown", () => {
    assert.equal(terminalEntryText({ kind: "note", text: "sessão encerrada" }), "sessão encerrada");
    assert.equal(terminalEntryText({ kind: "note", textId: "constructor", text: "texto" }), "texto");
    assert.equal(terminalEntryText({ kind: "prompt", text: "oi" }), "oi");
  });
});

describe("a tool entry with its fields", () => {
  it("shows the tool and the summary written by the page", () => {
    const tool = describeToolEntry({ kind: "tool", toolName: "Bash", summaryId: "run-command", subject: null, detail: "ls" });
    assert.deepEqual([tool.toolName, tool.summary, tool.kind, tool.format, tool.language], ["Bash", "Rodar um comando", "shell", "command", "bash"]);
  });

  it("highlights a written file by the extension of its path, even with spaces in it", () => {
    const tool = describeToolEntry({ kind: "tool", toolName: "Write", summaryId: "write-file", subject: "C:\\meu projeto\\main.ts", detail: "x" });
    assert.deepEqual([tool.summary, tool.format, tool.language], ["Escrever C:\\meu projeto\\main.ts", "code", "typescript"]);
  });

  it("shows only the name of a tool with nothing to summarize", () => {
    const tool = describeToolEntry({ kind: "tool", toolName: "mcp__notion__search", summaryId: null, subject: null, detail: "{}" });
    assert.deepEqual([tool.toolName, tool.summary, tool.kind, tool.language], ["mcp__notion__search", "", "other", "json"]);
  });
});

describe("the subject of a thought", () => {
  it("is the file being read or edited, when it looks like a file", () => {
    assert.equal(thoughtSubjectOf({ actionId: "editing", subject: "a.js" }), "a.js");
    assert.equal(thoughtSubjectOf({ actionId: "reading", subject: "README.md" }), "README.md");
    assert.equal(thoughtSubjectOf({ actionId: "editing", subject: "Makefile" }), null);
    assert.equal(thoughtSubjectOf({ actionId: "editing", subject: "meu arquivo.js" }), null);
  });

  it("is the program, subagent, connector or tool named in one word", () => {
    for (const actionId of ["running", "delegating", "using-connector", "using-tool"]) assert.equal(thoughtSubjectOf({ actionId, subject: "npm" }), "npm");
  });

  it("is nothing for any other action, even one with a subject", () => {
    assert.equal(thoughtSubjectOf({ actionId: "tool-failed", subject: "Bash" }), null);
    assert.equal(thoughtSubjectOf({ actionId: "permission-approved", subject: "Bash" }), null);
    assert.equal(thoughtSubjectOf({ actionId: "editing", subject: null }), null);
    assert.equal(thoughtSubjectOf({ actionId: "toString", subject: "a.js" }), null);
  });

  it("is read from the text when there is no action id, as in a state saved before the fields", () => {
    assert.deepEqual(["editando a.js", "rodando npm", "delegou para Explore", "usando notion", "falhou ao usar Bash", undefined].map((action) => thoughtSubjectOf({ action })),
      ["a.js", "npm", "Explore", "notion", null, null]);
  });
});
