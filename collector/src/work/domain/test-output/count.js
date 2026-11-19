import { MAX_COUNT } from "./limits.js";

const DIGITS = /^\d{1,16}$/;

export function countOf(value) {
  const number = typeof value === "string" && DIGITS.test(value) ? Number(value) : value;
  return Number.isSafeInteger(number) && number >= 0 && number <= MAX_COUNT ? number : null;
}

export function sumOf(values) {
  if (values.some((value) => value === null)) return null;
  return countOf(values.reduce((total, value) => total + value, 0));
}

export function remainderOf(total, parts) {
  if (total === null || parts.some((part) => part === null)) return null;
  return countOf(parts.reduce((rest, part) => rest - part, total));
}

export const unknownCounts = (failures) => ({ passed: null, failed: null, skipped: null, failures });
