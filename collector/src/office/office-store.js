import { baseName } from "../events/describe-tool.js";
import { agentKeyOf, mainAgentKey } from "./agent-key.js";
import { isTemplate, nextTemplate } from "./templates.js";

const LOG_LIMIT = 20;
const BREAK_TO_IDLE_MS = 10 * 60_000;
const ENDED_SUBAGENT_TTL_MS = 15 * 60_000;
const ENDED_SESSION_TTL_MS = 30 * 60_000;
const SILENT_SESSION_TTL_MS = 6 * 60 * 60_000;
const QUIET_PROJECT_TTL_MS = 30 * 24 * 60 * 60_000;
const SOURCE_LABEL = { claude: "Claude Code", codex: "Codex" };

function projectKeyOf(cwd) {
  const normalized = String(cwd || "sem-pasta").replace(/\\/g, "/").replace(/\/+$/, "");
  return /^[a-z]:\//i.test(normalized) ? normalized.toLowerCase() : normalized;
}

function dayOf(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function emptyState() {
  return { projects: {}, sessions: {}, meters: {}, usage: { rateLimits: null, updatedAt: 0 } };
}

function freshStats(day) {
  return { day, prompts: 0, tools: 0, turns: 0, tokens: 0, costUsd: 0 };
}

// A counter that drops below its last reading was reset (for example by /clear), so the new value is all new spend.
function growthOf(previous, current) {
  return current >= previous ? current - previous : current;
}

export function createOfficeStore(initial) {
  const state = initial?.projects ? { ...emptyState(), ...initial } : emptyState();
  const listeners = new Set();

  const emit = () => listeners.forEach((listener) => listener());

  function ensureProject(event) {
    const known = state.sessions[event.sessionId];
    const key = known ?? projectKeyOf(event.projectRoot || event.cwd);
    state.sessions[event.sessionId] = key;
    if (!state.projects[key]) {
      state.projects[key] = {
        key,
        name: baseName(key) || "sem nome",
        template: nextTemplate(state.projects),
        createdAt: event.at,
        updatedAt: event.at,
        stats: freshStats(dayOf(event.at)),
        agents: {},
      };
    }
    return state.projects[key];
  }

  function ensureAgent(project, event) {
    const mainKey = mainAgentKey(event.source, event.sessionId);
    if (!project.agents[mainKey]) {
      const sameSource = Object.values(project.agents).filter((a) => a.kind === "main" && a.source === event.source).length;
      project.agents[mainKey] = {
        key: mainKey, source: event.source, kind: "main", parentKey: null,
        label: `${SOURCE_LABEL[event.source] ?? event.source}${sameSource ? ` ${sameSource + 1}` : ""}`,
        status: "idle", activity: null, action: "", startedAt: event.at, updatedAt: event.at, endedAt: null, tools: 0, log: [],
      };
    }
    if (!event.agentId) return project.agents[mainKey];
    const subKey = agentKeyOf(event);
    if (!project.agents[subKey]) {
      project.agents[subKey] = {
        key: subKey, source: event.source, kind: "subagent", parentKey: mainKey,
        label: event.agentType ?? "subagente",
        status: "working", activity: null, action: "", startedAt: event.at, updatedAt: event.at, endedAt: null, tools: 0, log: [],
      };
    }
    return project.agents[subKey];
  }

  function statsOf(project, at) {
    if (project.stats.day !== dayOf(at)) project.stats = freshStats(dayOf(at));
    return project.stats;
  }

  function countStat(project, counter, at) {
    if (counter) statsOf(project, at)[counter] += 1;
  }

  function recordUsage(reading) {
    if (!reading?.sessionId) return;
    const previous = state.meters[reading.sessionId];
    const project = state.projects[state.sessions[reading.sessionId]];
    if (previous && project) {
      const stats = statsOf(project, reading.at);
      stats.tokens = (stats.tokens ?? 0) + growthOf(previous.tokens, reading.tokens);
      stats.costUsd = (stats.costUsd ?? 0) + growthOf(previous.costUsd, reading.costUsd);
    }
    state.meters[reading.sessionId] = { tokens: reading.tokens, costUsd: reading.costUsd };
    if (reading.rateLimits) state.usage = { rateLimits: reading.rateLimits, updatedAt: reading.at };
    emit();
  }

  function apply(event) {
    if (!event?.sessionId) return;
    const project = ensureProject(event);
    const agent = ensureAgent(project, event);

    if (event.kind === "session-end") {
      for (const other of Object.values(project.agents)) {
        if (other.key === agent.key || other.parentKey === agent.key) {
          other.status = "idle";
          other.endedAt = event.at;
        }
      }
    } else if (event.kind === "subagent-stop") {
      agent.endedAt = event.at;
    }

    if (event.action) {
      agent.action = event.action;
      agent.log.push({ at: event.at, text: event.action });
      if (agent.log.length > LOG_LIMIT) agent.log.splice(0, agent.log.length - LOG_LIMIT);
    }
    const isPlainProgress = event.action === null;
    if (event.status && (!isPlainProgress || agent.status === "needs_you")) agent.status = event.status;
    if (event.activity) agent.activity = event.activity;
    if (event.team) project.team = event.team;
    if (event.counts === "tools") agent.tools += 1;
    countStat(project, event.counts, event.at);
    agent.updatedAt = event.at;
    project.updatedAt = event.at;
    emit();
  }

  function sweep(now) {
    let changed = false;
    for (const [key, project] of Object.entries(state.projects)) {
      for (const [agentKey, agent] of Object.entries(project.agents)) {
        const quiet = now - agent.updatedAt;
        const ended = agent.endedAt ? now - agent.endedAt : null;
        const expired =
          (agent.kind === "subagent" && ended !== null && ended > ENDED_SUBAGENT_TTL_MS) ||
          (agent.kind === "main" && ended !== null && ended > ENDED_SESSION_TTL_MS) ||
          quiet > SILENT_SESSION_TTL_MS;
        if (expired) {
          delete project.agents[agentKey];
          changed = true;
        } else if (agent.status === "break" && quiet > BREAK_TO_IDLE_MS) {
          agent.status = "idle";
          changed = true;
        }
      }
      if (Object.keys(project.agents).length === 0 && now - project.updatedAt > QUIET_PROJECT_TTL_MS) {
        delete state.projects[key];
        changed = true;
      }
    }
    for (const [sessionId, projectKey] of Object.entries(state.sessions)) {
      const project = state.projects[projectKey];
      const alive = project && Object.keys(project.agents).some((agentKey) => agentKey.split(":")[1] === sessionId);
      if (!alive) {
        delete state.sessions[sessionId];
        delete state.meters[sessionId];
        changed = true;
      }
    }
    if (changed) emit();
  }

  function setTemplate(projectKey, template) {
    const project = state.projects[projectKey];
    if (!project || !isTemplate(template)) return false;
    project.template = template;
    emit();
    return true;
  }

  function closeProject(projectKey) {
    if (!state.projects[projectKey]) return false;
    delete state.projects[projectKey];
    for (const [sessionId, key] of Object.entries(state.sessions)) {
      if (key !== projectKey) continue;
      delete state.sessions[sessionId];
      delete state.meters[sessionId];
    }
    emit();
    return true;
  }

  function findAgent(agentKey) {
    for (const project of Object.values(state.projects)) {
      if (project.agents[agentKey]) return { ...project.agents[agentKey] };
    }
    return null;
  }

  return {
    apply,
    recordUsage,
    sweep,
    setTemplate,
    closeProject,
    findAgent,
    snapshot: () => structuredClone(state),
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
