import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TEST_FRAMEWORKS } from "../scripts/data/text/pt-br/test-frameworks.js";
import { agentActionText } from "../scripts/domain/office/agent-action-text.js";
import { testFrameworkName } from "../scripts/domain/work-sheet/test-framework-name.js";
import { testsOverview } from "../scripts/domain/work-sheet/tests-overview.js";
import { renderTestsTab } from "../scripts/view/sheet/tests-tab-view.js";

const DAY_START = 0;

// The contract test against the collector's FRAMEWORK_IDS comes in with the merge of the collector's branch, which exports
// that list; until then the ids below are the ones the collector's frameworkOf accepts today.
describe("names of the test frameworks", () => {
  const names = [
    ["node-test", "node:test"], ["mixed", "vários"], ["jest", "Jest"], ["vitest", "Vitest"], ["pytest", "pytest"], ["go", "Go"],
    ["cargo", "Cargo"], ["dotnet", ".NET"], ["maven", "Maven"], ["gradle", "Gradle"], ["mocha", "Mocha"], ["rspec", "RSpec"],
    ["phpunit", "PHPUnit"], ["mix", "Mix"], ["playwright", "Playwright"], ["tap", "TAP"], ["bun", "Bun"], ["deno", "Deno"],
    ["cypress", "Cypress"], ["ava", "AVA"], ["unittest", "unittest"], ["minitest", "Minitest"], ["pest", "Pest"],
    ["flutter", "Flutter"], ["dart", "Dart"], ["swift", "Swift"], ["xcodebuild", "Xcode"],
  ];
  for (const [id, name] of names) {
    it(`shows ${id} as ${name}`, () => assert.equal(testFrameworkName(id), name));
  }

  it("names every framework of the catalog and nothing else", () => {
    assert.deepEqual(Object.keys(TEST_FRAMEWORKS).sort(), names.map(([id]) => id).sort());
  });

  it("shows an id it does not know as it came, and nothing for no framework or an inherited name", () => {
    assert.deepEqual(["karma", "npm", null, undefined, "", "toString"].map(testFrameworkName), ["karma", "npm", null, null, null, "toString"]);
  });

  it("names the framework in the Testes tab, for the last round, a round of today and the round running", () => {
    const html = renderTestsTab(testsOverview({
      running: { command: null, framework: "node-test", startedAt: 1 },
      lastRun: { isOk: false, passed: 75, failed: 2, skipped: 2, framework: "mixed", command: "npm run check", finishedAt: 1, failures: [] },
      runsToday: [{ finishedAt: 1, framework: "dotnet", label: null, isOk: true, passed: 3, failed: 0 }],
    }, { dayStart: DAY_START }));
    assert.ok(html.includes("<b>2 falharam · vários</b>"));
    assert.ok(html.includes('<span class="work-row-text">.NET</span>'));
    assert.ok(html.includes('<code class="work-command">node:test</code>'));
  });

  it("names the framework in the phrase of the tests running, and keeps the first word of a command it does not know", () => {
    assert.equal(agentActionText({ actionId: "running-tests", subject: "node-test" }), "rodando os testes com node:test");
    assert.equal(agentActionText({ actionId: "running-tests", subject: "vitest" }), "rodando os testes com Vitest");
    assert.equal(agentActionText({ actionId: "running-tests", subject: "npm" }), "rodando os testes com npm");
    assert.equal(agentActionText({ actionId: "running-tests", subject: null }), "rodando os testes");
  });
});
