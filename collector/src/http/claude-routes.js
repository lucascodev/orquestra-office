import { normalizeClaudeEvent, officeActionEvent } from "../claude/claude-event.js";
import { claudeAgentKey, claudeHistoryEntry } from "../claude/claude-history-entry.js";
import { continueWithMessages, NO_DECISION, permissionResponse, questionResponse } from "../claude/hook-responses.js";
import { questionsOf } from "../claude/hook-questions.js";
import { normalizeStatusline } from "../claude/statusline-reading.js";
import { summarizeTool } from "../shared/claude/summarize-tool.js";

export function createClaudeRoutes({ store, decisions, outbox, history, hasViewers }) {
  function note(payload, action, entry) {
    store.apply(officeActionEvent(payload, action));
    history.add(claudeAgentKey(payload), { at: Date.now(), kind: "note", detail: "", ...entry });
  }

  function record(payload) {
    store.apply(normalizeClaudeEvent(payload));
    const item = claudeHistoryEntry(payload);
    if (item) history.add(item.agentKey, item.entry);
  }

  async function heldAnswer(payload, request, onAbort) {
    if (!payload?.session_id || !hasViewers()) return null;
    const { id, answer } = decisions.hold({ agentKey: claudeAgentKey(payload), ...request });
    onAbort(() => decisions.settle(id, null));
    return answer;
  }

  async function permission(payload, onAbort) {
    record(payload);
    const described = summarizeTool(payload?.tool_name, payload?.tool_input);
    const tool = { ...described, summary: described.summary || `Usar ${described.toolName || "uma ferramenta"}` };
    const answer = await heldAnswer(payload, { kind: "permission", ...tool }, onAbort);
    if (!answer) return NO_DECISION;
    const verb = answer.behavior === "allow" ? "aprovou" : "recusou";
    note(payload, `você ${verb} ${tool.toolName} pelo escritório`, { text: `você ${verb}: ${tool.summary}` });
    return permissionResponse(answer.behavior, answer.message);
  }

  async function question(payload, onAbort) {
    const questions = questionsOf(payload?.tool_input);
    if (questions.length === 0) return NO_DECISION;
    const answer = await heldAnswer(payload, { kind: "question", toolName: "AskUserQuestion", summary: "Tem uma pergunta para você", detail: "", questions }, onAbort);
    if (!answer) return NO_DECISION;
    note(payload, "você respondeu pelo escritório", { text: `você respondeu: ${Object.values(answer.answers).join(" · ")}` });
    return questionResponse(payload.tool_input.questions, answer.answers);
  }

  function stop(payload) {
    const messages = payload?.session_id && !payload.agent_id ? outbox.take(claudeAgentKey(payload)) : [];
    record(payload);
    if (messages.length === 0) return NO_DECISION;
    store.apply(officeActionEvent(payload, "recebeu sua mensagem pelo escritório"));
    return continueWithMessages(messages);
  }

  return {
    "/events/claude": (payload) => { record(payload); return NO_DECISION; },
    "/events/statusline": (payload) => { store.recordUsage(normalizeStatusline(payload)); return NO_DECISION; },
    "/hooks/claude/permission": permission,
    "/hooks/claude/question": question,
    "/hooks/claude/stop": stop,
  };
}
