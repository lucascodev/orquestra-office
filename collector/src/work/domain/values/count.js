const COUNT_LIMIT = 10_000_000;

export function countOf(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= COUNT_LIMIT ? value : null;
}
