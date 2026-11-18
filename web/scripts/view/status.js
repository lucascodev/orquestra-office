export const STATUS = {
  working: { label: "digitando", glyph: "⋯", color: "var(--accent)" },
  reviewing: { label: "lendo", glyph: "⋯", color: "var(--info)" },
  needs_you: { label: "precisa de você", glyph: "●", color: "var(--warning)" },
  waiting: { label: "esperando você", glyph: "●", color: "var(--info)" },
  break: { label: "pausa", glyph: "✓", color: "var(--success)" },
  blocked: { label: "bloqueado", glyph: "✗", color: "var(--danger)" },
  idle: { label: "livre", glyph: "○", color: "var(--muted)" },
};

export const ACTIVE_STATUSES = new Set(["working", "reviewing", "needs_you", "waiting", "blocked"]);

export const statusOf = (agent) => (STATUS[agent.status] ? agent.status : "idle");
export const describeStatus = (status) => (STATUS[status] ?? STATUS.idle).label;
