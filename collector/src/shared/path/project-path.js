const DRIVE_PATH = /^[a-z]:\//i;
const CURRENT_FOLDER = "./";

const withForwardSlashes = (path) => path.replace(/\\/g, "/");
const isAbsolute = (path) => path.startsWith("/") || DRIVE_PATH.test(path);
const lastPartOf = (path) => path.split("/").filter(Boolean).at(-1) ?? "";

function isInside(path, root) {
  if (path.length <= root.length || path[root.length] !== "/") return false;
  const head = path.slice(0, root.length);
  return DRIVE_PATH.test(root) ? head.toLowerCase() === root.toLowerCase() : head === root;
}

function withoutCurrentFolder(path) {
  let relative = path;
  while (relative.startsWith(CURRENT_FOLDER)) relative = relative.slice(CURRENT_FOLDER.length);
  return relative;
}

// A path outside the project would show where the user keeps other things on the machine, so only its name is kept.
export function projectPathOf(path, root) {
  if (typeof path !== "string" || path.length === 0) return "";
  const target = withForwardSlashes(path);
  if (!isAbsolute(target)) return withoutCurrentFolder(target);
  const base = withForwardSlashes(typeof root === "string" ? root : "").replace(/\/+$/, "");
  return base && isInside(target, base) ? target.slice(base.length + 1) : lastPartOf(target);
}
