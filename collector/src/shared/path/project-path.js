const DRIVE_PATH = /^[a-z]:\//i;
const DRIVE_PATH_IN_URL = /^\/[a-z]:\//i;
// Two letters or more, so a drive letter is never taken for a scheme: file:///x, file:/x and webpack:///x are all paths.
const URL_SCHEME = /^[a-z][a-z0-9+.-]+:\/+/i;
const UNC_PREFIX = "//";
const HOME_FOLDER = "~";
const ROOT_FOLDER = "/";
const DRIVE_ANCHOR_LENGTH = "C:/".length;
const CURRENT_FOLDER = ".";
const PARENT_FOLDER = "..";

const withForwardSlashes = (path) => path.replace(/\\/g, "/");
const isHomePath = (path) => path === HOME_FOLDER || path.startsWith(`${HOME_FOLDER}/`);
const isAbsolute = (path) => path.startsWith(ROOT_FOLDER) || DRIVE_PATH.test(path) || isHomePath(path);
const lastPartOf = (path) => path.split("/").filter(Boolean).at(-1) ?? "";

// A malformed escape is kept as written: the path then only fails to match the root and keeps just its name.
function decodedOrAsWritten(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

// A URL becomes the path after its scheme: "file:///C:/x" is C:/x and "webpack:///home/x" is /home/x. A host such as
// "file://host/share/x" reads as /host/share/x, a folder outside any project, so only the file name is kept.
function localPathOf(path) {
  const scheme = URL_SCHEME.exec(path);
  if (!scheme) return path;
  const rest = `${ROOT_FOLDER}${decodedOrAsWritten(path.slice(scheme[0].length))}`;
  return DRIVE_PATH_IN_URL.test(rest) ? rest.slice(1) : rest;
}

function anchorOf(path) {
  if (DRIVE_PATH.test(path)) return path.slice(0, DRIVE_ANCHOR_LENGTH);
  if (path.startsWith(UNC_PREFIX)) return UNC_PREFIX;
  return path.startsWith(ROOT_FOLDER) ? ROOT_FOLDER : "";
}

// Resolves "." and ".." as the file system would, so "root/../elsewhere" cannot pass for a path inside the root. A
// relative path keeps the ".." that climb above where it starts.
function normalizedPath(path) {
  const anchor = anchorOf(path);
  const parts = [];
  for (const part of path.slice(anchor.length).split("/")) {
    if (part === "" || part === CURRENT_FOLDER) continue;
    if (part !== PARENT_FOLDER) parts.push(part);
    else if (parts.length > 0 && parts.at(-1) !== PARENT_FOLDER) parts.pop();
    else if (!anchor) parts.push(PARENT_FOLDER);
  }
  return `${anchor}${parts.join("/")}`;
}

function isInside(path, root) {
  if (path.length <= root.length || path[root.length] !== "/") return false;
  const head = path.slice(0, root.length);
  return DRIVE_PATH.test(root) ? head.toLowerCase() === root.toLowerCase() : head === root;
}

const climbsOut = (relativePath) => relativePath.split("/")[0] === PARENT_FOLDER;

// A path outside the project would show where the user keeps other things on the machine, so only its name is kept.
export function projectPathOf(path, root) {
  if (typeof path !== "string" || path.length === 0) return "";
  const target = normalizedPath(withForwardSlashes(localPathOf(path)));
  if (!isAbsolute(target)) return climbsOut(target) ? lastPartOf(target) : target;
  const base = normalizedPath(withForwardSlashes(typeof root === "string" ? root : ""));
  return base && isInside(target, base) ? target.slice(base.length + 1) : lastPartOf(target);
}
