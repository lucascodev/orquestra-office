export function clip(text, limit) {
  const value = typeof text === "string" ? text : "";
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}
