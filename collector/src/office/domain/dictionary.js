const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

// Keys come from folders and session ids, so a key like "__proto__" or "constructor" must be an entry like any other.
export function dictionaryOf(record = {}) {
  return Object.assign(Object.create(null), isRecord(record) ? record : {});
}
