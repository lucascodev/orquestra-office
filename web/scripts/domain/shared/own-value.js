// A plain object also answers to names it inherits, such as "toString" or "constructor"; text from outside must not reach those.
export const ownValueOf = (table, key) => (Object.hasOwn(table, key) ? table[key] : undefined);
