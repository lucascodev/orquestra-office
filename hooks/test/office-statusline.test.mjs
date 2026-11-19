import assert from "node:assert/strict";
import { test } from "node:test";
import { fakeHome } from "./support/fake-home.mjs";
import { startFakeOffice } from "./support/fake-office.mjs";
import { requestedUrls, runHookScript, runRecordingFetch } from "./support/run-hook-script.mjs";

const SCRIPT = "office-statusline.mjs";
const UNREACHABLE_OFFICE = "http://127.0.0.1:1";
const DEFAULT_REPORT = "http://127.0.0.1:8420/events/statusline";
const THROWAWAY_AUTHORIZATION = "Bearer dI1HY_vzPeHro_qQK3S9fh-cVNpGcLIH77tBN1IPe7I";
const FULL_STATUS = JSON.stringify({
  model: { display_name: "Opus" },
  rate_limits: { five_hour: { used_percentage: 12.6 }, seven_day: { used_percentage: 40 } },
  cost: { total_cost_usd: 1.234 },
});
const FULL_STATUS_LINE = "Opus · 5 h 13% · semana 40% · US$ 1.23\n";

const at = (officeUrl) => ["--office-url", officeUrl];

test("forwards the raw status JSON to the office with the activity token and prints the line", async (t) => {
  const office = await startFakeOffice(t);

  const result = await runHookScript(SCRIPT, { args: at(office.url), input: FULL_STATUS });

  assert.equal(result.code, 0);
  assert.equal(result.stdout, "Opus · 5 h 13% · semana 40% · US$ 1.23\n");
  assert.deepEqual(office.requests, [{ method: "POST", url: "/events/statusline", contentType: "application/json", authorization: THROWAWAY_AUTHORIZATION, body: FULL_STATUS }]);
});

test("still prints the line when the office is down", async () => {
  const result = await runHookScript(SCRIPT, { args: at(UNREACHABLE_OFFICE), input: FULL_STATUS });

  assert.equal(result.code, 0);
  assert.equal(result.stdout, "Opus · 5 h 13% · semana 40% · US$ 1.23\n");
});

test("prints an empty line for input that is not JSON", async () => {
  const result = await runHookScript(SCRIPT, { args: at(UNREACHABLE_OFFICE), input: "not json" });

  assert.equal(result.code, 0);
  assert.equal(result.stdout, "\n");
});

const REFUSED_OFFICE_URLS = ["", "   ", "http://evil.example", "http://user:pw@127.0.0.1:8420", "http://127.0.0.1:8420/x", "not a url", "https://a$(id).example"];

test("without --office-url reports to the default office", async (t) => {
  const urls = await requestedUrls(t, SCRIPT, { input: FULL_STATUS });

  assert.deepEqual(urls, [DEFAULT_REPORT]);
});

test("OFFICE_URL in the environment, which a project's settings can set, is never followed", async (t) => {
  const urls = await requestedUrls(t, SCRIPT, { env: { OFFICE_URL: "http://localhost:1234" }, input: FULL_STATUS });

  assert.deepEqual(urls, [DEFAULT_REPORT]);
});

for (const officeUrl of REFUSED_OFFICE_URLS) {
  test(`a refused --office-url "${officeUrl}" skips the report but still prints the line, exit 0`, async (t) => {
    const result = await runRecordingFetch(t, SCRIPT, { args: at(officeUrl), input: FULL_STATUS });

    assert.deepEqual(result.urls, []);
    assert.equal(result.stdout, FULL_STATUS_LINE);
    assert.equal(result.stderr, "");
    assert.equal(result.code, 0);
  });
}

test("reports to the --office-url the installer wrote, normalized to its origin", async (t) => {
  const urls = await requestedUrls(t, SCRIPT, { args: at("http://localhost:1234/"), input: FULL_STATUS });

  assert.deepEqual(urls, ["http://localhost:1234/events/statusline"]);
});

test("without the office secret it reports nothing and still prints the line", async (t) => {
  const office = await startFakeOffice(t);
  const { env } = fakeHome(t);

  const result = await runHookScript(SCRIPT, { env, args: at(office.url), input: FULL_STATUS });

  assert.equal(result.code, 0);
  assert.equal(result.stdout, "Opus · 5 h 13% · semana 40% · US$ 1.23\n");
  assert.deepEqual(office.requests, []);
});
