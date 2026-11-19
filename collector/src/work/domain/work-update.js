// What a tool call changed in the agent's checklist, plan or tests, as the hook adapters describe it.
export const WORK_UPDATE = Object.freeze({
  SHELL_STARTED: "shell-started",
  SHELL_FINISHED: "shell-finished",
  FILE_TOUCHED: "file-touched",
  TODOS_WRITTEN: "todos-written",
  TASK_CREATED: "task-created",
  TASK_UPDATED: "task-updated",
  PLAN_PROPOSED: "plan-proposed",
  PLAN_APPROVED: "plan-approved",
});
