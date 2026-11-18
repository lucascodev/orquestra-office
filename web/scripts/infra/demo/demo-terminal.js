import { agentActionText } from "../../domain/office/agent-action-text.js";

const MIN = 60_000;

const DEMO_REPLY = [
  "O teste usava o caminho da URL direto, que no Windows começa com **uma barra a mais**.",
  "",
  "- troquei por `fileURLToPath` nos dois testes",
  "- os **27 testes** passam no Windows e no Linux",
  "",
  "```js",
  "const webDir = fileURLToPath(new URL(\"../../web\", import.meta.url));",
  "```",
].join("\n");

const DEMO_DIFF = [
  "- const webDir = new URL(\"../../web\", import.meta.url).pathname;",
  "- const server = createServer({ webDir });",
  "+ const webDir = fileURLToPath(new URL(\"../../web\", import.meta.url));",
  "+ const server = createServer({ webDir, port: 0 });",
].join("\n");

const DEMO_HELPER = "import { fileURLToPath } from \"node:url\";\n\nexport const pathOf = (relative) => fileURLToPath(new URL(relative, import.meta.url));";

export function demoTerminal(target) {
  return { entries: demoHistory(target).slice(0, 5), partial: "O teste usava o caminho da URL direto, que no Windows começa com **uma barra a mais**. Vou trocar por `fileURLToPath`" };
}

export function demoHistory(target) {
  const at = target.updatedAt;
  return [
    { at: at - 9 * MIN, kind: "prompt", text: "Deixa os testes do coletor passando no Windows.", detail: "" },
    { at: at - 8 * MIN, kind: "tool", toolName: "Read", summaryId: "read-file", subject: "server.test.js", detail: "" },
    { at: at - 7 * MIN, kind: "tool", toolName: "Bash", summaryId: "run-command", subject: "Rodar os testes", detail: "cd collector && npm test -- --test-reporter=spec" },
    { at: at - 6 * MIN, kind: "error", textId: "tool-failed", subject: "Bash", detail: "✖ serves the office page (12.4ms)\n  Error: ENOENT: no such file or directory, open 'C:\\C:\\projects\\web\\index.html'" },
    { at: at - 4 * MIN, kind: "tool", toolName: "Edit", summaryId: "edit-file", subject: "server.test.js", detail: DEMO_DIFF },
    { at: at - 3 * MIN, kind: "tool", toolName: "Write", summaryId: "write-file", subject: "test/paths.js", detail: DEMO_HELPER },
    { at: at - 2 * MIN, kind: "reply", text: DEMO_REPLY, detail: "" },
    { at, kind: "note", text: agentActionText(target), detail: "" },
  ];
}
