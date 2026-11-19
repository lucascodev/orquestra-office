import { homedir } from "node:os";
import { join } from "node:path";
import { createRunner } from "./composition.js";

const HOST = "127.0.0.1";
const DEFAULT_PORT = 8421;
const DEFAULT_ORIGINS = "http://localhost:8420,http://127.0.0.1:8420";
const DEFAULT_CLAUDE_COMMAND = "claude";
const SHUTDOWN_GRACE_MS = 6_000;
const DEFAULT_SECRET_FILE = join(homedir(), ".orquestra-office", "secret");

const port = Number(process.env.OFFICE_RUNNER_PORT) || DEFAULT_PORT;
const allowedOrigins = (process.env.OFFICE_ORIGINS ?? DEFAULT_ORIGINS).split(",").map((origin) => origin.trim()).filter(Boolean);

const runner = createRunner({
  allowedOrigins,
  claude: { command: process.env.CLAUDE_BIN || DEFAULT_CLAUDE_COMMAND, model: process.env.OFFICE_RUNNER_MODEL ?? "" },
  secretFile: process.env.OFFICE_SECRET_FILE || DEFAULT_SECRET_FILE,
});

runner.server.listen(port, HOST, () => {
  console.log(`office runner listening on http://${HOST}:${port}, serving ${allowedOrigins.join(" and ")}`);
});

function shutdown() {
  runner.stop();
  runner.server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
