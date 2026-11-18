import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_OFFICE_URL, installerOfficeUrl, officeUrlFrom, parseOfficeUrl } from "../lib/office-url.mjs";

const REFUSED_ANYWHERE = {
  "not a url": /not a URL/,
  "ftp://127.0.0.1": /http:\/\/ or https:\/\//,
  "file:///etc/passwd": /http:\/\/ or https:\/\//,
  "http://user:secret@127.0.0.1:8420": /user name or password/,
  "http://127.0.0.1:8420/events": /no path, query or fragment/,
  "http://127.0.0.1:8420/?x=1": /no path, query or fragment/,
  "http://127.0.0.1:8420/#top": /no path, query or fragment/,
};
const REMOTE_HTTPS = "https://office.example.com:9443";

test("defaults to the office on this machine", () => {
  assert.equal(DEFAULT_OFFICE_URL, "http://127.0.0.1:8420");
  assert.equal(officeUrlFrom({}), DEFAULT_OFFICE_URL);
});

test("accepts a loopback address and returns its normalized origin", () => {
  assert.deepEqual(parseOfficeUrl("http://127.0.0.1:8420/"), { origin: "http://127.0.0.1:8420" });
  assert.deepEqual(parseOfficeUrl("HTTP://LOCALHOST:1234"), { origin: "http://localhost:1234" });
  assert.deepEqual(parseOfficeUrl("https://[::1]:8420"), { origin: "https://[::1]:8420" });
});

test("refuses what is not a bare http or https origin, even with the remote flag", () => {
  for (const [raw, problem] of Object.entries(REFUSED_ANYWHERE)) {
    assert.match(parseOfficeUrl(raw).problem, problem, raw);
    assert.match(parseOfficeUrl(raw, { allowRemote: true }).problem, problem, raw);
  }
});

test("a remote address needs the explicit flag and https", () => {
  assert.match(parseOfficeUrl("http://evil.example").problem, /--allow-remote-office/);
  assert.match(parseOfficeUrl(REMOTE_HTTPS).problem, /--allow-remote-office/);
  assert.match(parseOfficeUrl("http://192.168.0.10:8420", { allowRemote: true }).problem, /needs https:\/\//);
  assert.deepEqual(parseOfficeUrl(REMOTE_HTTPS, { allowRemote: true }), { origin: REMOTE_HTTPS });
});

test("the installer treats an empty OFFICE_URL as unset and reports a bad one", () => {
  assert.deepEqual(installerOfficeUrl({}), { origin: DEFAULT_OFFICE_URL });
  assert.deepEqual(installerOfficeUrl({ OFFICE_URL: "" }), { origin: DEFAULT_OFFICE_URL });
  assert.deepEqual(installerOfficeUrl({ OFFICE_URL: "  " }), { origin: DEFAULT_OFFICE_URL });
  assert.deepEqual(installerOfficeUrl({ OFFICE_URL: "http://localhost:1234" }), { origin: "http://localhost:1234" });
  assert.match(installerOfficeUrl({ OFFICE_URL: "http://evil.example" }).problem, /--allow-remote-office/);
  assert.deepEqual(installerOfficeUrl({ OFFICE_URL: REMOTE_HTTPS }, { allowRemote: true }), { origin: REMOTE_HTTPS });
});

test("a hook uses OFFICE_URL only when it is a valid loopback origin, and the default otherwise", () => {
  assert.equal(officeUrlFrom({ OFFICE_URL: "http://localhost:1234/" }), "http://localhost:1234");
  for (const raw of ["", "http://evil.example", REMOTE_HTTPS, ...Object.keys(REFUSED_ANYWHERE)]) {
    assert.equal(officeUrlFrom({ OFFICE_URL: raw }), DEFAULT_OFFICE_URL, raw);
  }
});
