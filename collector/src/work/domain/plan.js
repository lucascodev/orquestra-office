import { countOf } from "./values/count.js";

export const PLAN_STATE = Object.freeze({ PROPOSED: "proposed", APPROVED: "approved", REVISED: "revised" });

// The plan in the office state carries no text: only this, so it can be saved and streamed without what the agent wrote.
export function nextPlan(previous, length, at) {
  const isRevision = Boolean(previous) && previous.state !== PLAN_STATE.APPROVED;
  return {
    version: (countOf(previous?.version) ?? 0) + 1,
    state: isRevision ? PLAN_STATE.REVISED : PLAN_STATE.PROPOSED,
    proposedAt: at,
    decidedAt: null,
    length: countOf(length),
  };
}

export function approvedPlan(plan, at) {
  if (plan.state === PLAN_STATE.APPROVED) return plan;
  return { ...plan, state: PLAN_STATE.APPROVED, decidedAt: at };
}
