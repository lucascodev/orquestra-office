export function baseName(path) {
  if (typeof path !== "string" || path.length === 0) return "";
  const parts = path.split(/[\\/]+/).filter(Boolean);
  return parts.at(-1) ?? "";
}
