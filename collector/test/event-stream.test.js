import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createEventStream } from "../src/http/event-stream.js";

const PUSH_DELAY_MS = 200;
const MAX_VIEWERS = 20;
const MAX_BUFFERED_BYTES = 1024 * 1024;

function changingSource() {
  const listeners = new Set();
  return { onChange: (listener) => listeners.add(listener), change: () => listeners.forEach((listener) => listener()) };
}

function fakeViewer() {
  const req = new EventEmitter();
  const res = {
    status: null,
    frames: [],
    writableLength: 0,
    isDestroyed: false,
    writeHead: (status) => { res.status = status; },
    write: (data) => { res.frames.push(data); return true; },
    end: (data) => { if (data) res.frames.push(data); },
    destroy: () => {
      res.isDestroyed = true;
      req.emit("close");
    },
  };
  return { req, res };
}

function openStream() {
  const source = changingSource();
  const stream = createEventStream({ snapshot: () => ({ projects: {} }), sources: [source] });
  const connect = () => {
    const viewer = fakeViewer();
    stream.subscribe(viewer.req, viewer.res);
    return viewer;
  };
  return { stream, source, connect };
}

test("a viewer that stops reading is dropped once its unsent data passes the limit, and the others keep receiving", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { stream, source, connect } = openStream();
  const stalled = connect();
  const reading = connect();

  stalled.res.writableLength = MAX_BUFFERED_BYTES + 1;
  source.change();
  t.mock.timers.tick(PUSH_DELAY_MS);

  assert.equal(stalled.res.isDestroyed, true);
  assert.equal(reading.res.isDestroyed, false);
  assert.equal(reading.res.frames.length, 2);
  assert.equal(stream.viewerCount(), 1);
});

test("a viewer still within the limit stays connected", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { stream, source, connect } = openStream();
  const viewer = connect();

  viewer.res.writableLength = MAX_BUFFERED_BYTES;
  source.change();
  t.mock.timers.tick(PUSH_DELAY_MS);

  assert.equal(viewer.res.isDestroyed, false);
  assert.equal(stream.viewerCount(), 1);
});

test("above the viewer ceiling the stream answers 503 and the extra page is not counted as a viewer", () => {
  const { stream, connect } = openStream();
  const viewers = Array.from({ length: MAX_VIEWERS }, connect);
  assert.ok(viewers.every((viewer) => viewer.res.status === 200));

  const extra = connect();
  assert.equal(extra.res.status, 503);
  assert.equal(stream.viewerCount(), MAX_VIEWERS);

  viewers[0].req.emit("close");
  assert.equal(connect().res.status, 200);
  assert.equal(stream.viewerCount(), MAX_VIEWERS);
});
