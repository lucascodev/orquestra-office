const PUSH_DELAY_MS = 200;
const HEARTBEAT_MS = 25_000;

export function createEventStream({ snapshot, sources }) {
  const clients = new Set();
  let timer = null;

  const frame = () => `event: state\ndata: ${JSON.stringify(snapshot())}\n\n`;

  const push = () => {
    timer = null;
    const data = frame();
    clients.forEach((res) => res.write(data));
  };

  const schedule = () => {
    if (!timer) timer = setTimeout(push, PUSH_DELAY_MS);
  };
  sources.forEach((source) => source.onChange(schedule));

  setInterval(() => clients.forEach((res) => res.write(": ping\n\n")), HEARTBEAT_MS).unref();

  function subscribe(req, res) {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
    res.write(frame());
    clients.add(res);
    req.on("close", () => clients.delete(res));
  }

  return { subscribe, viewerCount: () => clients.size };
}
