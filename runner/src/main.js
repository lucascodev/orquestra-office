import { createServer } from "./http/server.js";
import { createClaudeLauncher } from "./sessions/claude-process.js";
import { createSessionRegistry } from "./sessions/session-registry.js";

const DEFAULT_PORT = 8421;
const DEFAULT_ORIGINS = "http://localhost:8420,http://127.0.0.1:8420";

const port = Number(process.env.OFFICE_RUNNER_PORT) || DEFAULT_PORT;
const allowedOrigins = (process.env.OFFICE_ORIGINS ?? DEFAULT_ORIGINS).split(",").map((origin) => origin.trim()).filter(Boolean);
const startProcess = createClaudeLauncher({ command: process.env.CLAUDE_BIN || "claude", model: process.env.OFFICE_RUNNER_MODEL ?? "" });

const registry = createSessionRegistry({ startProcess });
const server = createServer({ registry, allowedOrigins });

server.listen(port, "127.0.0.1", () => {
  console.log(`office runner listening on http://127.0.0.1:${port}, serving ${allowedOrigins.join(" and ")}`);
});

function shutdown() {
  registry.stopAll();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 6_000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
