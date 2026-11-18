import { AGENT_ACTION } from "../office/domain/agent-actions.js";
import { PATH_LIMIT } from "../shared/text/field-limits.js";
import { claudeSessionIdOf } from "./claude-session-id.js";
import { describeActivity } from "./describe-activity.js";

const NEEDS_YOU_NOTIFICATIONS = new Set(["permission_prompt", "elicitation_dialog", "agent_needs_input"]);
const ROLE_NAME = /^[\w.-]{1,40}$/;
const TEAM_LIMIT = 40;
const AGENT_TYPE_LIMIT = 40;
const TOOL_NAME_LIMIT = 30;
const UNNAMED_TOOL = "uma ferramenta";

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

const named = (actionId, action, subject = null) => ({ actionId, subject, action });
const NO_ACTION = Object.freeze(named(null, null));

function toolNamed(actionId, payload, phrase) {
  const toolName = payload.tool_name == null ? null : String(payload.tool_name).slice(0, TOOL_NAME_LIMIT);
  return named(actionId, `${phrase} ${toolName ?? UNNAMED_TOOL}`, toolName);
}

function activity(payload, now, status, described, extra = {}) {
  return { ...base(payload, now), kind: "activity", status, ...described, ...extra };
}

export function normalizeClaudeEvent(payload, now = Date.now()) {
  if (!payload || typeof payload !== "object" || !payload.session_id) return null;
  const event = payload.hook_event_name;

  switch (event) {
    case "SessionStart":
      return activity(payload, now, "idle", payload.source === "resume" ? named(AGENT_ACTION.SESSION_RESUMED, "retomou a sessão") : named(AGENT_ACTION.SESSION_OPENED, "abriu a sessão"), { team: teamOf(payload) });
    case "UserPromptSubmit":
      return activity(payload, now, "working", named(AGENT_ACTION.PROMPT_RECEIVED, "recebeu um pedido seu"), { counts: "prompts", activity: "thinking" });
    case "PreToolUse": {
      const { status, activity: doing, actionId, subject, action } = describeActivity(payload.tool_name, payload.tool_input);
      return activity(payload, now, status, named(actionId, action, subject), { counts: "tools", activity: doing });
    }
    case "PostToolUse":
      return activity(payload, now, "working", NO_ACTION);
    case "PostToolUseFailure":
      return activity(payload, now, "working", toolNamed(AGENT_ACTION.TOOL_FAILED, payload, "falhou ao usar"), { activity: "failed" });
    case "PermissionRequest":
      return activity(payload, now, "needs_you", toolNamed(AGENT_ACTION.PERMISSION_REQUESTED, payload, "pede permissão para usar"));
    case "Notification": {
      const type = payload.notification_type;
      if (NEEDS_YOU_NOTIFICATIONS.has(type)) return activity(payload, now, "needs_you", named(AGENT_ACTION.NEEDS_YOU_IN_TERMINAL, "precisa de você no terminal"));
      if (type === "idle_prompt") return activity(payload, now, "waiting", named(AGENT_ACTION.WAITING_FOR_REPLY, "esperando sua resposta"));
      return null;
    }
    case "Stop":
      return activity(payload, now, "break", named(AGENT_ACTION.TURN_FINISHED, "terminou o turno"), { counts: "turns" });
    case "StopFailure":
      return activity(payload, now, "blocked", named(AGENT_ACTION.API_ERROR, "parou por erro da API"));
    case "SubagentStart":
      return { ...base(payload, now), kind: "subagent-start", status: "working", ...named(AGENT_ACTION.TASK_STARTED, "começou a tarefa") };
    case "SubagentStop":
      return { ...base(payload, now), kind: "subagent-stop", status: "break", ...named(AGENT_ACTION.TASK_DELIVERED, "entregou a tarefa") };
    case "SessionEnd":
      return { ...base(payload, now), kind: "session-end", status: "idle", ...named(AGENT_ACTION.SESSION_CLOSED, "fechou a sessão") };
    default:
      return null;
  }
}
