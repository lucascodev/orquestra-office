const MESSAGE_LIMIT = 8_000;

export function toMessageText(value) {
  return typeof value === "string" ? value.trim().slice(0, MESSAGE_LIMIT) : "";
}
