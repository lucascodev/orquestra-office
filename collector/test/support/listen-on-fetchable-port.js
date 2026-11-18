import { FETCH_BLOCKED_PORTS } from "./fetch-blocked-ports.js";

const LOOPBACK = "127.0.0.1";
const ANY_FREE_PORT = 0;

const listenOnAnyPort = (server) => new Promise((resolve) => server.listen(ANY_FREE_PORT, LOOPBACK, resolve));
const closeServer = (server) => new Promise((resolve) => server.close(resolve));

// On Windows, listen(0) sometimes lands on a port fetch refuses, which made a test fail now and then with "bad port".
export async function listenOnFetchablePort(server) {
  await listenOnAnyPort(server);
  while (FETCH_BLOCKED_PORTS.has(server.address().port)) {
    await closeServer(server);
    await listenOnAnyPort(server);
  }
  return `http://${LOOPBACK}:${server.address().port}`;
}
