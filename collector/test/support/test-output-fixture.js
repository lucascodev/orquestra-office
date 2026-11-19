import { readFileSync } from "node:fs";

const FIXTURES_DIR = new URL("../fixtures/test-output/", import.meta.url);

export function readTestOutputFixture(path) {
  return readFileSync(new URL(path, FIXTURES_DIR), "utf8");
}
