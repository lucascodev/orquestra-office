import { parseArgs } from "node:util";
import { envValue } from "./env-value.mjs";

export const DEFAULT_OFFICE_URL = "http://127.0.0.1:8420";
export const ALLOW_REMOTE_FLAG = "--allow-remote-office";
export const OFFICE_URL_OPTION = "office-url";

const WEB_PROTOCOLS = new Set(["http:", "https:"]);
const SECURE_PROTOCOL = "https:";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]", "localhost"]);
const LOCALHOST = "localhost";
const IPV4_LOOPBACK = "127.0.0.1";
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

// On Windows localhost resolves to ::1 first, where another process could be listening and receive the tokens and the pairing
// code. Every address, the one written in an earlier install's --office-url included, goes through here, so none of them keeps it.
function withIpv4Loopback(url) {
  if (url.hostname !== LOCALHOST) return url;
  const pinned = new URL(url);
  pinned.hostname = IPV4_LOOPBACK;
  return pinned;
}

export function parseOfficeUrl(raw, { allowRemote = false } = {}) {
  const url = toUrl(raw);
  if (!url) return { problem: "it is not a URL" };
  if (!WEB_PROTOCOLS.has(url.protocol)) return { problem: "it must start with http:// or https://" };
  if (url.username || url.password) return { problem: "it must not carry a user name or password" };
  if (url.pathname !== ROOT_PATH || url.search || url.hash) return { problem: "it must be only scheme, host and port, with no path, query or fragment" };
  if (!SHELL_SAFE_ORIGIN.test(url.origin)) return { problem: "its host may hold only letters, digits, dots, hyphens, colons and the brackets of an IPv6 address" };
  if (LOOPBACK_HOSTS.has(url.hostname)) return { origin: withIpv4Loopback(url).origin };
  if (!allowRemote) return { problem: `it is not on this machine (127.0.0.1 or ::1); pass ${ALLOW_REMOTE_FLAG} to use another address` };
  if (url.protocol !== SECURE_PROTOCOL) return { problem: "a remote office needs https://" };
  return { origin: url.origin };
}

export function installerOfficeUrl(env, options) {
  const raw = envValue(env, "OFFICE_URL");
  return raw === undefined ? { origin: DEFAULT_OFFICE_URL } : parseOfficeUrl(raw, options);
}

// Hooks take the address the installer wrote into their command, never OFFICE_URL: a project's .claude/settings.json can set
// environment variables, and with one point the activity token at a server it chose. The installer already vetted the address,
// remote ones included. Without the argument (installs from before it existed) the default office is used; a refused value
// turns the hook off instead of falling back.
export function officeUrlFromArguments(args) {
  const { values } = parseArgs({ args, options: { [OFFICE_URL_OPTION]: { type: "string" } }, strict: false });
  const raw = values[OFFICE_URL_OPTION];
  if (raw === undefined) return DEFAULT_OFFICE_URL;
  return typeof raw === "string" ? parseOfficeUrl(raw, { allowRemote: true }).origin ?? null : null;
}
