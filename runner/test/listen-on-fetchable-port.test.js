import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { FETCH_BLOCKED_PORTS } from "./support/fetch-blocked-ports.js";
import { listenOnFetchablePort } from "./support/listen-on-fetchable-port.js";

const BLOCKED_PORT = 6000;
const OTHER_BLOCKED_PORT = 10080;
const FREE_PORT = 40_000;

function serverThatGetsPorts(ports) {
  const server = new EventEmitter();
  const remaining = [...ports];
  let port = null;
  server.closeCount = 0;
  server.listen = (requestedPort, host, onListening) => {
    port = remaining.shift();
    queueMicrotask(onListening);
  };
  server.close = (onClosed) => {
    server.closeCount += 1;
    queueMicrotask(onClosed);
  };
  server.address = () => ({ port });
  return server;
}

test("a port that fetch refuses is given back until the server gets one fetch accepts", async () => {
  const server = serverThatGetsPorts([BLOCKED_PORT, OTHER_BLOCKED_PORT, FREE_PORT]);
  assert.equal(await listenOnFetchablePort(server), `http://127.0.0.1:${FREE_PORT}`);
  assert.equal(server.closeCount, 2);
});

const isBadPortError = (error) => /bad port/.test(String(error.cause?.message ?? error.cause));

test("fetch really refuses every port the helper gives back", async () => {
  await Promise.all([...FETCH_BLOCKED_PORTS].map((port) => assert.rejects(fetch(`http://127.0.0.1:${port}/`), isBadPortError, `port ${port}`)));
});
