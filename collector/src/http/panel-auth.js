import { sendJson } from "./json-io.js";
import { isFromAnotherPage, isJson, isSameOrigin } from "./request-policy.js";

const COOKIE_NAME = "office_session";
const MAX_AGE_SECONDS = 90 * 24 * 60 * 60;
// No Secure flag: the office is plain HTTP, on localhost and on the LAN.
const COOKIE_ATTRIBUTES = "HttpOnly; SameSite=Strict; Path=/api";
const COOKIE_PAIR = /(?:^|;\s*)office_session=([\w-]+)(?:;|$)/;

const cookieTokenOf = (req) => COOKIE_PAIR.exec(String(req.headers.cookie ?? ""))?.[1] ?? null;

export function createPanelAuth({ identifyDevice, isSecretMissing }) {
  function sessionOf(req) {
    const token = cookieTokenOf(req);
    const device = token ? identifyDevice(token) : null;
    return device ? { device, token } : null;
  }

  const sessionCookie = (token) => `${COOKIE_NAME}=${token}; ${COOKIE_ATTRIBUTES}; Max-Age=${MAX_AGE_SECONDS}`;
  const clearedCookie = () => `${COOKIE_NAME}=; ${COOKIE_ATTRIBUTES}; Max-Age=0`;

  function refuse(res) {
    return sendJson(res, 401, isSecretMissing() ? { error: "unpaired", isSecretMissing: true } : { error: "unpaired" });
  }

  // The cookie is checked first, so an unpaired caller learns nothing but 401, then the same-page rules apply as before.
  function admit(req, res) {
    const session = sessionOf(req);
    if (!session) return void refuse(res);
    if (req.method === "GET" && isFromAnotherPage(req)) return void sendJson(res, 403, { error: "forbidden site" });
    if (req.method === "POST" && !isJson(req)) return void sendJson(res, 415, {});
    if (req.method === "POST" && !isSameOrigin(req)) return void sendJson(res, 403, { error: "forbidden origin" });
    return session;
  }

  return { admit, sessionOf, sessionCookie, clearedCookie };
}
