const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const BODY_LIMIT = 64 * 1024;

export function isLocalHost(req) {
  const host = String(req.headers.host ?? "").replace(/:\d+$/, "").toLowerCase();
  return LOCAL_HOSTS.has(host);
}

// A request with no Origin does not come from a web page; any page that is not the office is refused.
export function createOriginPolicy(allowedOrigins) {
  const allowed = new Set(allowedOrigins);
  return {
    allows: (req) => !req.headers.origin || allowed.has(req.headers.origin),
    headersFor: (req) => (allowed.has(req.headers.origin)
      ? { "Access-Control-Allow-Origin": req.headers.origin, "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", Vary: "Origin" }
      : {}),
  };
}

export function isJson(req) {
  return String(req.headers["content-type"] ?? "").toLowerCase().startsWith("application/json");
}

export function readJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size <= BODY_LIMIT) chunks.push(chunk);
    });
    req.on("end", () => {
      if (size > BODY_LIMIT) return resolve(null);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

const BEARER = /^Bearer ([\w-]+)$/;

// EventSource cannot send headers, so the stream alone takes the token from the address.
export function tokenOf(req, url, { isStream }) {
  const [, bearer] = BEARER.exec(String(req.headers.authorization ?? "")) ?? [];
  if (bearer) return bearer;
  return isStream ? url.searchParams.get("token") : null;
}
