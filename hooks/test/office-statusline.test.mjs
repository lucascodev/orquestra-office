import assert from "node:assert/strict";
import { test } from "node:test";
import { startFakeOffice } from "./support/fake-office.mjs";
import { runHookScript } from "./support/run-hook-script.mjs";

const SCRIPT = "office-statusline.mjs";
const UNREACHABLE_OFFICE = "http://127.0.0.1:1";
const FULL_STATUS = JSON.stringify({
  model: { display_name: "Opus" },
  rate_limits: { five_hour: { used_percentage: 12.6 }, seven_day: { used_percentage: 40 } },
  cost: { total_cost_usd: 1.234 },
});

test("forwards the raw status JSON to the office and prints the line", async (t) => {
  const office = await startFakeOffice(t);

  const result = await runHookScript(SCRIPT, { env: { OFFICE_URL: office.url }, input: FULL_STATUS });

  assert.equal(result.code, 0);
  assert.equal(result.stdout, "Opus · 5 h 13% · semana 40% · US$ 1.23\n");
  assert.deepEqual(office.requests, [{ method: "POST", url: "/events/statusline", contentType: "application/json", body: FULL_STATUS }]);
});

test("still prints the line when the office is down", async () => {
  const result = await runHookScript(SCRIPT, { env: { OFFICE_URL: UNREACHABLE_OFFICE }, input: FULL_STATUS });

  assert.equal(result.code, 0);
  assert.equal(result.stdout, "Opus · 5 h 13% · semana 40% · US$ 1.23\n");
});

test("prints an empty line for input that is not JSON", async () => {
  const result = await runHookScript(SCRIPT, { env: { OFFICE_URL: UNREACHABLE_OFFICE }, input: "not json" });

  assert.equal(result.code, 0);
  assert.equal(result.stdout, "\n");
});
