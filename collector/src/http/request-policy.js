const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]", "host.docker.internal"];
const CROSS_SITE = "cross-site";

const hostNameOf = (req) => String(req.headers.host ?? "").replace(/:\d+$/, "").toLowerCase();

// The Host allowlist is what stops DNS rebinding, so extra hosts are named one by one instead of opening the check.
export function createHostPolicy(extraHosts = []) {
  const allowed = new Set([...LOCAL_HOSTS, ...extraHosts.map((host) => host.toLowerCase())]);
  return { allows: (req) => allowed.has(hostNameOf(req)) };
}

// Browsers always send Origin on cross-site POSTs, so a page from another site cannot drive the office controls.
export function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

// A GET needs no preflight, so fetch metadata is what keeps a page from another site from reading the office or counting as a viewer.
export function isCrossSite(req) {
  return req.headers["sec-fetch-site"] === CROSS_SITE;
}

export function isJson(req) {
  return String(req.headers["content-type"] ?? "").toLowerCase().startsWith("application/json");
}
