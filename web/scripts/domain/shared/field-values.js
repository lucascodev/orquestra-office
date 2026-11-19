// One rule for each kind of value the collector sends, so the tag, the island, the tabs and the timeline never disagree about
// the same field. A count is a whole number from zero up: a count written as text came from somewhere else and is unknown.
export const countOf = (value) => (Number.isInteger(value) && value >= 0 ? value : null);

export const timeOf = (value) => (Number.isFinite(value) ? value : null);

export const textOf = (value) => (typeof value === "string" && value !== "" ? value : null);
