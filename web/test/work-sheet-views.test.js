import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it, mock } from "node:test";
import { WORK_MARKS } from "../scripts/data/work-marks.js";
import { checklistProgress } from "../scripts/domain/work-sheet/checklist-progress.js";
import { planStatus } from "../scripts/domain/work-sheet/plan-status.js";
import { testsOverview } from "../scripts/domain/work-sheet/tests-overview.js";
import { workTabs } from "../scripts/domain/work-sheet/work-tabs.js";
import { planMarkdownHtml, renderPlanMarkdown } from "../scripts/view/shared/plan-markdown.js";
import { renderDrawerShell, renderDrawerStatus } from "../scripts/view/sheet/agent-sheet-view.js";
import { renderChecklistTab } from "../scripts/view/sheet/checklist-tab-view.js";
import { renderPlanTab } from "../scripts/view/sheet/plan-tab-view.js";
import { renderTestsTab } from "../scripts/view/sheet/tests-tab-view.js";
import { formatTestDuration } from "../scripts/view/sheet/work-format.js";
import { renderWorkTabs } from "../scripts/view/sheet/work-tabs-view.js";

process.env.TZ = "UTC";

const NOW = Date.UTC(2026, 10, 19, 18, 42, 0);
const MINUTE = 60_000;
const TODAY = Date.UTC(2026, 10, 19);
const HOSTILE_PLAN = [
  "# Plano",
  '<button data-decide="allow">Aprovar</button>',
  "<style>[data-decide=deny]{display:none}</style>",
  '<textarea name="reason" id="hq-plan-reason">aprovado</textarea>',
  '<img src="x" onerror="alert(1)">',
  "[clique](javascript:alert(1)) e [site](https://example.com) e [mail](mailto:a@b.c)",
].join("\n\n");

before(() => mock.timers.enable({ apis: ["Date"], now: NOW }));
after(() => mock.timers.reset());

const count = (html, pattern) => (html.match(pattern) ?? []).length;

describe("plan markdown", () => {
  it("turns raw HTML in the plan into text before any sanitizer runs", () => {
    const html = planMarkdownHtml(HOSTILE_PLAN);
    for (const tag of ["<button", "<style", "<textarea", "<img"]) assert.ok(!html.includes(tag), tag);
    assert.ok(!/data-decide="/.test(html));
    assert.ok(!/name="reason"/.test(html));
    assert.ok(html.includes("&lt;button data-decide=&quot;allow&quot;&gt;"));
  });

  it("keeps links only to the web or to mail, with the address in view, and drops any other link to its text", () => {
    const html = planMarkdownHtml(HOSTILE_PLAN);
    assert.ok(!html.includes("javascript:"));
    assert.ok(html.includes('<a href="https://example.com">site</a> <span class="plan-link-target">(https://example.com)</span>'));
    assert.ok(html.includes('<a href="mailto:a@b.c">mail</a>'));
    assert.ok(html.includes("clique"));
  });

  it("shows task boxes as marks, not as inputs", () => {
    const html = planMarkdownHtml("- [x] feito\n- [ ] aberto");
    assert.ok(!html.includes("<input"));
    assert.ok(html.includes("☑ feito") && html.includes("☐ aberto"));
  });

  it("falls back to plain escaped text where the sanitizer cannot run", () => {
    assert.equal(renderPlanMarkdown("<b>a</b>"), '<p class="plan-plain">&lt;b&gt;a&lt;/b&gt;</p>');
  });
});

describe("tabs of the agent's sheet", () => {
  const agent = {
    key: "claude:a1", source: "claude",
    checklist: { updatedAt: NOW - 30_000, items: [{ id: "1", text: "Ler", status: "completed" }, { id: "2", text: "Rodar <testes>", status: "in_progress", activeText: "Rodando…" }, { id: "3", text: "Commit", status: "pending" }] },
    tests: { lastRun: { isOk: false, passed: 248, failed: 2, skipped: 7, failures: [] } },
  };

  it("draws real tabs, each controlling its panel, with the selection, the count and the failure said in words", () => {
    const html = renderWorkTabs(workTabs(agent, "now"));
    assert.equal(count(html, /role="tab"/g), 4);
    assert.ok(html.includes('id="work-tab-now" aria-controls="work-panel-now" aria-selected="true" tabindex="0"'));
    assert.ok(html.includes('id="work-tab-tests" aria-controls="work-panel-tests" aria-selected="false" tabindex="-1"'));
    assert.ok(html.includes('<span class="work-tab-count" aria-hidden="true">1/3</span><span class="sr-only">, 1 de 3 feitas</span>'));
    assert.ok(html.includes('<span class="work-tab-alert" aria-hidden="true"></span><span class="sr-only">, a última rodada falhou</span>'));
  });

  it("wraps what the drawer had in the Agora panel and adds one panel per tab, the others hidden", () => {
    const html = renderDrawerShell({ agentName: "Heitor", canReceiveMessages: true, isLive: false, isFollowed: false, hasWorkTabs: true });
    assert.ok(html.includes('role="tablist" aria-label="Seções da ficha" data-slot="work-tabs"'));
    assert.ok(html.includes('role="tabpanel" id="work-panel-now" aria-labelledby="work-tab-now" data-work-panel="now"'));
    for (const id of ["todos", "plan", "tests"]) assert.ok(html.includes(`id="work-panel-${id}" aria-labelledby="work-tab-${id}" tabindex="0" data-work-panel="${id}" hidden><div data-slot="${id}"></div>`));
    assert.ok(html.indexOf("work-panel-now") < html.indexOf('data-action="follow"'));
    assert.ok(!renderDrawerShell({ agentName: "Ana", canReceiveMessages: true, isLive: false, isFollowed: false }).includes("tablist"));
  });

  it("adds the step of the list the agent is on to its status", () => {
    assert.ok(renderDrawerStatus({ ...agent, status: "working", tools: 3, updatedAt: NOW, startedAt: NOW }).includes(" · tarefa 2 de 3</span>"));
  });

  it("lists the items with their state in words, the one in progress with what it is doing, all escaped", () => {
    const html = renderChecklistTab(checklistProgress(agent.checklist));
    assert.ok(html.includes("<b>1 de 3 feitas</b><span class=\"work-muted\">atualizada agora</span>"));
    assert.ok(html.includes('style="--steps:3"'));
    assert.ok(html.includes('<span class="sr-only">em andamento: </span><span class="work-todo-text"><b>Rodar &lt;testes&gt;</b><span class="work-todo-active">Rodando…</span>'));
    assert.ok(html.includes('<span class="sr-only">feito: </span>'));
    assert.ok(renderChecklistTab(null).includes("ainda não montou uma lista"));
  });

  it("shows the plan's state and version with the text fetched, or says it is on its way", () => {
    const status = planStatus({ version: 2, state: "approved", proposedAt: NOW - 3 * MINUTE, decidedAt: NOW - MINUTE });
    const ready = renderPlanTab(status, { text: "# Encadear", loading: "ready" });
    assert.ok(ready.includes('data-state="approved"'));
    assert.ok(ready.includes("Aprovado às 18:41"));
    assert.ok(ready.includes("versão 2"));
    assert.ok(ready.includes("Encadear"));
    assert.ok(renderPlanTab(status, { loading: "loading" }).includes("Buscando o plano…"));
    assert.ok(renderPlanTab(status, { loading: "failed" }).includes("Não deu para buscar o plano."));
    assert.ok(renderPlanTab(status, { loading: "missing" }).includes("não tem mais o texto"));
    assert.ok(renderPlanTab(planStatus({ state: "proposed" }), { loading: "loading" }).includes("Esperando sua aprovação</span>"));
    assert.ok(renderPlanTab(null).includes("Nenhum plano nesta sessão."));
  });

  it("says a revised plan is a new version waiting for approval since it arrived", () => {
    const revised = planStatus({ version: 2, state: "revised", proposedAt: NOW - MINUTE, decidedAt: null });
    assert.ok(renderPlanTab(revised, { loading: "loading" }).includes("Versão nova, esperando sua aprovação desde 18:41</span>"));
    assert.ok(renderPlanTab(planStatus({ state: "revised" }), { loading: "loading" }).includes("Versão nova, esperando sua aprovação</span>"));
  });

  it("escapes the hostile text of a plan fetched for the tab", () => {
    const html = renderPlanTab(planStatus({ version: 1, state: "proposed", proposedAt: NOW }), { text: HOSTILE_PLAN, loading: "ready" });
    for (const tag of ["<button", "<style", "<textarea", "<img"]) assert.ok(!html.includes(tag), tag);
  });

  it("shows the running round with an empty clock for the sheet to tick, and the last round with its failures as plain text", () => {
    const html = renderTestsTab(testsOverview({
      running: { command: "npx vitest <src>", framework: "vitest", startedAt: NOW - 12_000 },
      lastRun: {
        command: "npm test", framework: "vitest", finishedAt: NOW, durationMs: 4_100, isOk: false, passed: 248, failed: 2, skipped: 7,
        failures: [{ name: "**keeps** <b>x</b>", location: "[a](https://evil.example):12", message: "expected <1>" }],
      },
      runsToday: [{ finishedAt: NOW, label: "hooks · node --test", isOk: false, passed: 248, failed: 2 }, { finishedAt: NOW - MINUTE, label: null, framework: null, isOk: true, passed: null, failed: null }],
      files: [{ path: "a/<b>.test.js", action: "edited", failed: 2 }, { path: "c.test.js", action: "read", failed: null }],
    }, { dayStart: TODAY }));
    assert.ok(html.includes(`<span class="work-clock" data-elapsed-since="${NOW - 12_000}"></span>`));
    assert.ok(html.includes('<code class="work-command">npx vitest &lt;src&gt;</code>'));
    assert.ok(html.includes("<b>2 falharam · vitest</b><span class=\"work-muted\">18:42 · 4,1 s</span>"));
    assert.ok(html.includes("<b>**keeps** &lt;b&gt;x&lt;/b&gt;</b>"));
    assert.ok(html.includes('<span class="work-failure-where">[a](https://evil.example):12</span>'));
    assert.ok(!html.includes("<a "));
    assert.ok(html.includes('<code class="work-failure-message">expected &lt;1&gt;</code>'));
    assert.ok(html.includes("2 ✕ · 248 ✓</span><span class=\"sr-only\">: 2 falharam, 248 passaram</span>"));
    assert.ok(html.includes(">testes</span>") && html.includes(">ok</span>"));
    assert.ok(html.includes('<code class="work-row-text">a/&lt;b&gt;.test.js</code><span class="work-row-end" aria-hidden="true">✕ 2</span><span class="sr-only">: 2 falharam</span>'));
    assert.ok(html.includes("Hoje · 2 rodadas") && html.includes("Arquivos de teste desta sessão · 2"));
    assert.ok(renderTestsTab(null).includes("Nenhum teste rodado nesta sessão ainda."));
  });

  it("takes the marks of the Testes tab from the shared marks, so the tab, the tag and the legend draw the same ones", () => {
    const source = readFileSync(new URL("../scripts/view/sheet/tests-tab-view.js", import.meta.url), "utf8");
    assert.deepEqual(Object.values(WORK_MARKS).filter((mark) => source.includes(mark)), []);
    const html = renderTestsTab(testsOverview({
      running: { startedAt: NOW },
      lastRun: { isOk: false, failed: 1, passed: 2, finishedAt: NOW },
      runsToday: [{ isOk: false, failed: 1, passed: 2, finishedAt: NOW, label: "npm test" }],
      files: [{ path: "a.test.js", action: "read", failed: null }],
    }, { dayStart: TODAY }));
    for (const mark of [WORK_MARKS.testing, WORK_MARKS["tests-failed"], WORK_MARKS["tests-passed"], WORK_MARKS["no-result"]]) assert.ok(html.includes(mark), mark);
  });

  it("writes how long a round took in seconds or minutes", () => {
    assert.deepEqual([4_100, 59_000, 125_000, null].map(formatTestDuration), ["4,1 s", "59 s", "2 min 05 s", ""]);
  });
});
