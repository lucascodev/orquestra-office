import { join } from "node:path";

const WINDOWS = "win32";
const WINDOWS_NULL_DEVICE = "NUL";
const POSIX_NULL_DEVICE = "/dev/null";
const DEFAULT_SYSTEM_ROOT = "C:\\Windows";
const POSIX_CURL_PATHS = ["/usr/bin/curl", "/bin/curl", "/usr/local/bin/curl", "/opt/homebrew/bin/curl"];
const MAX_SECONDS = "3";
// curl honors HTTP_PROXY and friends: without --noproxy a proxy would see every event on its way to the office.
const SKIP_PROXY = ["--noproxy", "*"];

export const nullDeviceOf = (platform) => (platform === WINDOWS ? WINDOWS_NULL_DEVICE : POSIX_NULL_DEVICE);

// The absolute path goes into the settings, so a curl.exe planted in a project folder or early in PATH is never the one run.
export function findCurl({ platform, systemRoot, exists }) {
  const candidates = platform === WINDOWS ? [join(systemRoot || DEFAULT_SYSTEM_ROOT, "System32", "curl.exe")] : POSIX_CURL_PATHS;
  return candidates.find((path) => exists(path)) ?? null;
}

// The token is read by curl from the header file, never passed in argv, where ps shows it to every user on macOS and Linux.
// The answer goes to the null device, so there is nothing on stdout for Claude Code to read as hook output.
export const curlPostArgs = ({ url, nullDevice, activityHeaderFile }) => [
  "-s", ...SKIP_PROXY, "-m", MAX_SECONDS, "-o", nullDevice, "-H", `@${activityHeaderFile}`, "-H", "Content-Type: application/json", "--data-binary", "@-", url,
];
