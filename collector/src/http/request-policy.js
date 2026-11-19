const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]", "host.docker.internal"];
const OWN_FETCH_SITES = new Set(["same-origin", "none"]);

const hostNameOf = (req) => String(req.headers.host ?? "").replace(/:\d+$/, "").toLowerCase();

// The Host allowlist is what stops DNS rebinding, so extra hosts are named one by one instead of opening the check.
export function createHostPolicy(extraHosts = []) {
  const allowed = new Set([...LOCAL_HOSTS, ...extraHosts.map((host) => host.toLowerCase())]);
  return { allows: (req) => allowed.has(hostNameOf(req)) };
}

const originMatchesHost = (origin, host) => {
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
};

// Browsers send Origin on every POST, their own page's included, so a POST without one does not come from the office page:
// curl, a script or the agent itself. Those are refused even with a cookie.
export function isSameOrigin(req) {
  const origin = req.headers.origin;
  return typeof origin === "string" && originMatchesHost(origin, req.headers.host);
}

// A GET needs no preflight, so fetch metadata is what keeps another page from reading the office or counting as a viewer.
// "same-site" is refused too: another port of localhost, like a dev server, is the same site but not the office.
// Browsers send no fetch metadata over plain HTTP on the LAN, so there the Origin, when present, decides.
export function isFromAnotherPage(req) {
  const site = req.headers["sec-fetch-site"];
  if (site === undefined) return req.headers.origin !== undefined && !originMatchesHost(req.headers.origin, req.headers.host);
  return !OWN_FETCH_SITES.has(site);
}

export function isJson(req) {
  return String(req.headers["content-type"] ?? "").toLowerCase().startsWith("application/json");
}
