import { appendFileSync } from "node:fs";

// Preloaded with --import: every request the hook makes is written to FETCH_LOG and never reaches the network.
globalThis.fetch = async (url) => {
  appendFileSync(process.env.FETCH_LOG, `${url}\n`);
  throw new TypeError("network is off in this test");
};
