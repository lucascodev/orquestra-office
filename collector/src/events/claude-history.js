import { agentKeyOf } from "../office/agent-key.js";
import { clip } from "../shared/text/clip.js";
import { summarizeTool } from "../shared/claude/summarize-tool.js";

const TEXT_LIMIT = 4_000;
const BACKGROUND_NOTICE = "<task-notification>";

// Claude Code also reports finished background tasks through UserPromptSubmit; those are not something the user typed.
function promptEntry(prompt) {
  if (String(prompt ?? "").startsWith(BACKGROUND_NOTICE)) return { kind: "note", text: "uma tarefa em segundo plano terminou" };
  return { kind: "prompt", text: clip(prompt, TEXT_LIMIT) };
}

function entryOf(payload) {
  switch (payload.hook_event_name) {
    case "UserPromptSubmit":
      return promptEntry(payload.prompt);
    case "PreToolUse": {
      const { toolName, summary, detail } = summarizeTool(payload.tool_name, payload.tool_input);
      return { kind: "tool", text: summary ? `${toolName}: ${summary}` : toolName, detail };
    }
    case "PostToolUseFailure":
      return { kind: "error", text: `${clip(String(payload.tool_name ?? "ferramenta"), 60)} falhou`, detail: clip(payload.error, TEXT_LIMIT) };
    case "Stop":
    case "SubagentStop":
      return payload.last_assistant_message ? { kind: "reply", text: clip(payload.last_assistant_message, TEXT_LIMIT) } : null;
    case "StopFailure":
      return { kind: "error", text: "parou por erro da API", detail: clip(payload.error, TEXT_LIMIT) };
    default:
      return null;
  }
}

export function claudeAgentKey(payload) {
  return agentKeyOf({ source: "claude", sessionId: String(payload.session_id), agentId: payload.agent_id ? String(payload.agent_id) : null });
}

export function claudeHistoryEntry(payload, now = Date.now()) {
  if (!payload || typeof payload !== "object" || !payload.session_id) return null;
  const entry = entryOf(payload);
  if (!entry || !entry.text) return null;
  return { agentKey: claudeAgentKey(payload), entry: { at: now, detail: "", ...entry } };
}
