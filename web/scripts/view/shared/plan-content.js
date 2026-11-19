import { PLAN_APPROVAL_TEXT } from "../../data/text/pt-br/plan-approval.js";
import { renderPlanMarkdown } from "./plan-markdown.js";

// The plan a request carries, as both the alert and the sheet's card show it: the markdown in the restricted profile, a line
// when the collector cut it, and a note sending the reader to the terminal when it never arrived.
export function renderPlanContent(plan) {
  if (!plan) return `<p class="muted">${PLAN_APPROVAL_TEXT.missing}</p>`;
  const cut = plan.isTruncated ? `<p class="plan-cut">${PLAN_APPROVAL_TEXT.truncated}</p>` : "";
  return `${renderPlanMarkdown(plan.text)}${cut}`;
}
