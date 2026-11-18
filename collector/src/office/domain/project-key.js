const NO_FOLDER = "sem-pasta";

export function projectKeyOf(cwd) {
  const normalized = String(cwd || NO_FOLDER).replace(/\\/g, "/").replace(/\/+$/, "");
  return /^[a-z]:\//i.test(normalized) ? normalized.toLowerCase() : normalized;
}
