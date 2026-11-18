import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createEventStream } from "../src/http/event-stream.js";

const PUSH_DELAY_MS = 200;
const MAX_VIEWERS = 20;
const MAX_BUFFERED_BYTES = 1024 * 1024;
const HIGH_WATER_MARK = 16 * 1024;
const ROOM_FOR_A_FRAME = 1024;
const OVERSIZED_PROJECT_NAME = "x".repeat(MAX_BUFFERED_BYTES + 1);

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
    writableNeedDrain: false,
    isDestroyed: false,
    writeHead: (status) => { res.status = status; },
    write: (data) => {
      res.frames.push(data);
      res.writableLength += data.length;
      res.writableNeedDrain = res.writableLength >= HIGH_WATER_MARK;
      return !res.writableNeedDrain;
    },
    readAll: () => {
      res.writableLength = 0;
      res.writableNeedDrain = false;
    },
    end: (data) => { if (data) res.frames.push(data); },
    destroy: () => {
      res.isDestroyed = true;
      req.emit("close");
    },
  };
  return { req, res };
}

function openStream(snapshot = () => ({ projects: {} })) {
  const source = changingSource();
  const stream = createEventStream({ snapshot, sources: [source] });
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

  stalled.res.writableLength = MAX_BUFFERED_BYTES;
  stalled.res.writableNeedDrain = true;
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

  viewer.res.writableLength = MAX_BUFFERED_BYTES - ROOM_FOR_A_FRAME;
  viewer.res.writableNeedDrain = true;
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

test("a single frame over the limit does not drop a viewer that keeps reading, and still drops one that stopped", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { stream, source, connect } = openStream(() => ({ projects: { huge: { name: OVERSIZED_PROJECT_NAME } } }));
  const reading = connect();
  const stalled = connect();
  assert.equal(reading.res.isDestroyed, false);
  assert.equal(stalled.res.isDestroyed, false);

  reading.res.readAll();
  source.change();
  t.mock.timers.tick(PUSH_DELAY_MS);

  assert.equal(reading.res.isDestroyed, false);
  assert.equal(reading.res.frames.length, 2);
  assert.equal(stalled.res.isDestroyed, true);
  assert.equal(stream.viewerCount(), 1);
});
