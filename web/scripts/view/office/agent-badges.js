import { statusOf } from "../../domain/office/agent-status.js";
import { ownValueOf } from "../../domain/shared/own-value.js";
import { STATUS } from "./status-display.js";

const AGENT_MARKS = { claude: ["C", "var(--a-claude)"], codex: ["Cx", "var(--a-codex)"] };
const UNKNOWN_MARK = ["?", "var(--a-shell)"];

export function agentMark(agent) {
  const [sign, color] = ownValueOf(AGENT_MARKS, agent.source) ?? UNKNOWN_MARK;
  return `<span class="agent-mark" style="background:${color}" aria-hidden="true">${sign}</span>`;
}

export function statusBadge(agent) {
  const { label, glyph, color } = STATUS[statusOf(agent)];
  return `<span class="badge status" style="color:${color}"><span aria-hidden="true">${glyph}</span>${label}</span>`;
}

export const originOf = (agent) => (agent.kind === "subagent" ? "subagente" : agent.source === "codex" ? "Codex" : "Claude Code");
