import { envValue } from "./env-value.mjs";

export const DEFAULT_OFFICE_URL = "http://127.0.0.1:8420";
export const ALLOW_REMOTE_FLAG = "--allow-remote-office";

const WEB_PROTOCOLS = new Set(["http:", "https:"]);
const SECURE_PROTOCOL = "https:";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]", "localhost"]);
const ROOT_PATH = "/";
// The URL parser lets $, `, ", ; and friends through in a host name, and the origin is written inside a shell command.
const SHELL_SAFE_ORIGIN = /^https?:\/\/[a-z0-9.\-:[\]]+$/i;

const toUrl = (raw) => {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
};

export function parseOfficeUrl(raw, { allowRemote = false } = {}) {
  const url = toUrl(raw);
  if (!url) return { problem: "it is not a URL" };
  if (!WEB_PROTOCOLS.has(url.protocol)) return { problem: "it must start with http:// or https://" };
  if (url.username || url.password) return { problem: "it must not carry a user name or password" };
  if (url.pathname !== ROOT_PATH || url.search || url.hash) return { problem: "it must be only scheme, host and port, with no path, query or fragment" };
  if (!SHELL_SAFE_ORIGIN.test(url.origin)) return { problem: "its host may hold only letters, digits, dots, hyphens, colons and the brackets of an IPv6 address" };
  if (LOOPBACK_HOSTS.has(url.hostname)) return { origin: url.origin };
  if (!allowRemote) return { problem: `it is not on this machine (127.0.0.1, ::1 or localhost); pass ${ALLOW_REMOTE_FLAG} to use another address` };
  if (url.protocol !== SECURE_PROTOCOL) return { problem: "a remote office needs https://" };
  return { origin: url.origin };
}

export function installerOfficeUrl(env, options) {
  const raw = envValue(env, "OFFICE_URL");
  return raw === undefined ? { origin: DEFAULT_OFFICE_URL } : parseOfficeUrl(raw, options);
}

// Hooks read OFFICE_URL at run time, where a project's .claude/settings.json can set it. A refused value turns the hook off
// instead of falling back, so a session aimed elsewhere never ends up reported to this machine's office.
export const officeUrlFrom = (env) => installerOfficeUrl(env).origin ?? null;
