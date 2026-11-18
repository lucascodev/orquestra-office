import { summarizeTool } from "../../shared/claude/summarize-tool.js";

const UNNAMED_TOOL = "uma ferramenta";

export function createHoldPermission({ holdRequest, activity }) {
  return async function holdPermission({ actor, toolName, toolInput, onAbort }) {
    const described = summarizeTool(toolName, toolInput);
    const tool = { ...described, summary: described.summary || `Usar ${described.toolName || UNNAMED_TOOL}` };
    const answer = await holdRequest(actor, { kind: "permission", ...tool }, onAbort);
    if (!answer) return null;
    const verb = answer.behavior === "allow" ? "aprovou" : "recusou";
    activity.note(actor, `você ${verb} ${tool.toolName} pelo escritório`, `você ${verb}: ${tool.summary}`);
    return answer;
  };
}
