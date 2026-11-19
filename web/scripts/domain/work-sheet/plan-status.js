import { timeOf } from "../shared/field-values.js";
import { isRecord } from "../shared/is-record.js";

const PROPOSED = "proposed";
const APPROVED = "approved";
const KNOWN_STATES = new Set([PROPOSED, APPROVED, "revised"]);
const FIRST_VERSION = 1;

// The latest plan of the session as the stream tells it, without its text: state, version and the moment that state began.
// Any plan not yet approved waits for you, the first version (proposed) as much as a new one that came before you approved
// the one before (revised), so it is dated by when it arrived; an approved one by when it was approved. The stamp changes
// whenever the text the sheet fetched may be stale. Null when the agent has not planned.
export function planStatus(plan) {
  if (!isRecord(plan)) return null;
  const state = KNOWN_STATES.has(plan.state) ? plan.state : PROPOSED;
  const version = Number.isInteger(plan.version) && plan.version >= FIRST_VERSION ? plan.version : FIRST_VERSION;
  const proposedAt = timeOf(plan.proposedAt);
  const decidedAt = timeOf(plan.decidedAt);
  const isWaiting = state !== APPROVED;
  return {
    state,
    version,
    at: isWaiting ? proposedAt : decidedAt ?? proposedAt,
    decidedAt: isWaiting ? null : decidedAt,
    stamp: `${version}|${state}|${proposedAt ?? ""}`,
  };
}
