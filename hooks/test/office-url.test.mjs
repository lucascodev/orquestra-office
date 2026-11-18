import assert from "node:assert/strict";
import { test } from "node:test";
import { officeUrlFrom } from "../lib/office-url.mjs";

test("defaults to the office on this machine", () => {
  assert.equal(officeUrlFrom({}), "http://127.0.0.1:8420");
});

test("OFFICE_URL overrides the default", () => {
  assert.equal(officeUrlFrom({ OFFICE_URL: "http://office.test:1234" }), "http://office.test:1234");
});
