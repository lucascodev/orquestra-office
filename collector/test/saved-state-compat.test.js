import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeClaudeEvent } from "../src/claude/claude-event.js";
import { createOffice } from "../src/composition.js";

const TEXT_ACTIONS_STATE = fileURLToPath(new URL("./fixtures/office-state-with-text-actions.json", import.meta.url));
const WEB_DIR = fileURLToPath(new URL("../../web", import.meta.url));
const PROJECT_KEY = "c:/projetos/antigo";
const MAIN_KEY = "claude:legacy1";
const SUBAGENT_KEY = "claude:legacy1:sub1";
const LATER = 1_763_470_300_000;
const SAVED_LOG = ["abriu a sessão", "recebeu um pedido seu", "rodando npm", "você aprovou Bash pelo escritório", "editando legado.js"];

async function withSavedState(run) {
  const dataDir = await mkdtemp(join(tmpdir(), "office-saved-state-"));
  try {
    await copyFile(TEXT_ACTIONS_STATE, join(dataDir, "office.json"));
    const office = createOffice({ webDir: WEB_DIR, dataDir });
    await run({ dataDir, office });
    office.stop();
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
}

const projectIn = (office) => office.store.snapshot().projects[PROJECT_KEY];

test("a state saved with actions as text loads every project, agent and log entry", () => withSavedState(({ office }) => {
  const project = projectIn(office);
  assert.deepEqual(Object.keys(project.agents).sort(), [MAIN_KEY, SUBAGENT_KEY]);
  assert.deepEqual([project.name, project.template, project.team], ["antigo", "biblioteca", ["code-reviewer"]]);
  assert.equal(project.agents[MAIN_KEY].action, "editando legado.js");
  assert.deepEqual(project.agents[MAIN_KEY].log.map((entry) => entry.text), SAVED_LOG);
  assert.equal(project.agents[SUBAGENT_KEY].action, "lendo antigo.md");
}));

test("an agent loaded from a state with text actions keeps its old log and takes new events", () => withSavedState(({ office }) => {
  office.store.apply(normalizeClaudeEvent({ session_id: "legacy1", cwd: "c:/projetos/antigo", hook_event_name: "Stop" }, LATER));
  const agent = projectIn(office).agents[MAIN_KEY];
  assert.deepEqual([agent.status, agent.updatedAt, agent.log.length], ["break", LATER, SAVED_LOG.length + 1]);
  assert.deepEqual(agent.log.slice(0, SAVED_LOG.length).map((entry) => entry.text), SAVED_LOG);
}));

test("a state saved with actions as text is written back and loads again the same", () => withSavedState(({ dataDir, office }) => {
  const loaded = office.store.snapshot();
  office.stop();
  assert.deepEqual(createOffice({ webDir: WEB_DIR, dataDir }).store.snapshot(), loaded);
}));

test("a new action replaces the text of an agent loaded from a state with text actions", () => withSavedState(({ office }) => {
  office.store.apply(normalizeClaudeEvent({ session_id: "legacy1", cwd: "c:/projetos/antigo", hook_event_name: "Stop" }, LATER));
  const agent = projectIn(office).agents[MAIN_KEY];
  assert.deepEqual([agent.action, agent.actionId, agent.subject], [undefined, "turn-finished", null]);
}));
