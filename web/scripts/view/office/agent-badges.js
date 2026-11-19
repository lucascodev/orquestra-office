import { ownValueOf } from "../../domain/shared/own-value.js";

const AGENT_MARKS = { claude: ["C", "var(--a-claude)"], codex: ["Cx", "var(--a-codex)"] };
const UNKNOWN_MARK = ["?", "var(--a-shell)"];

export function agentMark(agent) {
  const [sign, color] = ownValueOf(AGENT_MARKS, agent.source) ?? UNKNOWN_MARK;
  return `<span class="agent-mark" style="background:${color}" aria-hidden="true">${sign}</span>`;
}

export const originOf = (agent) => (agent.kind === "subagent" ? "subagente" : agent.source === "codex" ? "Codex" : "Claude Code");
