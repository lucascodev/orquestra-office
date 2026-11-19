import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isShownForWay } from "../scripts/install-way.js";

describe("install way parts", () => {
  it("shows a part only for the way it belongs to", () => {
    assert.equal(isShownForWay("docker", "docker"), true);
    assert.equal(isShownForWay("docker", "npx"), false);
  });

  it("shows a part shared by several ways for each of them", () => {
    assert.equal(isShownForWay("docker npx", "npx"), true);
    assert.equal(isShownForWay("docker npx", "docker"), true);
    assert.equal(isShownForWay("docker npx", "brew"), false);
  });

  it("does not match a way by a piece of its name", () => {
    assert.equal(isShownForWay("docker-compose", "docker"), false);
  });
});
