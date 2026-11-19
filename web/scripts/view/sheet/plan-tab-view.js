import { PLAN_LOADING, PLAN_STATES, PLAN_TEXT } from "../../data/text/pt-br/work-sheet.js";
import { fillPhrase } from "../../domain/text/fill-phrase.js";
import { esc } from "../shared/escape-html.js";
import { clockTime } from "../shared/format.js";
import { renderPlanMarkdown } from "../shared/plan-markdown.js";

const STATE_MARKS = { proposed: "!", approved: "✓", revised: "↺" };
const READY = "ready";

function planBody(text, loading) {
  if (loading === READY && text) return renderPlanMarkdown(text);
  return `<p class="work-muted">${PLAN_LOADING[loading] ?? PLAN_LOADING.missing}</p>`;
}

// The Plano tab: the state and version the stream tells, and the text fetched for that version once the tab opens.
// loading is "loading", "failed", "missing" or "ready".
export function renderPlanTab(status, { text = null, loading = "loading" } = {}) {
  if (!status) return `<p class="work-empty">${PLAN_TEXT.empty}</p>`;
  const stateText = fillPhrase(PLAN_STATES[status.state], { subject: status.at ? clockTime(status.at) : null });
  const version = fillPhrase(PLAN_TEXT.version, status);
  return `<div class="work-stack">
    <p class="work-plan-state" data-state="${status.state}"><span class="work-plan-mark" aria-hidden="true">${STATE_MARKS[status.state]}</span><span class="work-plan-when">${esc(stateText)}</span><span class="work-muted">${version}</span></p>
    <article class="work-plan md" aria-label="${fillPhrase(PLAN_TEXT.label, status)}" aria-busy="${loading === "loading"}">${planBody(text, loading)}</article>
  </div>`;
}
