import { createServer as createHttpServer } from "node:http";
import { sendJson } from "./json-io.js";
import { createHostPolicy } from "./request-policy.js";
import { serveFile } from "./static-files.js";

export function createServer({ allowedHosts, webDir, hookRoutes, officeApi }) {
  const hosts = createHostPolicy(allowedHosts);

  async function handleGet(req, res, url) {
    if (officeApi.handlesGet(url.pathname)) return officeApi.get(req, res, url);
    if (await serveFile(res, webDir, url.pathname)) return undefined;
    return sendJson(res, 404, {});
  }

  return createHttpServer(async (req, res) => {
    if (!hosts.allows(req)) return sendJson(res, 403, { error: "forbidden host" });
    const url = new URL(req.url ?? "/", "http://localhost");

    if (req.method === "POST" && hookRoutes.handles(url.pathname)) return hookRoutes.handle(req, res, url);
    if (req.method === "POST") return officeApi.post(req, res, url);
    if (req.method !== "GET") return sendJson(res, 405, {});
    return handleGet(req, res, url);
  });
}
