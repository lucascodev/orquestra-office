import { describeActivity } from "./describe-activity.js";

const NEEDS_YOU_NOTIFICATIONS = new Set(["permission_prompt", "elicitation_dialog", "agent_needs_input"]);
const ROLE_NAME = /^[\w.-]{1,40}$/;
const TEAM_LIMIT = 40;
const PATH_LIMIT = 400;

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
    sessionId: String(payload.session_id ?? ""),
    agentId: payload.agent_id ? String(payload.agent_id) : null,
    agentType: payload.agent_type ? String(payload.agent_type).slice(0, 40) : null,
    cwd: typeof payload.cwd === "string" ? payload.cwd : "",
    projectRoot: projectRootOf(payload),
  };
}

function base(payload, now) {
  return { ...claudeActorOf(payload), at: now };
}

function activity(payload, now, status, action, extra = {}) {
  return { ...base(payload, now), kind: "activity", status, action, ...extra };
}

export function normalizeClaudeEvent(payload, now = Date.now()) {
  if (!payload || typeof payload !== "object" || !payload.session_id) return null;
  const event = payload.hook_event_name;

  switch (event) {
    case "SessionStart":
      return activity(payload, now, "idle", payload.source === "resume" ? "retomou a sessão" : "abriu a sessão", { team: teamOf(payload) });
    case "UserPromptSubmit":
      return activity(payload, now, "working", "recebeu um pedido seu", { counts: "prompts", activity: "thinking" });
    case "PreToolUse": {
      const { status, action, activity: doing } = describeActivity(payload.tool_name, payload.tool_input);
      return activity(payload, now, status, action, { counts: "tools", activity: doing });
    }
    case "PostToolUse":
      return activity(payload, now, "working", null);
    case "PostToolUseFailure":
      return activity(payload, now, "working", `falhou ao usar ${String(payload.tool_name ?? "uma ferramenta").slice(0, 30)}`, { activity: "failed" });
    case "PermissionRequest":
      return activity(payload, now, "needs_you", `pede permissão para usar ${String(payload.tool_name ?? "uma ferramenta").slice(0, 30)}`);
    case "Notification": {
      const type = payload.notification_type;
      if (NEEDS_YOU_NOTIFICATIONS.has(type)) return activity(payload, now, "needs_you", "precisa de você no terminal");
      if (type === "idle_prompt") return activity(payload, now, "waiting", "esperando sua resposta");
      return null;
    }
    case "Stop":
      return activity(payload, now, "break", "terminou o turno", { counts: "turns" });
    case "StopFailure":
      return activity(payload, now, "blocked", "parou por erro da API");
    case "SubagentStart":
      return { ...base(payload, now), kind: "subagent-start", status: "working", action: "começou a tarefa" };
    case "SubagentStop":
      return { ...base(payload, now), kind: "subagent-stop", status: "break", action: "entregou a tarefa" };
    case "SessionEnd":
      return { ...base(payload, now), kind: "session-end", status: "idle", action: "fechou a sessão" };
    default:
      return null;
  }
}
