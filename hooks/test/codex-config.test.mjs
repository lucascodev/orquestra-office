import assert from "node:assert/strict";
import { test } from "node:test";
import { applyNotify, configLines, configText, officeNotifyLine } from "../lib/codex-config.mjs";

const OFFICE_URL = "http://127.0.0.1:8420";
const INSTALL = { isRemoving: false, officeUrl: OFFICE_URL };
const REMOVE = { ...INSTALL, isRemoving: true };
const OFFICE_NOTIFY = officeNotifyLine(OFFICE_URL);

test("the notify posts the Codex turn to the office with curl and a short timeout", () => {
  assert.equal(OFFICE_NOTIFY, 'notify = ["curl", "-s", "-m", "3", "-X", "POST", "-H", "Content-Type: application/json", "http://127.0.0.1:8420/events/codex", "--data-raw"]');
});

test("refuses a notify at the root that belongs to someone else, on install and on remove", () => {
  const lines = ['model = "o3"', '  notify = ["notify-send"]', "[profiles.a]"];

  assert.deepEqual(applyNotify(lines, INSTALL), { foreignNotifyLine: '  notify = ["notify-send"]' });
  assert.deepEqual(applyNotify(lines, REMOVE), { foreignNotifyLine: '  notify = ["notify-send"]' });
});

test("inserts at the root, before the first table, and ignores a notify inside a table", () => {
  const lines = ['model = "o3"', "", "[profiles.a]", 'notify = ["x"]'];

  assert.deepEqual(applyNotify(lines, INSTALL), { lines: [OFFICE_NOTIFY, ...lines] });
});

test("installing again replaces its own notify instead of adding a second one", () => {
  const { lines: once } = applyNotify(['model = "o3"'], { ...INSTALL, officeUrl: "http://10.0.0.9:9999" });

  assert.deepEqual(applyNotify(once, INSTALL), { lines: [OFFICE_NOTIFY, 'model = "o3"'] });
});

test("removing takes out its own notify and keeps the rest", () => {
  const lines = ['model = "o3"', OFFICE_NOTIFY, "[profiles.a]", "foo = 1"];

  assert.deepEqual(applyNotify(lines, REMOVE), { lines: ['model = "o3"', "[profiles.a]", "foo = 1"] });
  assert.deepEqual(applyNotify(['model = "o3"'], REMOVE), { lines: ['model = "o3"'] });
});

test("leaves the lines it receives untouched", () => {
  const lines = [OFFICE_NOTIFY, 'model = "o3"'];

  applyNotify(lines, REMOVE);
  applyNotify(lines, INSTALL);

  assert.deepEqual(lines, [OFFICE_NOTIFY, 'model = "o3"']);
});

test("reads CRLF and LF lines and writes LF with a single trailing newline", () => {
  assert.deepEqual(configLines('a = 1\r\nb = 2\n\r\n'), ["a = 1", "b = 2", "", ""]);
  assert.equal(configText(["a = 1", "b = 2", "", ""]), "a = 1\nb = 2\n");
  assert.equal(configText([]), "\n");
});
