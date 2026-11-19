// A plain object read from outside, as opposed to null, an array, a string or a number that a damaged saved state may hold.
export const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
