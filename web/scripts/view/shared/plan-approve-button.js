import { PLAN_APPROVAL_TEXT } from "../../data/text/pt-br/plan-approval.js";

// The approve button of a plan, and the line that explains why it is off when the plan arrived cut or not at all. The
// explanation sits in the bar and is tied to the button, so a screen reader hears it on the disabled button too.
export function renderPlanApproveButton({ canApprove, className, whyId }) {
  if (canApprove) return { button: `<button class="${className}" type="button" data-decide="allow">${PLAN_APPROVAL_TEXT.approve}</button>`, why: "" };
  return {
    button: `<button class="${className}" type="button" data-decide="allow" disabled aria-describedby="${whyId}">${PLAN_APPROVAL_TEXT.approve}</button>`,
    why: `<p class="plan-why" id="${whyId}">${PLAN_APPROVAL_TEXT.approveInTerminal}</p>`,
  };
}
