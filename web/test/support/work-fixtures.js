// Agents with the checklist and tests fields of docs/arquitetura/checklist-plano-testes.md, section 2.
export const SECOND = 1_000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY_START = Date.UTC(2026, 10, 19);
export const NOW = DAY_START + 18 * HOUR + 5 * MINUTE;

export const item = (status) => ({ id: status, text: "x", status, activeText: "x" });
export const checklistOf = (...statuses) => ({ items: statuses.map(item), updatedAt: NOW - MINUTE });
export const run = (fields) => ({ command: "npx vitest run", framework: "vitest", startedAt: NOW - 2 * MINUTE, durationMs: 3_400, skipped: 0, failures: [], ...fields });
export const failedRun = (failed, passed, finishedAt = NOW - MINUTE) => run({ isOk: false, failed, passed, finishedAt });
export const passedRun = (passed, finishedAt = NOW - 10 * SECOND) => run({ isOk: true, failed: 0, passed, finishedAt });
export const testsWith = (fields) => ({ running: null, lastRun: null, runsToday: [], files: [], lastTestFileAt: null, ...fields });
export const agentWith = (fields = {}) => ({ key: "claude:h1", name: "Heitor", status: "working", log: [], ...fields });
