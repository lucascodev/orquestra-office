import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FIRST_NAMES } from "../scripts/data/first-names.js";
import { withAgentNames, withBuildingAgentNames } from "../scripts/domain/office/agent-names.js";
import { statusOf } from "../scripts/domain/office/agent-status.js";
import { buildDecision } from "../scripts/domain/office/decision-body.js";
import { needsYou, sortedProjects } from "../scripts/domain/office/project-order.js";

const NOW = 1_800_000_000_000;
const MINUTE = 60_000;

const agentOf = (key, extra = {}) => ({ key, kind: "main", source: "claude", status: "working", startedAt: NOW, updatedAt: NOW, endedAt: null, ...extra });
const projectOf = (agents, extra = {}) => ({ key: "c:/demo", name: "demo", updatedAt: NOW, agents: Object.fromEntries(agents.map((agent) => [agent.key, agent])), ...extra });
const namesOf = (project) => Object.fromEntries(Object.values(withAgentNames(project).agents).map((agent) => [agent.key, agent.name]));

describe("agent names", () => {
  it("names each agent the same way on every release, so people keep their colleagues' names", () => {
    const project = projectOf(["claude:a1", "claude:a1:s1", "codex:b1", "claude:c1"].map((key) => agentOf(key)));
    assert.deepEqual(namesOf(project), { "claude:a1": "Heitor", "claude:a1:s1": "Tiago", "codex:b1": "Nara", "claude:c1": "Luca" });
  });

  it("gives the next free name to an agent whose preferred name is already taken", () => {
    const project = projectOf([agentOf("claude:k6"), agentOf("claude:k20")]);
    assert.deepEqual(namesOf(project), { "claude:k6": "Rita", "claude:k20": "Raul" });
  });

  it("keeps the names when start times change or agents arrive in another order", () => {
    const before = projectOf([agentOf("claude:k6", { startedAt: NOW }), agentOf("claude:k20", { startedAt: NOW - MINUTE })]);
    const after = projectOf([agentOf("claude:k20", { startedAt: NOW + MINUTE }), agentOf("claude:k6", { startedAt: NOW - 10 * MINUTE })]);
    assert.deepEqual(namesOf(after), namesOf(before));
  });

  it("never repeats a name while the list of first names lasts", () => {
    const agents = FIRST_NAMES.map((_, i) => agentOf(`claude:session-${i}`));
    const names = Object.values(namesOf(projectOf(agents)));
    assert.equal(new Set(names).size, FIRST_NAMES.length);
    assert.deepEqual([...names].sort(), [...FIRST_NAMES].sort());
  });

  it("adds the name without touching the project or the other agent fields", () => {
    const agent = agentOf("claude:a1", { label: "Claude Code", action: "editando a.js" });
    const project = projectOf([agent]);
    const named = withAgentNames(project);
    assert.deepEqual(named.agents["claude:a1"], { ...agent, name: "Heitor" });
    assert.equal(named.key, project.key);
    assert.equal(project.agents["claude:a1"].name, undefined);
  });
});

describe("agent names in the headquarters", () => {
  const officeOf = (...projects) => Object.fromEntries(projects.map((project) => [project.key, project]));
  const buildingNamesOf = (office) => Object.fromEntries(Object.values(withBuildingAgentNames(office))
    .flatMap((project) => Object.values(project.agents).map((agent) => [agent.key, agent.name])));

  it("never gives the same name to two agents of different projects", () => {
    const office = officeOf(
      projectOf([agentOf("claude:k6")], { key: "c:/a" }),
      projectOf([agentOf("claude:k20")], { key: "c:/b" }),
    );
    assert.deepEqual(buildingNamesOf(office), { "claude:k6": "Rita", "claude:k20": "Raul" });
  });

  it("keeps the name an agent already has and keeps it out of the others' reach", () => {
    const office = officeOf(
      projectOf([agentOf("claude:k6", { name: "Raul" })], { key: "c:/a" }),
      projectOf([agentOf("claude:k20")], { key: "c:/b" }),
    );
    const names = buildingNamesOf(office);
    assert.equal(names["claude:k6"], "Raul");
    assert.notEqual(names["claude:k20"], "Raul");
  });

  it("adds the names without touching the projects", () => {
    const project = projectOf([agentOf("claude:a1")]);
    const named = withBuildingAgentNames(officeOf(project));
    assert.equal(named[project.key].key, project.key);
    assert.equal(named[project.key].agents["claude:a1"].name, "Heitor");
    assert.equal(project.agents["claude:a1"].name, undefined);
  });
});

describe("project order", () => {
  const waiting = (key) => agentOf(key, { status: "needs_you" });

  it("counts only the agents that need you", () => {
    const project = projectOf([waiting("claude:a"), waiting("claude:b"), agentOf("claude:c", { status: "waiting" }), agentOf("claude:d", { status: "blocked" })]);
    assert.equal(needsYou(project), 2);
    assert.equal(needsYou(projectOf([])), 0);
  });

  it("puts the rooms with more agents needing you first, then the most recently active", () => {
    const projects = {
      quiet: projectOf([agentOf("claude:q")], { key: "quiet", updatedAt: NOW }),
      recent: projectOf([agentOf("claude:r")], { key: "recent", updatedAt: NOW + MINUTE }),
      oneNeed: projectOf([waiting("claude:o")], { key: "oneNeed", updatedAt: NOW - 10 * MINUTE }),
      twoNeeds: projectOf([waiting("claude:t1"), waiting("claude:t2")], { key: "twoNeeds", updatedAt: NOW - 20 * MINUTE }),
    };
    assert.deepEqual(sortedProjects(projects).map((project) => project.key), ["twoNeeds", "oneNeed", "recent", "quiet"]);
  });

  it("returns an empty list when there are no rooms", () => {
    assert.deepEqual(sortedProjects({}), []);
  });
});

describe("agent status", () => {
  it("keeps every status the office knows", () => {
    const known = ["working", "reviewing", "needs_you", "waiting", "break", "blocked", "idle"];
    assert.deepEqual(known.map((status) => statusOf({ status })), known);
  });

  it("shows an unknown or missing status as free", () => {
    assert.equal(statusOf({ status: "dancing" }), "idle");
    assert.equal(statusOf({}), "idle");
  });

  it("shows a status named after a built-in object property as free", () => {
    const inherited = ["toString", "constructor", "__proto__", "hasOwnProperty"];
    assert.deepEqual(inherited.map((status) => statusOf({ status })), inherited.map(() => "idle"));
  });
});

describe("decision body", () => {
  it("joins the picked options and the written answer of each question", () => {
    const questions = [{ question: "Quais testes?", picked: ["unidade", "contrato"], other: " e2e " }];
    assert.deepEqual(buildDecision("answer", { questions }), { answers: { "Quais testes?": "unidade, contrato, e2e" } });
  });

  it("gives no body while any question is left without an answer", () => {
    const questions = [{ question: "A?", picked: ["sim"], other: "" }, { question: "B?", picked: [], other: "" }];
    assert.equal(buildDecision("answer", { questions }), null);
  });

  it("trims the reason of a denial and passes allow and terminal through", () => {
    assert.deepEqual(buildDecision("deny", { reason: " não agora " }), { behavior: "deny", message: "não agora" });
    assert.deepEqual(buildDecision("allow"), { behavior: "allow" });
    assert.deepEqual(buildDecision("terminal"), { behavior: "terminal" });
  });
});
