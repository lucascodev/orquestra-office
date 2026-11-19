import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCollectorClock, newestCollectorStamp } from "../scripts/domain/office/collector-clock.js";
import { agentWorkSignalOf } from "../scripts/domain/work-signals/agent-work-signal.js";
import { agentWith, NOW, SECOND, testsWith } from "./support/work-fixtures.js";

const AHEAD_MS = 30 * SECOND;

const stateWith = (agents, pending = []) => ({ projects: { office: { name: "office", agents: Object.fromEntries(agents.map((agent) => [agent.key, agent])) } }, pending });

// The collector stamps running.startedAt with its own clock, in a container whose clock may run ahead of the browser's.
describe("clock of the collector, as the page reads it", () => {
  it("lets the clock of a running test walk every second even when the collector's clock runs ahead of the page", () => {
    const clock = createCollectorClock();
    const receivedAt = NOW;
    const startedAt = receivedAt + AHEAD_MS;
    const runner = agentWith({ updatedAt: startedAt, tests: testsWith({ running: { command: "npm test", framework: null, startedAt } }) });
    clock.observe(stateWith([runner]), receivedAt);
    const shown = [5, 6, 7].map((seconds) => agentWorkSignalOf(runner, clock.now(receivedAt + seconds * SECOND)).text);
    assert.deepEqual(shown, ["testando 0:05", "testando 0:06", "testando 0:07"]);
  });

  it("keeps what it learned when a later update brings only older stamps, so the clock never jumps back to 0:00", () => {
    const clock = createCollectorClock();
    clock.observe(stateWith([agentWith({ updatedAt: NOW + AHEAD_MS })]), NOW);
    clock.observe(stateWith([agentWith({ updatedAt: NOW - SECOND })]), NOW + 2 * SECOND);
    assert.equal(clock.now(NOW + 3 * SECOND), NOW + 3 * SECOND + AHEAD_MS);
  });

  it("is the page's own clock when the collector is not ahead, as in the demonstration", () => {
    const clock = createCollectorClock();
    clock.observe(stateWith([agentWith({ updatedAt: NOW - SECOND })]), NOW);
    assert.equal(clock.now(NOW + SECOND), NOW + SECOND);
    assert.equal(createCollectorClock().now(NOW), NOW);
  });

  it("takes the collector's word when it says what time it was, ahead or behind", () => {
    const clock = createCollectorClock();
    clock.observe({ ...stateWith([agentWith({ updatedAt: NOW + AHEAD_MS })]), generatedAt: NOW - 40 * SECOND }, NOW);
    assert.equal(clock.now(NOW + 5 * SECOND), NOW - 35 * SECOND);
  });

  it("reads the newest stamp from the agents' work and the requests, leaving deadlines and damaged fields out", () => {
    const agents = [
      agentWith({ key: "claude:a", updatedAt: NOW, tests: testsWith({ lastRun: { isOk: true, finishedAt: NOW + 3 * SECOND } }) }),
      agentWith({ key: "claude:b", updatedAt: "amanhã", tests: "x", plan: { state: "approved", decidedAt: NOW + 2 * SECOND } }),
    ];
    assert.equal(newestCollectorStamp(stateWith(agents, [{ id: "r", createdAt: NOW + SECOND, expiresAt: NOW + 120 * SECOND }])), NOW + 3 * SECOND);
    for (const state of [null, {}, { projects: "x" }, { projects: { a: null } }]) assert.equal(newestCollectorStamp(state), null);
  });
});
