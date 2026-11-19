import { timeOf } from "../shared/field-values.js";
import { isRecord } from "../shared/is-record.js";

const NO_OFFSET = 0;

const agentsOf = (state) => (isRecord(state?.projects) ? Object.values(state.projects) : [])
  .flatMap((project) => (isRecord(project?.agents) ? Object.values(project.agents) : []))
  .filter(isRecord);

// Moments the collector wrote with its own clock as things happened. Deadlines (expiresAt) are left out: they lie ahead on
// purpose and say nothing about what time the collector had reached.
function stampsOfAgent(agent) {
  const tests = isRecord(agent.tests) ? agent.tests : {};
  return [
    agent.updatedAt, tests.running?.startedAt, tests.lastRun?.finishedAt, agent.plan?.proposedAt, agent.plan?.decidedAt,
    agent.checklist?.updatedAt,
  ];
}

// The newest moment the collector wrote in the state, which its clock had therefore already reached, or null for none.
export function newestCollectorStamp(state) {
  const requests = Array.isArray(state?.pending) ? state.pending.filter(isRecord) : [];
  const stamps = [...agentsOf(state).flatMap(stampsOfAgent), ...requests.map((request) => request.createdAt)].map(timeOf).filter((at) => at !== null);
  return stamps.length === 0 ? null : Math.max(...stamps);
}

// The collector's clock as the page reads it. The collector stamps running rounds, decisions and deadlines with its own
// clock, maybe in a container that runs ahead of the browser, and a round that started "in the future" would hold its clock
// at 0:00. When the collector says what time it was (generatedAt), that is the offset; otherwise the newest stamp it wrote
// shows how far ahead it is at least. What was learned is kept, so an update with older stamps never sets the clock back.
export function createCollectorClock() {
  let offset = NO_OFFSET;

  function observe(state, receivedAt) {
    const generatedAt = timeOf(state?.generatedAt);
    if (generatedAt !== null) {
      offset = generatedAt - receivedAt;
      return;
    }
    const newest = newestCollectorStamp(state);
    if (newest !== null) offset = Math.max(offset, newest - receivedAt);
  }

  return { observe, now: (localNow) => localNow + offset };
}
