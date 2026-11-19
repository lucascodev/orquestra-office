import assert from "node:assert/strict";
import { test } from "node:test";
import { applyNotify, configLines, configText, officeNotifyEntries, officeNotifyLine } from "../lib/codex-config.mjs";

const OFFICE_URL = "http://127.0.0.1:8420";
const MACHINE = { curlPath: "/usr/bin/curl", nullDevice: "/dev/null", activityHeaderFile: "/home/me/.orquestra-office/activity.header" };
const INSTALL = { isRemoving: false, officeUrl: OFFICE_URL, ...MACHINE };
const REMOVE = { ...INSTALL, isRemoving: true };
const OFFICE_NOTIFY = officeNotifyLine(INSTALL);
const NOTIFY_BEFORE_TOKEN = 'notify = ["curl", "-s", "--noproxy", "*", "-m", "3", "-X", "POST", "-H", "Content-Type: application/json", "http://127.0.0.1:8420/events/codex", "--data-raw"]';
const NOTIFY_BEFORE_NOPROXY = 'notify = ["curl", "-s", "-m", "3", "-X", "POST", "-H", "Content-Type: application/json", "http://127.0.0.1:8420/events/codex", "--data-raw"]';

test("the notify posts the Codex turn with the system curl, past any proxy, with the token from the header file and the answer thrown away", () => {
  assert.equal(OFFICE_NOTIFY, 'notify = ["/usr/bin/curl", "-s", "--noproxy", "*", "-m", "3", "-o", "/dev/null", "-H", "@/home/me/.orquestra-office/activity.header", "-X", "POST", "-H", "Content-Type: application/json", "http://127.0.0.1:8420/events/codex", "--data-raw"]');
});

test("the notify from before the token is replaced by the one with the token", () => {
  assert.deepEqual(applyNotify([NOTIFY_BEFORE_TOKEN, "model = 1"], INSTALL), { lines: [OFFICE_NOTIFY, "model = 1"] });
  assert.deepEqual(applyNotify([NOTIFY_BEFORE_TOKEN], { ...INSTALL, recorded: { notify: [] } }), { lines: [OFFICE_NOTIFY] });
});

test("without the manifest, a token-era notify from another curl or folder is still the office one", () => {
  const elsewhere = officeNotifyLine({ ...INSTALL, curlPath: "C:/Windows/System32/curl.exe", activityHeaderFile: "C:/Users/ana/.orquestra-office/activity.header" });

  assert.deepEqual(applyNotify([elsewhere], INSTALL), { lines: [OFFICE_NOTIFY] });
  assert.ok(applyNotify([elsewhere], { ...INSTALL, recorded: { notify: [] } }).foreignNotifyLine);
});

test("refuses a notify at the root that belongs to someone else, on install and on remove", () => {
  const lines = ['model = "o3"', '  notify = ["notify-send"]', "[profiles.a]"];

  assert.deepEqual(applyNotify(lines, INSTALL), { foreignNotifyLine: '  notify = ["notify-send"]' });
  assert.deepEqual(applyNotify(lines, REMOVE), { foreignNotifyLine: '  notify = ["notify-send"]' });
});

test("a notify that only mentions the office route belongs to someone else", () => {
  for (const line of [
    'notify = ["sh", "-c", "curl -d @- http://127.0.0.1:8420/events/codex; my-script"]',
    'notify = ["curl", "https://audit.example.com/events/codex"]',
    `${OFFICE_NOTIFY} # mine now`,
  ]) {
    assert.deepEqual(applyNotify([line], INSTALL), { foreignNotifyLine: line }, line);
    assert.deepEqual(applyNotify([line], REMOVE), { foreignNotifyLine: line }, line);
  }
});

test("a quoted notify key is someone else's notify, even with the office command", () => {
  for (const key of ['"notify"', "'notify'"]) {
    const line = OFFICE_NOTIFY.replace(/^notify/, key);

    assert.deepEqual(applyNotify(['model = "o3"', line], INSTALL), { foreignNotifyLine: line });
    assert.deepEqual(applyNotify([line], REMOVE), { foreignNotifyLine: line });
  }
});

test("inserts at the root, before the first table, and ignores a notify inside a table", () => {
  const lines = ['model = "o3"', "", "[profiles.a]", 'notify = ["x"]'];

  assert.deepEqual(applyNotify(lines, INSTALL), { lines: [OFFICE_NOTIFY, ...lines] });
});

test("installing again replaces its own notify, written before or after --noproxy, and with other spacing", () => {
  const spaced = OFFICE_NOTIFY.replace(/, /g, ",").replace("= ", "=  ");

  for (const line of [OFFICE_NOTIFY, NOTIFY_BEFORE_NOPROXY, spaced]) {
    assert.deepEqual(applyNotify([line, 'model = "o3"'], INSTALL), { lines: [OFFICE_NOTIFY, 'model = "o3"'] }, line);
  }
});

test("a notify recorded in the manifest is replaced even when it points at another office", () => {
  const oldInstall = { ...INSTALL, officeUrl: "http://localhost:9999" };
  const { lines: once } = applyNotify(['model = "o3"'], oldInstall);

  assert.ok(applyNotify(once, { ...INSTALL, recorded: { notify: [] } }).foreignNotifyLine);
  assert.deepEqual(applyNotify(once, { ...INSTALL, recorded: officeNotifyEntries(oldInstall) }), { lines: [OFFICE_NOTIFY, 'model = "o3"'] });
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
