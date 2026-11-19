import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const DOCKERFILE = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
const COMPOSE = readFileSync(new URL("../../compose.yaml", import.meta.url), "utf8");

test("the image reads the office secret from the file Compose mounts", () => {
  assert.match(DOCKERFILE, /\bOFFICE_SECRET_FILE=\/run\/secrets\/office_secret\b/);
});

test("Compose mounts the office secret from the user's ~/.orquestra-office, never from an environment value", () => {
  assert.match(COMPOSE, /secrets:\n\s+- office_secret\n/);
  assert.match(COMPOSE, /office_secret:\n\s+file: \$\{OFFICE_SECRET_FILE:-\$\{USERPROFILE:-\$\{HOME\}\}\/\.orquestra-office\/secret\}\n/);
  assert.doesNotMatch(COMPOSE, /environment:[\s\S]*OFFICE_SECRET/);
});
