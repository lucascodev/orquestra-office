import { AGENT_ACTION } from "../office/domain/agent-actions.js";
import { TOOL_PHASE } from "../office/domain/tool-order.js";
import { PLAN_TOOL } from "../shared/claude/tool-names.js";
import { PATH_LIMIT } from "../shared/text/field-limits.js";
import { claudeSessionIdOf } from "./claude-session-id.js";
import { describeActivity } from "./describe-activity.js";
import { claudeWorkOf } from "./work/claude-work.js";

const NEEDS_YOU_NOTIFICATIONS = new Set(["permission_prompt", "elicitation_dialog", "agent_needs_input"]);
const ROLE_NAME = /^[\w.-]{1,40}$/;
const TEAM_LIMIT = 40;
const AGENT_TYPE_LIMIT = 40;
const TOOL_NAME_LIMIT = 30;
const TOOL_USE_ID_LIMIT = 100;

function projectRootOf(payload) {
  const root = payload.office?.repoRoot;
  return typeof root === "string" ? root.slice(0, PATH_LIMIT) : "";
}

function teamOf(payload) {
  const team = payload.office?.team;
  return Array.isArray(team) ? team.filter((role) => typeof role === "string" && ROLE_NAME.test(role)).slice(0, TEAM_LIMIT) : null;
}

export function claudeActorOf(payload) {
  return {
    source: "claude",
    sessionId: claudeSessionIdOf(payload),
    agentId: payload.agent_id ? String(payload.agent_id) : null,
    agentType: payload.agent_type ? String(payload.agent_type).slice(0, AGENT_TYPE_LIMIT) : null,
    cwd: typeof payload.cwd === "string" ? payload.cwd.slice(0, PATH_LIMIT) : "",
    projectRoot: projectRootOf(payload),
  };
}

function base(payload, now) {
  return { ...claudeActorOf(payload), at: now };
}

const named = (actionId, subject = null) => ({ actionId, subject });
const NO_ACTION = Object.freeze(named(null));

function toolNamed(actionId, payload) {
  return named(actionId, payload.tool_name == null ? null : String(payload.tool_name).slice(0, TOOL_NAME_LIMIT));
}

const toolUseIdOf = (payload) => (typeof payload.tool_use_id === "string" ? payload.tool_use_id.slice(0, TOOL_USE_ID_LIMIT) : null);
const rootOf = (payload) => projectRootOf(payload) || claudeActorOf(payload).cwd;

function toolCallOf(payload, toolPhase) {
  const toolUseId = toolUseIdOf(payload);
  const work = claudeWorkOf(payload, { toolUseId, root: rootOf(payload) });
  return { toolUseId, toolPhase, ...(work && { work }) };
}

function activity(payload, now, status, described, extra = {}) {
  return { ...base(payload, now), kind: "activity", status, ...described, ...extra };
}

const afterToolAction = (payload) => (payload.tool_name === PLAN_TOOL ? named(AGENT_ACTION.PLAN_APPROVED) : NO_ACTION);

export function normalizeClaudeEvent(payload, now = Date.now()) {
  if (!payload || typeof payload !== "object" || !payload.session_id) return null;
  const event = payload.hook_event_name;

  switch (event) {
    case "SessionStart":
      return activity(payload, now, "idle", named(payload.source === "resume" ? AGENT_ACTION.SESSION_RESUMED : AGENT_ACTION.SESSION_OPENED), { team: teamOf(payload) });
    case "UserPromptSubmit":
      return activity(payload, now, "working", named(AGENT_ACTION.PROMPT_RECEIVED), { counts: "prompts", activity: "thinking" });
    case "PreToolUse": {
      const { status, activity: doing, actionId, subject } = describeActivity(payload.tool_name, payload.tool_input, rootOf(payload));
      return activity(payload, now, status, named(actionId, subject), { counts: "tools", activity: doing, ...toolCallOf(payload, TOOL_PHASE.BEFORE) });
    }
    case "PostToolUse":
      return activity(payload, now, "working", afterToolAction(payload), toolCallOf(payload, TOOL_PHASE.AFTER));
    case "PostToolUseFailure":
      return activity(payload, now, "working", toolNamed(AGENT_ACTION.TOOL_FAILED, payload), { activity: "failed", ...toolCallOf(payload, TOOL_PHASE.AFTER) });
    case "PermissionRequest":
      return activity(payload, now, "needs_you", toolNamed(AGENT_ACTION.PERMISSION_REQUESTED, payload));
    case "Notification": {
      const type = payload.notification_type;
      if (NEEDS_YOU_NOTIFICATIONS.has(type)) return activity(payload, now, "needs_you", named(AGENT_ACTION.NEEDS_YOU_IN_TERMINAL));
      if (type === "idle_prompt") return activity(payload, now, "waiting", named(AGENT_ACTION.WAITING_FOR_REPLY));
      return null;
    }
    case "Stop":
      return activity(payload, now, "break", named(AGENT_ACTION.TURN_FINISHED), { counts: "turns", endsTurn: true });
    case "StopFailure":
      return activity(payload, now, "blocked", named(AGENT_ACTION.API_ERROR));
    case "SubagentStart":
      return { ...base(payload, now), kind: "subagent-start", status: "working", ...named(AGENT_ACTION.TASK_STARTED) };
    case "SubagentStop":
      return { ...base(payload, now), kind: "subagent-stop", status: "break", ...named(AGENT_ACTION.TASK_DELIVERED), endsTurn: true };
    case "SessionEnd":
      return { ...base(payload, now), kind: "session-end", status: "idle", ...named(AGENT_ACTION.SESSION_CLOSED) };
    default:
      return null;
  }
}
