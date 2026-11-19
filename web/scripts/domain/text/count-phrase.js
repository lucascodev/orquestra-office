import { fillPhrase } from "./fill-phrase.js";

const SINGLE = 1;

const isCount = (value) => Number.isInteger(value) && value >= 0;

// Picks the singular, the plural or the phrase for a count nobody knows, so "1 falhou" never reads "1 falharam".
export function countPhrase(forms, count) {
  if (!isCount(count)) return forms.unknown;
  return fillPhrase(count === SINGLE ? forms.one : forms.other, { count });
}
