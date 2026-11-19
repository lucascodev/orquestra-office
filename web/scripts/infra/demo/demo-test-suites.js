export const HOOKS_COMMAND = "node --test hooks/test/*.test.mjs";
export const PHYSICS_COMMAND = "npx vitest run src/physics";
export const RENDER_COMMAND = "npx vitest run src/render";
export const CHECKOUT_COMMAND = "npx jest src/checkout";
// Longer than the 60 characters the collector keeps, so the demo shows a cut label too.
export const WEB_CHECK_COMMAND = "npm run check -- --reporter=dot --test-concurrency=4 --experimental-test-coverage";

const PHYSICS_TEST = "src/physics/collision.test.ts";
const JUMP_TEST = "src/physics/jump.test.ts";
const NOTIFY_TEST = "hooks/test/install-codex-notify.test.mjs";
const CHAIN_TEST = "hooks/test/codex-chain.test.mjs";

const failure = (name, location, message) => ({ name, location, message });

export const PHYSICS_FAILURES = Object.freeze([
  failure("keeps the player on the platform after landing", `${PHYSICS_TEST}:84`, "expected 'falling' to be 'grounded'"),
  failure("stops a jump at the ceiling", `${JUMP_TEST}:31`, "expected 3.2 to be less than or equal to 3"),
]);
export const HOOKS_FAILURES = Object.freeze([
  failure("keeps someone else's notify running after the office's", `${NOTIFY_TEST}:158`, "Expected values to be strictly equal: 0 !== 1"),
  failure("refuses a notify that cannot be chained", `${NOTIFY_TEST}:190`, "The input did not match the regular expression"),
]);

// What a test runner of the demo goes round with: the files it writes, the command it runs and how each round ends.
export const PHYSICS_SUITE = Object.freeze({
  command: PHYSICS_COMMAND,
  framework: "vitest",
  files: [PHYSICS_TEST, JUMP_TEST],
  passing: { passed: 50, failed: 0, skipped: 2 },
  failing: { passed: 46, failed: 2, skipped: 2 },
  failures: PHYSICS_FAILURES,
});

export const HOOKS_SUITE = Object.freeze({
  command: HOOKS_COMMAND,
  framework: "node-test",
  files: [NOTIFY_TEST, CHAIN_TEST],
  passing: { passed: 250, failed: 0, skipped: 7 },
  failing: { passed: 248, failed: 2, skipped: 7 },
  failures: HOOKS_FAILURES,
});

export const RENDER_FILES = Object.freeze(["src/render/sprite-batch.test.ts", "src/render/camera.test.ts"]);
export const CHECKOUT_FILES = Object.freeze(["src/checkout/shipping.test.ts", "src/checkout/coupon.test.ts"]);
