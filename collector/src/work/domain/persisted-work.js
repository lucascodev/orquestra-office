// Like the session history, what the agent wrote stays out of the disk: the checklist texts and the failure messages
// are shown while the collector runs, and only the counts survive a restart.
export function persistedAgentOf(agent) {
  const { checklist, ...kept } = agent;
  if (!kept.tests?.lastRun) return kept;
  return { ...kept, tests: { ...kept.tests, lastRun: { ...kept.tests.lastRun, failures: [] } } };
}
