import { countOf, sumOf } from "./count.js";

// \b starts a match only at the first digit of a number, so a long number is not read again from each of its digits.
const NUMBER_AND_WORD = /\b(\d+) ([a-z]+)/gi;

// Reads "2 failed, 5 passed | 1 skipped" into { failed: 2, passed: 5, skipped: 1 }, whatever the separator.
export function countWordsOf(text) {
  const counts = {};
  for (const [, number, word] of text.matchAll(NUMBER_AND_WORD)) {
    const key = word.toLowerCase();
    counts[key] = key in counts ? sumOf([counts[key], countOf(number)]) : countOf(number);
  }
  return counts;
}

// For formats that print every outcome that happened: a word left out is zero, a count too big to trust stays unknown.
export const countOrZero = (counts, ...words) => sumOf(words.map((word) => (word in counts ? counts[word] : 0)));
