import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { agentWorkSummaryOf } from "../scripts/domain/work-signals/agent-work-summary.js";
import { agentWith, checklistOf, failedRun, HOUR, NOW, passedRun, testsWith } from "./support/work-fixtures.js";

describe("agent's work in the island's sheet", () => {
  const cases = [
    ["a checklist and a failed run", agentWith({ checklist: checklistOf("completed", "pending"), tests: testsWith({ lastRun: failedRun(2, 248) }) }),
      ["1/2", "1 de 2 tarefas feitas"], ["tests-failed", "✕", "2", "na última rodada, 2 testes falharam"]],
    ["a checklist all done and a passed run", agentWith({ checklist: checklistOf("completed", "completed"), tests: testsWith({ lastRun: passedRun(461, NOW - HOUR) }) }),
      ["2/2", "2 de 2 tarefas feitas"], ["tests-passed", "✓", "461", "na última rodada, 461 testes passaram"]],
    ["a single failure", agentWith({ tests: testsWith({ lastRun: failedRun(1, 3) }) }),
      ["—", ""], ["tests-failed", "✕", "1", "na última rodada, 1 teste falhou"]],
    ["a run without counts", agentWith({ tests: testsWith({ lastRun: passedRun(null) }) }),
      ["—", ""], ["tests-passed", "✓", "", "a última rodada de testes passou"]],
    ["malformed fields as nothing", agentWith({ checklist: { items: [null] }, tests: { lastRun: { isOk: 1 } } }),
      ["—", ""], [null, "", "—", ""]],
  ];
  for (const [title, agent, [checklistText, checklistSpoken], [kind, icon, runText, runSpoken]] of cases) {
    it(`sums up ${title}`, () => {
      const { checklist, lastRun } = agentWorkSummaryOf(agent);
      assert.deepEqual([checklist.icon, checklist.text, checklist.spoken], ["☰", checklistText, checklistSpoken]);
      assert.deepEqual([lastRun.kind, lastRun.icon, lastRun.text, lastRun.spoken], [kind, icon, runText, runSpoken]);
    });
  }

  it("has no summary for an agent without tabs, as Codex, which only reports the end of a turn", () => {
    assert.equal(agentWorkSummaryOf(agentWith({ source: "codex" })), null);
    assert.equal(agentWorkSummaryOf(agentWith({ source: "codex", checklist: checklistOf("pending"), tests: testsWith({ lastRun: failedRun(2, 1) }) })), null);
  });
});
