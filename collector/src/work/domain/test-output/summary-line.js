import { SUMMARY_LINE_LIMIT } from "./limits.js";

// A real summary line is short; a longer one is never handed to the summary patterns, which then never see a long run
// of the characters they repeat.
export const isSummaryCandidate = (line) => line.length <= SUMMARY_LINE_LIMIT;
