export const STATUS = {
  working: { label: "digitando", sentence: "Trabalhando", glyph: "⋯", color: "var(--accent)" },
  reviewing: { label: "lendo", sentence: "Lendo ou pesquisando", glyph: "⋯", color: "var(--info)" },
  needs_you: { label: "precisa de você", sentence: "Precisa de você agora", glyph: "●", color: "var(--warning)" },
  waiting: { label: "esperando você", sentence: "Terminou e espera sua resposta", glyph: "●", color: "var(--info)" },
  break: { label: "pausa", sentence: "Em pausa", glyph: "✓", color: "var(--success)" },
  blocked: { label: "bloqueado", sentence: "Parou com um erro", glyph: "✗", color: "var(--danger)" },
  idle: { label: "livre", sentence: "Livre, sem tarefa", glyph: "○", color: "var(--muted)" },
};

export const describeStatus = (status) => (Object.hasOwn(STATUS, status) ? STATUS[status] : STATUS.idle).label;
