import { publicDeviceOf } from "../access/domain/device-sessions.js";
import { HOOK_ACCESS } from "./hook-auth.js";
import { readJsonBody, readRawBody, sendJson, sendJsonText } from "./json-io.js";
import { isJson, isSameOrigin } from "./request-policy.js";

const BOOTSTRAP_PATH = "/pairing/bootstrap";
const REDEEM_PATH = "/api/pairings/redeem";
const PAIRINGS_PATH = "/api/pairings";
const DEVICES_PATH = "/api/devices";
const REVOKE_ROUTE = /^\/api\/devices\/([\w-]+)\/revoke$/;
const BODY_LIMIT = 4 * 1024;
const OK_STATUS = 200;
const TOO_MANY_CODES = { error: "too many pending pairing codes" };

export function createPairingRoutes({ hookAuth, panelAuth, issuePairingCode, redeemPairing, revokeDevice, listDevices }) {
  const requestHostOf = (req) => String(req.headers.host ?? "");

  // The first browser is paired by a command on this machine, which proves it holds the secret by signing the request.
  async function bootstrap(req, res) {
    if (!isJson(req)) return sendJson(res, 415, {});
    const body = await readRawBody(req, BODY_LIMIT);
    const { access, nonce } = hookAuth.signedAccessOf(req, BOOTSTRAP_PATH, body);
    if (access !== HOOK_ACCESS.GRANTED) return sendJson(res, 401, { error: "invalid signature" });
    const issued = issuePairingCode({ requestHost: requestHostOf(req) });
    if (!issued) return sendJson(res, 429, TOO_MANY_CODES);
    const text = JSON.stringify(issued);
    const signature = hookAuth.responseSignatureOf({ path: BOOTSTRAP_PATH, nonce, status: OK_STATUS, body: text });
    if (!signature) return sendJson(res, 401, { error: "office secret missing" });
    return sendJsonText(res, OK_STATUS, text, signature);
  }

  async function redeem(req, res) {
    if (!isJson(req)) return sendJson(res, 415, {});
    if (!isSameOrigin(req)) return sendJson(res, 403, { error: "forbidden origin" });
    const body = await readJsonBody(req, BODY_LIMIT);
    const redeemed = redeemPairing({ code: body?.code, label: body?.label, host: requestHostOf(req) });
    if (!redeemed) return sendJson(res, 400, { error: "invalid pairing code" });
    res.writeHead(204, { "Set-Cookie": panelAuth.sessionCookie(redeemed.token), "Cache-Control": "no-store" });
    return res.end();
  }

  function issue(req, res) {
    if (!panelAuth.admit(req, res)) return undefined;
    const issued = issuePairingCode({ requestHost: requestHostOf(req) });
    return issued ? sendJson(res, OK_STATUS, issued) : sendJson(res, 429, TOO_MANY_CODES);
  }

  function devices(req, res) {
    const session = panelAuth.admit(req, res);
    if (!session) return undefined;
    return sendJson(res, OK_STATUS, { devices: listDevices().map((device) => publicDeviceOf(device, session.device.id)) });
  }

  function revoke(req, res, id) {
    const session = panelAuth.admit(req, res);
    if (!session) return undefined;
    if (!revokeDevice(id)) return sendJson(res, 404, {});
    const headers = id === session.device.id ? { "Set-Cookie": panelAuth.clearedCookie(), "Cache-Control": "no-store" } : { "Cache-Control": "no-store" };
    res.writeHead(204, headers);
    return res.end();
  }

  function routeOf(method, pathname) {
    if (method === "POST" && pathname === BOOTSTRAP_PATH) return bootstrap;
    if (method === "POST" && pathname === REDEEM_PATH) return redeem;
    if (method === "POST" && pathname === PAIRINGS_PATH) return issue;
    if (method === "GET" && pathname === DEVICES_PATH) return devices;
    const revokeRoute = method === "POST" ? REVOKE_ROUTE.exec(pathname) : null;
    return revokeRoute ? (req, res) => revoke(req, res, revokeRoute[1]) : null;
  }

  return {
    handles: (method, pathname) => routeOf(method, pathname) !== null,
    handle: (req, res, url) => routeOf(req.method, url.pathname)(req, res),
  };
}
