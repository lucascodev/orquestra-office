import { fillPhrase } from "./fill-phrase.js";

const ONE = 1;

// Picks the singular, the plural or the phrase for an unknown count ("1 falhou", "2 falharam", "Terminou com erro").
export function countPhrase(phrases, count) {
  if (count === null || count === undefined) return phrases.unknown ?? "";
  return fillPhrase(count === ONE ? phrases.one : phrases.many, { count });
}
