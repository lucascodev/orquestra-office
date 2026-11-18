import assert from "node:assert/strict";
import { test } from "node:test";
import { statusLineText } from "../lib/status-line-text.mjs";

test("shows model, rounded 5 h and weekly usage and cost with two decimals", () => {
  const status = {
    model: { display_name: "Opus" },
    rate_limits: { five_hour: { used_percentage: 12.5 }, seven_day: { used_percentage: 40.4 } },
    cost: { total_cost_usd: 1.235 },
  };

  assert.equal(statusLineText(status), "Opus · 5 h 13% · semana 40% · US$ 1.24");
});

test("leaves out what the session does not have yet", () => {
  assert.equal(statusLineText({ model: { display_name: "Sonnet" } }), "Sonnet");
  assert.equal(statusLineText({ rate_limits: { seven_day: { used_percentage: 7 } } }), "semana 7%");
  assert.equal(statusLineText({}), "");
});

test("zero usage and zero cost still show", () => {
  const status = { rate_limits: { five_hour: { used_percentage: 0 } }, cost: { total_cost_usd: 0 } };

  assert.equal(statusLineText(status), "5 h 0% · US$ 0.00");
});

test("ignores numbers that are not finite or not numbers", () => {
  const status = { rate_limits: { five_hour: { used_percentage: "50" }, seven_day: { used_percentage: null } }, cost: { total_cost_usd: Number.NaN } };

  assert.equal(statusLineText(status), "");
});
