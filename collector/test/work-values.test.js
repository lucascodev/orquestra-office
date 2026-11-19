import { test } from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
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
const FAKE_STRIPE_LIVE_KEY = fake("sk", "_live_", "51Habcdefghijklmnop");
const FAKE_STRIPE_TEST_KEY = fake("sk", "_test_", "51Habcdefghijklmnop");
const FAKE_GITHUB_PAT = fake("github", "_pat_", "11ABCDEFG0123456789_abcdef");
const FAKE_GOOGLE_KEY = fake("AI", "za", "SyA-1234567890abcdefghijklmnopqrstu");
const PEM_LABEL = fake("RSA PRIVATE ", "KEY");
const FAKE_PEM = fake("-----BEGIN ", PEM_LABEL, "-----\nMIIEowIBAAKCAQEA\nabcdef\n-----END ", PEM_LABEL, "-----");
const FAKE_CUT_PEM = fake("-----BEGIN ", PEM_LABEL, "-----MIIEowIBAAKCAQEA");

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
  ["a password as a JSON key", '{"password": "hunter2", "user": "x"}', `{"password": "${REDACTED}", "user": "x"}`],
  ["an api key as a JSON key with an escaped quote", '{"api_key":"ab\\"cd"}', `{"api_key":"${REDACTED}"}`],
  ["a token as a JSON key in any case", '{"Token" : "abc"}', `{"Token" : "${REDACTED}"}`],
  ["an environment variable with SECRET in its name", "AWS_SECRET_ACCESS_KEY=abcdEFGH1234 npm test", `AWS_SECRET_ACCESS_KEY=${REDACTED} npm test`],
  ["an environment variable with PASS in its name", "DB_PASS=abc pytest", `DB_PASS=${REDACTED} pytest`],
  ["an environment variable with KEY in its name", "export STRIPE_KEY=abc", `export STRIPE_KEY=${REDACTED}`],
  ["a password flag with its value after a space", "pytest --db-password Sentinel123", `pytest --db-password ${REDACTED}`],
  ["a token flag with its value after a space", "npx playwright test --token abc", `npx playwright test --token ${REDACTED}`],
  ["a single dash apitoken flag", "go test ./... -args -apitoken Sentinel123", `go test ./... -args -apitoken ${REDACTED}`],
  ["a secret flag with an equals sign", "npm test -- --secret=Sentinel123", `npm test -- --secret=${REDACTED}`],
  ["basic credentials", "Authorization: Basic dXNlcjpwYXNz", `Authorization: Basic ${REDACTED}`],
  ["a Stripe live key", `use ${FAKE_STRIPE_LIVE_KEY} now`, `use ${REDACTED} now`],
  ["a Stripe test key", FAKE_STRIPE_TEST_KEY, REDACTED],
  ["a GitHub fine-grained token", `token ${FAKE_GITHUB_PAT}`, `token ${REDACTED}`],
  ["a Google API key", `key=${FAKE_GOOGLE_KEY}`, `key=${REDACTED}`],
  ["a private key block", `before\n${FAKE_PEM}\nafter`, `before\n${REDACTED}\nafter`],
  ["a private key block cut before its end", `key: ${FAKE_CUT_PEM}`, `key: ${REDACTED}`],
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
  "NODE_ENV=test npm test",
  "the --token-file flag reads the token from a file",
  "a basic test",
  '{"user": "x"}',
];

for (const text of harmless) {
  test(`redaction leaves "${text}" alone`, () => {
    assert.equal(redactSecrets(text), text);
  });
}

const REDACTION_INPUT_LENGTH = 100_000;
const REDACTION_BUDGET_MS = 50;
// The best of a few runs measures the patterns, not a garbage collection or another test process taking the CPU.
const REDACTION_ATTEMPTS = 5;
const repeatedTo = (unit) => unit.repeat(Math.ceil(REDACTION_INPUT_LENGTH / unit.length)).slice(0, REDACTION_INPUT_LENGTH);

// Each input almost matches one pattern over and over, so a pattern that backtracks on it would blow the budget.
const ADVERSARIAL_REDACTION_INPUTS = {
  "the start of a JWT": repeatedTo("eyJ"),
  "the start of a JWT after dashes": repeatedTo("eyJ-"),
  "a JWT missing its signature": repeatedTo("eyJa."),
  "a JWT made of dots": repeatedTo("eyJa.b"),
  "credentials in a URL with no @": repeatedTo("//a:"),
  "a token with no value": repeatedTo("token = "),
  "a long upper case name with no equals sign": repeatedTo("A"),
  "a secret name with no equals sign": repeatedTo("PASS_"),
  "a password JSON key that never closes": repeatedTo('"password": "\\'),
  "a password flag with no value": repeatedTo("--password "),
  "the start of a private key block": repeatedTo(fake("-----BEGIN ", "RSA ")),
  "basic with no credentials": repeatedTo("Basic "),
};

function bestRedactionMs(text) {
  let best = Infinity;
  for (let attempt = 0; attempt < REDACTION_ATTEMPTS; attempt += 1) {
    const start = performance.now();
    redactSecrets(text);
    best = Math.min(best, performance.now() - start);
  }
  return best;
}

for (const [shape, text] of Object.entries(ADVERSARIAL_REDACTION_INPUTS)) {
  test(`redaction reads 100 KB of ${shape} in under ${REDACTION_BUDGET_MS} ms`, () => {
    const ms = bestRedactionMs(text);
    assert.ok(ms < REDACTION_BUDGET_MS, `${ms.toFixed(1)} ms`);
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
  assert.equal(frameworkOf("node-test"), "node-test");
  assert.equal(frameworkOf("mixed"), "mixed");
  assert.equal(frameworkOf("<script>"), null);
  assert.equal(frameworkOf(undefined), null);
});
