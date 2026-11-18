import { test } from "node:test";
import assert from "node:assert/strict";
import { createSessionHistory } from "../src/office/session-history.js";

const ENTRY_LIMIT = 200;
const AGENT_LIMIT = 300;

const entry = (index) => ({ at: index, kind: "tool", text: `step ${index}`, detail: "" });
const agentKey = (index) => `claude:s${index}`;

function addEntries(history, key, count) {
  for (let index = 0; index < count; index += 1) history.add(key, entry(index));
}

test("an agent with no history has no entries", () => {
  assert.deepEqual(createSessionHistory().of(agentKey(0)), []);
});

test("entries come back in the order they were added", () => {
  const history = createSessionHistory();
  addEntries(history, agentKey(0), 3);
  assert.deepEqual(history.of(agentKey(0)), [entry(0), entry(1), entry(2)]);
});

test("each agent keeps only its latest 200 entries", () => {
  const history = createSessionHistory();
  addEntries(history, agentKey(0), ENTRY_LIMIT + 1);
  const entries = history.of(agentKey(0));
  assert.equal(entries.length, ENTRY_LIMIT);
  assert.deepEqual(entries[0], entry(1));
  assert.deepEqual(entries.at(-1), entry(ENTRY_LIMIT));
});

test("the entry limit is per agent, not shared", () => {
  const history = createSessionHistory();
  addEntries(history, agentKey(0), ENTRY_LIMIT);
  addEntries(history, agentKey(1), 1);
  assert.equal(history.of(agentKey(0)).length, ENTRY_LIMIT);
  assert.deepEqual(history.of(agentKey(1)), [entry(0)]);
});

test("past 300 agents the one written to longest ago is forgotten", () => {
  const history = createSessionHistory();
  for (let index = 0; index <= AGENT_LIMIT; index += 1) history.add(agentKey(index), entry(index));
  assert.deepEqual(history.of(agentKey(0)), []);
  assert.deepEqual(history.of(agentKey(1)), [entry(1)]);
  assert.deepEqual(history.of(agentKey(AGENT_LIMIT)), [entry(AGENT_LIMIT)]);
});

test("writing to an agent again keeps it from being forgotten", () => {
  const history = createSessionHistory();
  for (let index = 0; index < AGENT_LIMIT; index += 1) history.add(agentKey(index), entry(index));
  history.add(agentKey(0), entry(AGENT_LIMIT));
  history.add(agentKey(AGENT_LIMIT), entry(AGENT_LIMIT));
  assert.deepEqual(history.of(agentKey(0)), [entry(0), entry(AGENT_LIMIT)]);
  assert.deepEqual(history.of(agentKey(1)), []);
});
