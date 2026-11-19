import { test } from "node:test";
import assert from "node:assert/strict";
import { countOf } from "../src/work/domain/values/count.js";
import { frameworkOf } from "../src/work/domain/values/frameworks.js";
import { redactSecrets } from "../src/work/domain/values/redact-secrets.js";
import { lineOf, textBlockOf } from "../src/work/domain/values/safe-text.js";
import { workIdOf } from "../src/work/domain/values/work-id.js";

const REDACTED = "[redacted]";
// Fake credentials are assembled from parts so secret scanners do not mistake the fixtures for real ones.
const fake = (...parts) => parts.join("");
const FAKE_AWS_KEY = fake("AK", "IA", "ABCDEFGHIJKLMNOP");
const FAKE_GITHUB_TOKEN = fake("gh", "p_", "abcdefghijklmnopqrstuvwxyz0123");
const FAKE_GITHUB_SERVER_TOKEN = fake("gh", "s_", "abcdefghijklmnopqrstuvwxyz0123");
const FAKE_OPENAI_KEY = fake("sk", "-proj-", "abcdefghijklmnop1234");
const FAKE_SLACK_TOKEN = fake("xo", "xb-", "123-456-abc");
const FAKE_JWT = fake("ey", "JhbGciOiJIUzI1NiJ9", ".", "eyJzdWIiOiIxIn0", ".", "c2lnbmF0dXJl");

const secrets = [
  ["a bearer token", "curl -H 'Authorization: Bearer abc.def-123'", `curl -H 'Authorization: Bearer ${REDACTED}`],
  ["a JWT", `jwt ${FAKE_JWT} here`, `jwt ${REDACTED} here`],
  ["an OpenAI style key", `use ${FAKE_OPENAI_KEY} now`, `use ${REDACTED} now`],
  ["a GitHub token", FAKE_GITHUB_TOKEN, REDACTED],
  ["a GitHub server token", FAKE_GITHUB_SERVER_TOKEN, REDACTED],
  ["an AWS access key", FAKE_AWS_KEY, REDACTED],
  ["a Slack token", FAKE_SLACK_TOKEN, REDACTED],
  ["credentials in a URL", "git clone https://lucas:hunter2@github.com/x.git", `git clone https://${REDACTED}@github.com/x.git`],
  ["a password assignment", "PASSWORD=hunter2 npm test", `PASSWORD=${REDACTED} npm test`],
  ["an API key flag", "pytest --api-key=abc123", `pytest --api-key=${REDACTED}`],
  ["an api_key with a colon and spaces", "api_key:  abc123", `api_key:  ${REDACTED}`],
  ["a token inside a longer variable", "API_TOKEN=abc npm test", `API_TOKEN=${REDACTED} npm test`],
  ["a secret in any case", "Secret: xyz", `Secret: ${REDACTED}`],
  ["a passwd", "passwd=abc", `passwd=${REDACTED}`],
];

for (const [what, text, expected] of secrets) {
  test(`redaction masks ${what}`, () => {
    assert.equal(redactSecrets(text), expected);
  });
}

const harmless = [
  "npm test -- --runInBand",
  "the token count went up",
  "expected 3 to be 4",
  "sk-short",
  "https://github.com/x.git",
];

for (const text of harmless) {
  test(`redaction leaves "${text}" alone`, () => {
    assert.equal(redactSecrets(text), text);
  });
}

test("redaction of text that is not a string gives an empty string", () => {
  assert.equal(redactSecrets(undefined), "");
});

test("a line loses control and bidi characters and turns line breaks into spaces", () => {
  assert.equal(lineOf("a\u0000b\u009Fc‮d⁦e\nf\tg", 50), "abcde f g");
});

test("a line is cut by code point, never in the middle of an emoji", () => {
  assert.equal(lineOf("ab😀😀", 3), "ab😀");
});

test("a line that is not a string is empty", () => {
  assert.equal(lineOf(42, 10), "");
});

test("a text block keeps line breaks and tabs but loses other control and bidi characters", () => {
  assert.equal(textBlockOf("# Plan\r\n\t- step\u0007‮ one", 100), "# Plan\n\t- step one");
});

test("a text block is cut by code point", () => {
  assert.equal(textBlockOf("😀😀😀", 2), "😀😀");
});

const counts = [
  [0, 0],
  [250, 250],
  [-1, null],
  [1.5, null],
  [Number.MAX_SAFE_INTEGER, null],
  ["5", null],
  [null, null],
  [undefined, null],
];

for (const [value, expected] of counts) {
  test(`the count of ${String(value)} is ${expected}`, () => {
    assert.equal(countOf(value), expected);
  });
}

const ids = [
  ["a numeric string", "12", "12"],
  ["a number", 7, "7"],
  ["a word with dashes", "task-a_1", "task-a_1"],
  ["__proto__, which stays a plain string id", "__proto__", "__proto__"],
  ["a path", "../x", null],
  ["a long id", "x".repeat(41), null],
  ["an empty id", "", null],
  ["a fraction", 1.5, null],
  ["nothing", undefined, null],
];

for (const [what, value, expected] of ids) {
  test(`the work id of ${what} is ${expected}`, () => {
    assert.equal(workIdOf(value), expected);
  });
}

test("a known framework is kept and an unknown one becomes null", () => {
  assert.equal(frameworkOf("vitest"), "vitest");
  assert.equal(frameworkOf("node:test"), "node:test");
  assert.equal(frameworkOf("<script>"), null);
  assert.equal(frameworkOf(undefined), null);
});
