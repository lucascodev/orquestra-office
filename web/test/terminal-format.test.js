import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeToolEntry, diffLines, languageOfFile } from "../scripts/domain/terminal/terminal-format.js";

describe("tool entries in the terminal", () => {
  it("shows a shell command as a command, highlighted as bash", () => {
    const tool = describeToolEntry({ text: "Bash: Rodar os testes", detail: "npm test" });
    assert.deepEqual([tool.toolName, tool.summary, tool.kind, tool.format, tool.language], ["Bash", "Rodar os testes", "shell", "command", "bash"]);
  });

  it("shows an edit as a diff", () => {
    assert.equal(describeToolEntry({ text: "Edit: Editar a.js", detail: "- a\n+ b" }).format, "diff");
  });

  it("highlights a written file in the language of its extension", () => {
    const tool = describeToolEntry({ text: "Write: Escrever src/app/main.ts", detail: "const a = 1;" });
    assert.deepEqual([tool.format, tool.language], ["code", "typescript"]);
  });

  it("shows the input of an unknown or connector tool as JSON", () => {
    const tool = describeToolEntry({ text: "mcp__notion__search", detail: "{\n  \"query\": \"x\"\n}" });
    assert.deepEqual([tool.toolName, tool.kind, tool.format, tool.language], ["mcp__notion__search", "other", "code", "json"]);
  });

  it("treats a tool named like a built-in of every object as an unknown tool", () => {
    const unknown = describeToolEntry({ text: "Unknown: x", detail: "y" });
    for (const toolName of ["toString", "constructor", "__proto__"]) {
      const tool = describeToolEntry({ text: `${toolName}: x`, detail: "y" });
      assert.deepEqual([tool.kind, tool.glyph, tool.format, tool.language], [unknown.kind, unknown.glyph, unknown.format, unknown.language]);
    }
  });

  it("keeps plain text for a delegation prompt", () => {
    assert.equal(describeToolEntry({ text: "Agent: Delegar para Explore", detail: "procure os testes" }).format, "text");
  });
});

describe("diff lines", () => {
  it("tells removed, added and unchanged lines apart", () => {
    assert.deepEqual(diffLines("- old\n+ new\nsame"), [
      { kind: "del", text: "old" }, { kind: "add", text: "new" }, { kind: "same", text: "same" },
    ]);
  });
});

describe("file languages", () => {
  it("knows common extensions and Dockerfiles and gives up on the rest", () => {
    assert.equal(languageOfFile("C:\\repo\\web\\styles\\office.css"), "css");
    assert.equal(languageOfFile("deploy/Dockerfile"), "dockerfile");
    assert.equal(languageOfFile("notes.unknown"), null);
    assert.deepEqual(["notes.constructor", "notes.__proto__", "notes.hasownproperty"].map(languageOfFile), [null, null, null]);
  });
});
