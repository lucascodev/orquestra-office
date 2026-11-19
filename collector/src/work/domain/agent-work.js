import { checklistFromTodos, withTaskCreated, withTaskUpdated } from "./checklist.js";
import { approvedPlan, nextPlan } from "./plan.js";
import { testsOf, withFileTouched, withFinishedRun, withLateStart, withRunning, withRunsOfDay } from "./tests/agent-tests.js";
import { createTestCalls } from "./tests/test-calls.js";
import { WORK_UPDATE } from "./work-update.js";

const PLAN_TEXT_AGENT_LIMIT = 300;

// Keeps an agent's checklist, plan and tests up to date. The plan texts stay in memory, like the session history: the
// office state only says which version is where.
export function createAgentWork() {
  const calls = createTestCalls();
  const planTexts = new Map();

  function rememberPlanText(agentKey, text) {
    planTexts.delete(agentKey);
    planTexts.set(agentKey, text);
    if (planTexts.size > PLAN_TEXT_AGENT_LIMIT) planTexts.delete(planTexts.keys().next().value);
  }

  function shellStarted(agent, { toolUseId, test, isBackground }, at, isLate) {
    if (isLate) {
      if (agent.tests && calls.isLastRun(agent.key, toolUseId)) agent.tests = withLateStart(testsOf(agent.tests), at);
      return;
    }
    calls.start(agent.key, toolUseId, { startedAt: at, test, isBackground });
    if (test && !isBackground) agent.tests = withRunning(testsOf(agent.tests), calls.runningOf(agent.key));
  }

  function shellFinished(agent, { toolUseId, result }, at) {
    const started = calls.finish(agent.key, toolUseId);
    if (!result) {
      if (agent.tests?.running) agent.tests = withRunning(testsOf(agent.tests), calls.runningOf(agent.key));
      return;
    }
    const tests = withRunning(testsOf(agent.tests), calls.runningOf(agent.key));
    agent.tests = withFinishedRun(tests, { result, startedAt: started?.startedAt ?? null, finishedAt: at });
    calls.markLastRun(agent.key, toolUseId);
  }

  function planProposed(agent, plan, at) {
    if (!plan || planTexts.get(agent.key) === plan.text) return;
    agent.plan = nextPlan(agent.plan ?? null, plan.length, at);
    rememberPlanText(agent.key, plan.text);
  }

  // The end of ExitPlanMode can arrive before its start; it carries the plan too, so the approval is never lost.
  function planApproved(agent, plan, at) {
    planProposed(agent, plan, at);
    if (agent.plan) agent.plan = approvedPlan(agent.plan, at);
  }

  function apply(agent, update, { at, isLate = false }) {
    switch (update.type) {
      case WORK_UPDATE.SHELL_STARTED:
        return shellStarted(agent, update, at, isLate);
      case WORK_UPDATE.SHELL_FINISHED:
        return shellFinished(agent, update, at);
      case WORK_UPDATE.FILE_TOUCHED:
        agent.tests = withFileTouched(testsOf(agent.tests), { path: update.path, action: update.action, at });
        return undefined;
      case WORK_UPDATE.TODOS_WRITTEN:
        agent.checklist = checklistFromTodos(update.todos, at) ?? agent.checklist ?? null;
        return undefined;
      case WORK_UPDATE.TASK_CREATED:
        agent.checklist = withTaskCreated(agent.checklist ?? null, update, at);
        return undefined;
      case WORK_UPDATE.TASK_UPDATED:
        agent.checklist = withTaskUpdated(agent.checklist ?? null, update, at);
        return undefined;
      case WORK_UPDATE.PLAN_PROPOSED:
        return planProposed(agent, update.plan, at);
      case WORK_UPDATE.PLAN_APPROVED:
        return planApproved(agent, update.plan, at);
      default:
        return undefined;
    }
  }

  // A test whose end never arrived (the user interrupted it, or the hook was lost) stops showing as running.
  function endTurn(agent) {
    calls.endTurn(agent.key);
    if (agent.tests?.running) agent.tests = withRunning(testsOf(agent.tests), null);
  }

  function startDay(agent, now) {
    if (!agent.tests?.runsToday?.length) return false;
    const tests = testsOf(agent.tests);
    const fresh = withRunsOfDay(tests, now);
    if (fresh === tests) return false;
    agent.tests = fresh;
    return true;
  }

  function planOf(agent) {
    const text = planTexts.get(agent.key);
    if (!agent.plan || text === undefined) return null;
    const { version, state, proposedAt, decidedAt } = agent.plan;
    return { text, version, state, proposedAt, decidedAt };
  }

  return { apply, endTurn, startDay, planOf, forget: (agentKey) => planTexts.delete(agentKey) };
}
