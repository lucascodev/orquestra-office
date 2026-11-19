import { AGENT_ACTION } from "../../office/domain/agent-actions.js";
import { summarizeTool } from "../../shared/claude/summarize-tool.js";
import { TOOL_SUMMARY } from "../../shared/claude/tool-summary-ids.js";
import { ENTRY_TEXT } from "../../shared/terminal/entry-text-ids.js";
import { planTextOf } from "../../work/domain/plan-text.js";

const PLAN_TOOL = "ExitPlanMode";
const NO_PLAN = Object.freeze({ text: "", length: 0, isTruncated: false });

function requestedTool(toolName, toolInput) {
  const described = summarizeTool(toolName, toolInput);
  if (described.summaryId) return described;
  return { ...described, summaryId: TOOL_SUMMARY.USE_TOOL, subject: described.toolName || null };
}

// The page shows the plan to approve from this signed request, never from the activity hooks, which carry only a token
// and could show one plan while the signed request approves another. The plan replaces the raw input in the detail, so
// it is shown once and already masked.
function planRequestOf(toolInput) {
  const plan = planTextOf(toolInput?.plan) ?? NO_PLAN;
  return { detail: "", plan: plan.text, planLength: plan.length, isPlanTruncated: plan.isTruncated };
}

export function createHoldPermission({ holdRequest, activity }) {
  return async function holdPermission({ actor, toolName, toolInput, onAbort }) {
    const tool = requestedTool(toolName, toolInput);
    const plan = toolName === PLAN_TOOL ? planRequestOf(toolInput) : {};
    const answer = await holdRequest(actor, { kind: "permission", ...tool, ...plan }, onAbort);
    if (!answer) return null;
    const isAllowed = answer.behavior === "allow";
    const decided = { actionId: isAllowed ? AGENT_ACTION.PERMISSION_APPROVED : AGENT_ACTION.PERMISSION_DENIED, subject: tool.toolName };
    activity.note(actor, decided, {
      textId: isAllowed ? ENTRY_TEXT.PERMISSION_APPROVED : ENTRY_TEXT.PERMISSION_DENIED,
      toolName: tool.toolName,
      summaryId: tool.summaryId,
      subject: tool.subject,
    });
    return answer;
  };
}
