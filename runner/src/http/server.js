import { createServer as createHttpServer } from "node:http";
import { createOriginPolicy, isJson, isLocalHost, readJsonBody } from "./request-guard.js";

const SESSION_ID_WAIT_MS = 20_000;
const HEARTBEAT_MS = 25_000;
const MESSAGE_LIMIT = 8_000;

export function createServer({ registry, allowedOrigins }) {
  const origins = createOriginPolicy(allowedOrigins);

  function sendJson(req, res, status, body) {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...origins.headersFor(req) });
    res.end(JSON.stringify(body));
  }

  function streamSession(req, res, session) {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive", ...origins.headersFor(req) });
    const write = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    write("snapshot", { session: session.summary(), ...session.transcript() });
    const unsubscribe = session.subscribe((change) => write("change", change));
    const heartbeat = setInterval(() => res.write(": ping\n\n"), HEARTBEAT_MS);
    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  }

  async function openSession(req, res) {
    const body = await readJsonBody(req);
    const { session, error } = registry.open({ cwd: body?.cwd, prompt: body?.prompt });
    if (error) return sendJson(req, res, 400, { error });
    await session.sessionIdWithin(SESSION_ID_WAIT_MS);
    return sendJson(req, res, 201, { session: session.summary() });
  }

  async function actOnSession(req, res, session, action) {
    if (action === "interrupt") return sendJson(req, res, session.interrupt() ? 200 : 409, {});
    if (action === "stop") return sendJson(req, res, session.stop() ? 200 : 409, {});
    const body = await readJsonBody(req);
    const text = typeof body?.text === "string" ? body.text.trim().slice(0, MESSAGE_LIMIT) : "";
    if (!text) return sendJson(req, res, 400, { error: "Mensagem vazia." });
    return sendJson(req, res, session.send(text) ? 200 : 409, {});
  }

  return createHttpServer(async (req, res) => {
    if (!isLocalHost(req) || !origins.allows(req)) return sendJson(req, res, 403, { error: "forbidden" });
    if (req.method === "OPTIONS") {
      res.writeHead(204, origins.headersFor(req));
      return res.end();
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    const sessionRoute = url.pathname.match(/^\/sessions\/([\w-]+)\/(stream|messages|interrupt|stop)$/);

    if (req.method === "GET") {
      if (url.pathname === "/health") return sendJson(req, res, 200, { ok: true });
      if (url.pathname === "/sessions") return sendJson(req, res, 200, { sessions: registry.list() });
      const session = sessionRoute?.[2] === "stream" ? registry.get(sessionRoute[1]) : null;
      return session ? streamSession(req, res, session) : sendJson(req, res, 404, {});
    }
    if (req.method !== "POST") return sendJson(req, res, 405, {});
    if (!isJson(req)) return sendJson(req, res, 415, {});
    if (url.pathname === "/sessions") return openSession(req, res);
    const session = sessionRoute && sessionRoute[2] !== "stream" ? registry.get(sessionRoute[1]) : null;
    return session ? actOnSession(req, res, session, sessionRoute[2]) : sendJson(req, res, 404, {});
  });
}
