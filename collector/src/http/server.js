import { createServer as createHttpServer } from "node:http";
import { BODY_TOO_LARGE, sendJson } from "./json-io.js";
import { createHostPolicy } from "./request-policy.js";
import { requestUrlOf } from "./request-url.js";
import { applySecurityHeaders } from "./security-headers.js";
import { serveFile } from "./static-files.js";

export function createServer({ allowedHosts, webDir, hookRoutes, officeApi }) {
  const hosts = createHostPolicy(allowedHosts);

  async function handleGet(req, res, url) {
    if (officeApi.handlesGet(url.pathname)) return officeApi.get(req, res, url);
    if (await serveFile(res, webDir, url.pathname)) return undefined;
    return sendJson(res, 404, {});
  }

  async function route(req, res) {
    if (!hosts.allows(req)) return sendJson(res, 403, { error: "forbidden host" });
    const url = requestUrlOf(req);
    if (!url) return sendJson(res, 400, { error: "invalid url" });

    if (req.method === "POST" && hookRoutes.handles(url.pathname)) return hookRoutes.handle(req, res, url);
    if (req.method === "POST") return officeApi.post(req, res, url);
    if (req.method !== "GET") return sendJson(res, 405, {});
    return handleGet(req, res, url);
  }

  // Destroying the request once the answer is out stops reading the rest of an oversized body.
  function refuseOversizedBody(req, res) {
    res.setHeader("Connection", "close");
    res.once("finish", () => req.destroy());
    sendJson(res, 413, { error: "body too large" });
  }

  // Any page open in the browser can send a request here, so no single request may take the office down.
  function failSafely(res, error) {
    console.error("office request failed:", error);
    if (res.headersSent) res.destroy();
    else sendJson(res, 500, {});
  }

  function answerFailure(req, res, error) {
    if (error?.code === BODY_TOO_LARGE && !res.headersSent) return refuseOversizedBody(req, res);
    return failSafely(res, error);
  }

  return createHttpServer((req, res) => {
    applySecurityHeaders(res);
    route(req, res).catch((error) => answerFailure(req, res, error));
  });
}
