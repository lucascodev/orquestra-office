import { isDemoPlanRequest, proposeAgain } from "./demo-plans.js";

const MIN = 60_000;
const PLAN_WAITING_ACTION = "asking-plan-approval";
const REQUEST_LIFETIME_MS = 2 * MIN;
const ASKS_AGAIN_AFTER_TICKS = 3;
const LOG_SIZE = 20;
const WAITING_ACTION = { permission: "permission-requested", question: "asking-question" };

function agentOf(state, agentKey) {
  return Object.values(state.projects).map((project) => project.agents[agentKey]).find(Boolean) ?? null;
}

function waitAgain(agent, request, now) {
  const isPlan = isDemoPlanRequest(request);
  const actionId = isPlan ? PLAN_WAITING_ACTION : WAITING_ACTION[request.kind];
  const subject = request.kind === "permission" && !isPlan ? request.toolName : null;
  Object.assign(agent, { status: "needs_you", actionId, subject, updatedAt: now });
  agent.log = [...(agent.log ?? []), { at: now, actionId, subject }].slice(-LOG_SIZE);
}

// The demo's agents keep asking: a request decided or gone back to the terminal comes back as a new one a few ticks later,
// so the headquarters always has someone waiting for you and a fresh arrival to announce.
export function createDemoAsker(initialRequests) {
  const asked = initialRequests.map((request) => ({ request, idleTicks: 0, times: 0 }));

  return function askAgain(state, now) {
    state.pending = state.pending.filter((request) => !request.expiresAt || request.expiresAt > now);
    for (const entry of asked) {
      const isWaiting = state.pending.some((request) => request.agentKey === entry.request.agentKey);
      const agent = agentOf(state, entry.request.agentKey);
      if (isWaiting || !agent) {
        entry.idleTicks = 0;
        continue;
      }
      entry.idleTicks += 1;
      if (entry.idleTicks < ASKS_AGAIN_AFTER_TICKS) continue;
      entry.idleTicks = 0;
      entry.times += 1;
      const asked = { ...entry.request, id: `${entry.request.id}-${entry.times}`, createdAt: now, expiresAt: now + REQUEST_LIFETIME_MS };
      state.pending = [...state.pending, isDemoPlanRequest(asked) ? proposeAgain(agent, asked, now) : asked];
      waitAgain(agent, entry.request, now);
    }
  };
}
