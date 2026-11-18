const URL_BASE = "http://localhost";

export function requestUrlOf(req) {
  const path = req.url ?? "/";
  return URL.canParse(path, URL_BASE) ? new URL(path, URL_BASE) : null;
}
