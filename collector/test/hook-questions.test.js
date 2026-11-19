import { test } from "node:test";
import assert from "node:assert/strict";
import { questionsOf } from "../src/claude/hook-questions.js";

const QUESTION_TEXT_LIMIT = 4_000;
const questionOfLength = (length) => ({ question: "q".repeat(length), header: "", multiSelect: false, options: [] });

test("a question of up to 4 000 characters is held with its exact text", () => {
  const [held] = questionsOf({ questions: [questionOfLength(QUESTION_TEXT_LIMIT)] });

  assert.equal(held.question.length, QUESTION_TEXT_LIMIT);
});

test("one question over 4 000 characters leaves the whole request to the terminal, uncut", () => {
  assert.deepEqual(questionsOf({ questions: [questionOfLength(1), questionOfLength(QUESTION_TEXT_LIMIT + 1)] }), []);
});
