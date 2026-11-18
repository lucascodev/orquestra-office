const WINDOWS = "win32";
const FIRST_SAFE_LIBUV = Object.freeze({ major: 1, minor: 48 });
const MAJOR_MINOR = /^(\d+)\.(\d+)(?:\.|$)/;

function isAtLeastFirstSafe(version) {
  const match = MAJOR_MINOR.exec(version ?? "");
  if (!match) return false;
  const [major, minor] = [Number(match[1]), Number(match[2])];
  return major > FIRST_SAFE_LIBUV.major || (major === FIRST_SAFE_LIBUV.major && minor >= FIRST_SAFE_LIBUV.minor);
}

// Windows searches the current folder for git.exe unless NoDefaultCurrentDirectoryInExePath is set, and libuv honors it
// only from 1.48 on (Node 22). On an older libuv, looking up git in an opened repository could run a planted git.exe.
export const canLookUpGitSafely = ({ platform, libuvVersion }) => platform !== WINDOWS || isAtLeastFirstSafe(libuvVersion);
