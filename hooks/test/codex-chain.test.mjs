import assert from "node:assert/strict";
import { test } from "node:test";
import { chainedArgumentsOf, chainedNotifyCommand, isChainedNotifyCommand, previousNotifyOf } from "../lib/codex-chain.mjs";

const OPTIONS = { officeUrl: "http://127.0.0.1:8420", chainScript: "C:/office/hooks/office-codex-notify.mjs" };
const PREVIOUS = ["C:/Apps/codex-computer-use.exe", "turn-ended"];
const TURN = '{"type":"agent-turn-complete"}';

test("the chained command runs the office script with the office address, then the previous command", () => {
  assert.deepEqual(chainedNotifyCommand(OPTIONS, PREVIOUS), ["node", OPTIONS.chainScript, "--office-url", OPTIONS.officeUrl, "--then", ...PREVIOUS]);
});

test("the previous command is read back from the chained command, and nothing from any other command", () => {
  const chained = chainedNotifyCommand(OPTIONS, PREVIOUS);

  assert.equal(isChainedNotifyCommand(chained), true);
  assert.deepEqual(previousNotifyOf(chained), PREVIOUS);
  for (const other of [PREVIOUS, ["node", "other.mjs", "--office-url", "x", "--then", "a"], chained.slice(0, 5), chained.with(4, "--and")]) {
    assert.equal(isChainedNotifyCommand(other), false, JSON.stringify(other));
    assert.deepEqual(previousNotifyOf(other), []);
  }
});

test("the script reads its own options, the previous command and the turn Codex appends last", () => {
  const args = [...chainedNotifyCommand(OPTIONS, PREVIOUS).slice(2), TURN];

  assert.deepEqual(chainedArgumentsOf(args), { officeArgs: ["--office-url", OPTIONS.officeUrl], previous: PREVIOUS, turn: TURN });
});

test("a --then inside the previous command belongs to it", () => {
  const args = ["--office-url", OPTIONS.officeUrl, "--then", "tool", "--then", "x", TURN];

  assert.deepEqual(chainedArgumentsOf(args).previous, ["tool", "--then", "x"]);
});

test("without --then there is no previous command", () => {
  assert.deepEqual(chainedArgumentsOf(["--office-url", OPTIONS.officeUrl, TURN]), { officeArgs: ["--office-url", OPTIONS.officeUrl], previous: [], turn: TURN });
});
