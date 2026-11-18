import { summarizeTool } from "../../../collector/src/shared/claude/summarize-tool.js";
import { ENTRY_TEXT } from "../../../collector/src/shared/terminal/entry-text-ids.js";
import { clip } from "../../../collector/src/shared/text/clip.js";

const TEXT_LIMIT = 8_000;
const INTERRUPTED = "aborted_streaming";

const namedEntry = (kind, textId, detail = "") => ({ kind, textId, detail });
const isFromMainAgent = (event) => !event.parent_tool_use_id;

function blockChanges(block) {
  if (block.type === "text" && block.text) return [{ type: "entry", entry: { kind: "reply", text: clip(block.text, TEXT_LIMIT), detail: "" } }];
  if (block.type !== "tool_use") return [];
  const { toolName, summaryId, subject, detail } = summarizeTool(block.name, block.input);
  return [{ type: "entry", entry: { kind: "tool", toolName, summaryId, subject, detail } }];
}

function resultChanges(event) {
  const idle = { type: "status", status: "idle" };
  if (!event.is_error) return [idle];
  if (event.terminal_reason === INTERRUPTED) return [idle, { type: "entry", entry: namedEntry("note", ENTRY_TEXT.TURN_INTERRUPTED) }];
  const failure = clip(String(event.result ?? event.subtype ?? ""), TEXT_LIMIT);
  return [idle, { type: "entry", entry: namedEntry("error", ENTRY_TEXT.TURN_FAILED, failure) }];
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
