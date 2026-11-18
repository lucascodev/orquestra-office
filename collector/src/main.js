import { createPendingDecisions } from "./control/domain/pending-decisions.js";
import { createServer } from "./http/server.js";
import { createOfficeStore } from "./office/domain/office-store.js";
import { createOfficeStateFile } from "./office/infra/office-state-file.js";

const DEFAULT_HOLD_SECONDS = 120;

const port = Number(process.env.PORT ?? 8420);
const dataDir = process.env.DATA_DIR ?? "./data";
const webDir = process.env.WEB_DIR ?? "../web";
const holdSeconds = Number(process.env.OFFICE_HOLD_SECONDS) || DEFAULT_HOLD_SECONDS;
const allowedHosts = (process.env.OFFICE_ALLOWED_HOSTS ?? "").split(",").map((host) => host.trim()).filter(Boolean);

const persistence = createOfficeStateFile(dataDir);
const store = createOfficeStore(persistence.load());
store.onChange(() => persistence.scheduleSave(store.snapshot()));

const decisions = createPendingDecisions({ holdMs: holdSeconds * 1000 });
const server = createServer({ store, webDir, decisions, allowedHosts });
server.listen(port, "0.0.0.0", () => {
  console.log(`office collector listening on ${port}`);
});

const sweep = setInterval(() => store.sweep(Date.now()), 30_000);

function shutdown() {
  clearInterval(sweep);
  persistence.saveNow(store.snapshot());
  server.close(() => process.exit(0));
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
