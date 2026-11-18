import { AGENT_ACTION } from "../../office/domain/agent-actions.js";
import { summarizeTool } from "../../shared/claude/summarize-tool.js";
import { TOOL_SUMMARY } from "../../shared/claude/tool-summary-ids.js";
import { ENTRY_TEXT } from "../../shared/terminal/entry-text-ids.js";

const UNNAMED_TOOL = "uma ferramenta";

export function createHoldPermission({ holdRequest, activity }) {
  return async function holdPermission({ actor, toolName, toolInput, onAbort }) {
    const described = summarizeTool(toolName, toolInput);
    const tool = described.summaryId
      ? described
      : { ...described, summaryId: TOOL_SUMMARY.USE_TOOL, subject: described.toolName || null, summary: `Usar ${described.toolName || UNNAMED_TOOL}` };
    const answer = await holdRequest(actor, { kind: "permission", ...tool }, onAbort);
    if (!answer) return null;
    const isAllowed = answer.behavior === "allow";
    const verb = isAllowed ? "aprovou" : "recusou";
    const decided = {
      actionId: isAllowed ? AGENT_ACTION.PERMISSION_APPROVED : AGENT_ACTION.PERMISSION_DENIED,
      subject: tool.toolName,
      action: `você ${verb} ${tool.toolName} pelo escritório`,
    };
    activity.note(actor, decided, {
      textId: isAllowed ? ENTRY_TEXT.PERMISSION_APPROVED : ENTRY_TEXT.PERMISSION_DENIED,
      toolName: tool.toolName,
      summaryId: tool.summaryId,
      subject: tool.subject,
      text: `você ${verb}: ${tool.summary}`,
    });
    return answer;
  };
}
