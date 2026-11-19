import { isRecord } from "../shared/is-record.js";

const PLAN_TOOL = "ExitPlanMode";
const QUESTION = "question";

// Approving a plan reaches the office as a permission for the tool that leaves plan mode.
export const isPlanRequest = (request) => isRecord(request) && request.kind !== QUESTION && request.toolName === PLAN_TOOL;

// The plan travels inside the pending request itself, so what is approved is what the request carries and never a record of
// the agent that may have changed since. A plan cut by the collector says so, to send the reader to the terminal for the rest.
export function planOfRequest(request) {
  if (!isPlanRequest(request) || typeof request.plan !== "string" || request.plan === "") return null;
  return { text: request.plan, isTruncated: request.isPlanTruncated === true };
}

// Approving means approving what was read. A plan cut by the collector, or one that never reached the office, can still be
// sent back to planning from here, but only the terminal, which shows it whole, can approve it.
export const canApprovePlan = (request) => planOfRequest(request)?.isTruncated === false;
