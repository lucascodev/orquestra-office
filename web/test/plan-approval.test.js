import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";
import { decisionForKey } from "../scripts/domain/office/decision-shortcuts.js";
import { requestIntentText } from "../scripts/domain/office/request-intent-text.js";
import { isPlanRequest, planOfRequest } from "../scripts/domain/work-sheet/plan-request.js";
import { renderAlertBody } from "../scripts/view/hud/pending-alert-view.js";
import { renderPendingCard } from "../scripts/view/sheet/pending-request-view.js";

process.env.TZ = "UTC";

const NOW = Date.UTC(2026, 10, 19, 18, 42, 0);
const MINUTE = 60_000;
const HOSTILE_PLAN = [
  "# Plano",
  '<button data-decide="allow">Aprovar</button>',
  "<style>[data-decide=deny]{display:none}</style>",
  '<textarea name="reason" id="hq-plan-reason">aprovado</textarea>',
  '<img src="x" onerror="alert(1)">',
].join("\n\n");

before(() => mock.timers.enable({ apis: ["Date"], now: NOW }));
after(() => mock.timers.reset());

const planRequest = (extra = {}) => ({
  id: "req-plan", kind: "permission", agentKey: "claude:a1", toolName: "ExitPlanMode", summaryId: "use-tool", subject: "ExitPlanMode",
  detail: "", createdAt: NOW, expiresAt: NOW + 2 * MINUTE, plan: "# Encadear\n\n1. **Criar** `codex-chain.mjs`", planLength: 40, isPlanTruncated: false, ...extra,
});

const count = (html, pattern) => (html.match(pattern) ?? []).length;
const decisionBarOf = (html) => html.slice(html.indexOf("data-decision-bar"));
const beforeDecisionBar = (html) => html.slice(0, html.indexOf("data-decision-bar"));

describe("plan requests", () => {
  it("knows a plan to approve by the tool that leaves plan mode, never a question", () => {
    assert.equal(isPlanRequest(planRequest()), true);
    assert.equal(isPlanRequest(planRequest({ kind: "question" })), false);
    assert.equal(isPlanRequest({ kind: "permission", toolName: "Bash" }), false);
    assert.equal(isPlanRequest(null), false);
  });

  it("shows the plan the request carries, cut or whole, and nothing from anywhere else", () => {
    assert.deepEqual(planOfRequest(planRequest({ plan: "# A", isPlanTruncated: true })), { text: "# A", isTruncated: true });
    assert.deepEqual(planOfRequest(planRequest({ plan: "# A" })), { text: "# A", isTruncated: false });
    assert.equal(planOfRequest(planRequest({ plan: undefined, detail: JSON.stringify({ plan: "# do detalhe" }) })), null);
    assert.equal(planOfRequest(planRequest({ plan: 3 })), null);
    assert.equal(planOfRequest({ kind: "permission", toolName: "Bash", plan: "# A" }), null);
  });

  it("says the agent finished the plan instead of asking to use a tool", () => {
    assert.equal(requestIntentText(planRequest()), "terminou o plano e quer sua aprovação");
    assert.equal(requestIntentText({ kind: "permission", summaryId: "run-command", toolName: "Bash" }), "quer rodar um comando");
  });

  it("lets N keep planning but never lets A approve a plan", () => {
    const keys = (key, canAllowByKey) => decisionForKey({ key, hasModifier: false, isTyping: false, canAllowByKey });
    assert.deepEqual([keys("a", false), keys("A", false), keys("n", false)], [null, null, "deny"]);
    assert.deepEqual([keys("a", true), keys("n", true)], ["allow", "deny"]);
    assert.equal(decisionForKey({ key: "a", hasModifier: false, isTyping: false }), "allow");
  });
});

describe("plan waiting for approval", () => {
  it("keeps a hostile plan from adding a button, a style or a field that answers the request", () => {
    for (const html of [renderAlertBody(planRequest({ plan: HOSTILE_PLAN })), renderPendingCard(planRequest({ plan: HOSTILE_PLAN }), "Heitor")]) {
      const plan = beforeDecisionBar(html);
      for (const tag of ["<button", "<style", "<textarea", "<img", 'data-decide="', 'name="reason"']) assert.ok(!plan.includes(tag), tag);
      assert.equal(count(html, /<textarea/g), 1);
      assert.equal(count(html, /data-decision-bar/g), 1);
      assert.equal(count(html, /data-decide="/g), 3);
      assert.equal(count(decisionBarOf(html), /data-decide="/g), 3);
    }
  });

  it("names the reason field by its id on the bar, with the field inside the bar", () => {
    const alert = renderAlertBody(planRequest());
    assert.ok(alert.includes('data-decision-bar data-reason-field="hq-plan-reason"'));
    assert.ok(decisionBarOf(alert).includes('<textarea class="textarea" id="hq-plan-reason"'));
    const card = renderPendingCard(planRequest(), "Heitor");
    assert.ok(card.includes('data-decision-bar data-reason-field="plan-reason"'));
    assert.ok(decisionBarOf(card).includes('id="plan-reason"'));
  });

  it("shows the plan the request carries, with approve by click and keep planning by N", () => {
    const html = renderAlertBody(planRequest());
    assert.ok(html.includes('<article class="hq-plan md" aria-label="Plano proposto" tabindex="0">'));
    assert.ok(html.includes("Encadear"));
    assert.ok(html.includes('data-decide="deny" aria-keyshortcuts="N">Continuar planejando <kbd aria-hidden="true">N</kbd>'));
    assert.ok(html.includes('data-decide="allow">Aprovar plano</button>'));
    assert.ok(!html.includes('aria-keyshortcuts="A"'));
    assert.ok(html.includes('data-decide="terminal"'));
  });

  it("says when the plan was cut and when it never arrived", () => {
    assert.ok(renderAlertBody(planRequest({ isPlanTruncated: true })).includes("Plano cortado, veja o resto no terminal."));
    assert.ok(!renderAlertBody(planRequest()).includes("Plano cortado"));
    assert.ok(renderAlertBody(planRequest({ plan: undefined })).includes("O plano não chegou à Sede."));
  });

  it("titles the card in the sheet with who planned, escaped", () => {
    assert.ok(renderPendingCard(planRequest(), "Heitor <dev>").includes("Heitor &lt;dev&gt; terminou o plano e quer sua aprovação"));
  });
});
