import { agentKeyOf } from "../office/domain/agent-key.js";
import { clip } from "../shared/text/clip.js";
import { summarizeTool } from "../shared/claude/summarize-tool.js";
import { ENTRY_TEXT } from "../shared/terminal/entry-text-ids.js";
import { claudeSessionIdOf } from "./claude-session-id.js";

const TEXT_LIMIT = 4_000;
const TOOL_NAME_LIMIT = 60;
const BACKGROUND_NOTICE = "<task-notification>";

// Claude Code also reports finished background tasks through UserPromptSubmit; those are not something the user typed.
function promptEntry(prompt) {
  if (String(prompt ?? "").startsWith(BACKGROUND_NOTICE)) return { kind: "note", textId: ENTRY_TEXT.BACKGROUND_TASK_FINISHED };
  return { kind: "prompt", text: clip(prompt, TEXT_LIMIT) };
}

function entryOf(payload) {
  switch (payload.hook_event_name) {
    case "UserPromptSubmit":
      return promptEntry(payload.prompt);
    case "PreToolUse": {
      const { toolName, summaryId, subject, detail } = summarizeTool(payload.tool_name, payload.tool_input);
      return { kind: "tool", toolName, summaryId, subject, detail };
    }
    case "PostToolUseFailure": {
      const toolName = payload.tool_name == null ? null : clip(String(payload.tool_name), TOOL_NAME_LIMIT);
      return { kind: "error", textId: ENTRY_TEXT.TOOL_FAILED, subject: toolName, detail: clip(payload.error, TEXT_LIMIT) };
    }
    case "Stop":
    case "SubagentStop":
      return payload.last_assistant_message ? { kind: "reply", text: clip(payload.last_assistant_message, TEXT_LIMIT) } : null;
    case "StopFailure":
      return { kind: "error", textId: ENTRY_TEXT.API_ERROR, detail: clip(payload.error, TEXT_LIMIT) };
    default:
      return null;
  }
}

const isEmpty = (entry) => (entry.kind === "tool" ? !entry.toolName : !entry.textId && !entry.text);

function claudeAgentKey(payload) {
  return agentKeyOf({ source: "claude", sessionId: claudeSessionIdOf(payload), agentId: payload.agent_id ? String(payload.agent_id) : null });
}

export function claudeHistoryEntry(payload, now = Date.now()) {
  if (!payload || typeof payload !== "object" || !payload.session_id) return null;
  const entry = entryOf(payload);
  if (!entry || isEmpty(entry)) return null;
  return { agentKey: claudeAgentKey(payload), entry: { at: now, detail: "", ...entry } };
}
