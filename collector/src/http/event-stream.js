import { sendJson } from "./json-io.js";

const PUSH_DELAY_MS = 200;
const HEARTBEAT_MS = 25_000;
const MAX_VIEWERS = 20;
const MAX_BUFFERED_BYTES = 1024 * 1024;

export function createEventStream({ snapshot, sources }) {
  const clients = new Set();
  let timer = null;

  const frame = () => `event: state\ndata: ${JSON.stringify(snapshot())}\n\n`;

  function drop(res) {
    clients.delete(res);
    res.destroy();
  }

  // A page that stops reading would otherwise keep every unsent frame in memory.
  function send(res, data) {
    res.write(data);
    if (res.writableLength > MAX_BUFFERED_BYTES) drop(res);
  }

  const broadcast = (data) => clients.forEach((res) => send(res, data));

  const push = () => {
    timer = null;
    broadcast(frame());
  };

  const schedule = () => {
    if (!timer) timer = setTimeout(push, PUSH_DELAY_MS);
  };
  sources.forEach((source) => source.onChange(schedule));

  setInterval(() => broadcast(": ping\n\n"), HEARTBEAT_MS).unref();

  function subscribe(req, res) {
    if (clients.size >= MAX_VIEWERS) return sendJson(res, 503, { error: "too many viewers" });
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
    clients.add(res);
    req.on("close", () => clients.delete(res));
    send(res, frame());
  }

  return { subscribe, viewerCount: () => clients.size };
}
