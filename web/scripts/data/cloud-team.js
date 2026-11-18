const ROLE_LABELS = {
  "tech-lead": "Tech lead", "product-owner": "Product owner", "software-architect": "Arquiteto",
  "rust-core-engineer": "Núcleo Rust", "rust-platform-engineer": "Plataforma Rust", "desktop-engineer": "Desktop Tauri",
  "frontend-engineer": "Interface", "design-system-engineer": "Design system", "devops-engineer": "Entrega e CI",
  "test-engineer": "Testes", "security-engineer": "Segurança", "code-reviewer": "Revisão de código", "tech-writer": "Redação técnica",
};

export const CLOUD_KEY = "cloud:orquestra";

const toMs = (iso) => (iso ? Date.parse(iso) || 0 : 0);

export function cloudProject(officeState, template) {
  if (!officeState?.agents) return null;
  const agents = {};
  for (const [role, label] of Object.entries(ROLE_LABELS)) {
    const a = officeState.agents[role] ?? {};
    const feed = (officeState.feed ?? []).filter((item) => item.role === role).map((item) => ({ at: toMs(item.at), text: item.text }));
    const own = (a.log ?? []).map((item) => ({ at: toMs(item.at), text: item.text }));
    agents[role] = {
      key: role, source: "claude", kind: "main", parentKey: null, label,
      status: a.status ?? "idle", action: a.story ? `${a.story}: ${a.task ?? ""}` : (a.task ?? ""),
      startedAt: toMs(a.updatedAt), updatedAt: toMs(a.updatedAt), endedAt: null, tools: a.runs ?? 0,
      log: [...feed, ...own].sort((x, y) => x.at - y.at).slice(-20),
    };
  }
  const updatedAt = Math.max(0, ...Object.values(agents).map((a) => a.updatedAt));
  return {
    key: CLOUD_KEY, name: "Orquestra · time na nuvem", template, cloud: true, updatedAt, createdAt: 0,
    stats: { prompts: 0, tools: officeState.stats?.runs ?? 0, turns: officeState.stats?.reviewRounds ?? 0 },
    agents,
  };
}
