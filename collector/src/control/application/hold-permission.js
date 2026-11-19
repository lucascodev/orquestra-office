import { AGENT_ACTION } from "../../office/domain/agent-actions.js";
import { summarizeTool } from "../../shared/claude/summarize-tool.js";
import { TOOL_SUMMARY } from "../../shared/claude/tool-summary-ids.js";
import { ENTRY_TEXT } from "../../shared/terminal/entry-text-ids.js";

function requestedTool(toolName, toolInput) {
  const described = summarizeTool(toolName, toolInput);
  if (described.summaryId) return described;
  return { ...described, summaryId: TOOL_SUMMARY.USE_TOOL, subject: described.toolName || null };
}

export function createHoldPermission({ holdRequest, activity }) {
  return async function holdPermission({ actor, toolName, toolInput, onAbort }) {
    const tool = requestedTool(toolName, toolInput);
    const answer = await holdRequest(actor, { kind: "permission", ...tool }, onAbort);
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
