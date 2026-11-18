import { clip, summarizeTool } from "../../../collector/src/events/tool-summary.js";

const TEXT_LIMIT = 8_000;
const INTERRUPTED = "aborted_streaming";

const entry = (kind, text, detail = "") => ({ kind, text, detail });
const isFromMainAgent = (event) => !event.parent_tool_use_id;

function blockChanges(block) {
  if (block.type === "text" && block.text) return [{ type: "entry", entry: entry("reply", clip(block.text, TEXT_LIMIT)) }];
  if (block.type !== "tool_use") return [];
  const { toolName, summary, detail } = summarizeTool(block.name, block.input);
  return [{ type: "entry", entry: entry("tool", summary ? `${toolName}: ${summary}` : toolName, detail) }];
}

function resultChanges(event) {
  const idle = { type: "status", status: "idle" };
  if (!event.is_error) return [idle];
  if (event.terminal_reason === INTERRUPTED) return [idle, { type: "entry", entry: entry("note", "turno interrompido") }];
  return [idle, { type: "entry", entry: entry("error", "o turno terminou com erro", clip(String(event.result ?? event.subtype ?? ""), TEXT_LIMIT)) }];
}

export function changesOf(event) {
  const session = event.session_id ? [{ type: "session", sessionId: String(event.session_id) }] : [];
  if (event.type === "stream_event" && isFromMainAgent(event)) {
    const { type, delta } = event.event ?? {};
    if (type === "message_start") return [...session, { type: "status", status: "working" }];
    if (type === "content_block_delta" && delta?.type === "text_delta") return [...session, { type: "delta", text: delta.text }];
    return session;
  }
  if (event.type === "assistant" && isFromMainAgent(event)) {
    return [...session, ...(event.message?.content ?? []).flatMap(blockChanges)];
  }
  if (event.type === "result") return [...session, ...resultChanges(event)];
  return session;
}
