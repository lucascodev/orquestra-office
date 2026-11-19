const ISO_DATE_LENGTH = "YYYY-MM-DD".length;

// The UTC day, which is when the daily stats and the runs of the day start over.
export function dayOf(ms) {
  return new Date(ms).toISOString().slice(0, ISO_DATE_LENGTH);
}
