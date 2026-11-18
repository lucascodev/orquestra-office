import { fileURLToPath } from "node:url";
import { createOffice } from "./composition.js";

const DEFAULT_PORT = 8420;
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_HOLD_SECONDS = 120;
const MS_PER_SECOND = 1_000;
const DEFAULT_WEB_DIR = fileURLToPath(new URL("../../web", import.meta.url));
const DEFAULT_DATA_DIR = fileURLToPath(new URL("../data", import.meta.url));

const port = Number(process.env.PORT ?? DEFAULT_PORT);
const host = process.env.OFFICE_HOST || DEFAULT_HOST;
const holdSeconds = Number(process.env.OFFICE_HOLD_SECONDS) || DEFAULT_HOLD_SECONDS;
const allowedHosts = (process.env.OFFICE_ALLOWED_HOSTS ?? "").split(",").map((name) => name.trim()).filter(Boolean);

const office = createOffice({
  webDir: process.env.WEB_DIR ?? DEFAULT_WEB_DIR,
  dataDir: process.env.DATA_DIR || DEFAULT_DATA_DIR,
  holdMs: holdSeconds * MS_PER_SECOND,
  allowedHosts,
});

office.server.listen(port, host, () => {
  console.log(`office collector listening on ${host}:${port}`);
});
office.startSweep();

function shutdown() {
  office.stop();
  office.server.close(() => process.exit(0));
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
