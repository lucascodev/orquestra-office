import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { curlPostArgs, findCurl, nullDeviceOf } from "../lib/curl.mjs";

const existing = (...paths) => (path) => paths.includes(path);

test("on Windows, curl is the one in System32 under SystemRoot", () => {
  const systemCurl = join("D:\Win", "System32", "curl.exe");

  assert.equal(findCurl({ platform: "win32", systemRoot: "D:\Win", exists: existing(systemCurl) }), systemCurl);
});

test("on macOS and Linux, curl is the first system path that exists", () => {
  assert.equal(findCurl({ platform: "darwin", exists: existing("/usr/bin/curl", "/opt/homebrew/bin/curl") }), "/usr/bin/curl");
  assert.equal(findCurl({ platform: "linux", exists: existing("/bin/curl") }), "/bin/curl");
});

test("without curl there is nothing to install with", () => {
  assert.equal(findCurl({ platform: "win32", systemRoot: "C:\Windows", exists: existing() }), null);
  assert.equal(findCurl({ platform: "darwin", exists: existing() }), null);
});

test("the null device is NUL on Windows and /dev/null elsewhere", () => {
  assert.equal(nullDeviceOf("win32"), "NUL");
  assert.equal(nullDeviceOf("darwin"), "/dev/null");
});

test("curl reads the token from the header file, sends stdin and throws the answer away", () => {
  const args = curlPostArgs({ url: "http://127.0.0.1:8420/events/claude", nullDevice: "NUL", activityHeaderFile: "C:\h\activity.header" });

  assert.deepEqual(args, [
    "-s", "--noproxy", "*", "-m", "3", "-o", "NUL", "-H", "@C:\h\activity.header", "-H", "Content-Type: application/json", "--data-binary", "@-",
    "http://127.0.0.1:8420/events/claude",
  ]);
  assert.ok(!args.some((arg) => /Bearer/.test(arg)));
});
