// Like the session history, what the agent wrote stays out of the disk: the checklist texts, the failure messages and
// the command lines, which may hold a credential the redaction did not recognize. Only the counts survive a restart,
// and a run still going when the collector stops would never see its end, so it is not saved as running.
function persistedRunOfDay({ label, ...run }) {
  return run;
}

function persistedLastRun(lastRun) {
  if (!lastRun) return lastRun;
  const { command, ...run } = lastRun;
  return { ...run, failures: [] };
}

function persistedTestsOf(tests) {
  const runsToday = Array.isArray(tests.runsToday) ? tests.runsToday.map(persistedRunOfDay) : tests.runsToday;
  return { ...tests, running: null, lastRun: persistedLastRun(tests.lastRun), runsToday };
}

export function persistedAgentOf(agent) {
  const { checklist, ...kept } = agent;
  return kept.tests ? { ...kept, tests: persistedTestsOf(kept.tests) } : kept;
}
