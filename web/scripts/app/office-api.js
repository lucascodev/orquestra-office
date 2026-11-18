const JSON_HEADERS = { "Content-Type": "application/json" };

async function postJson(url, body) {
  const response = await fetch(url, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) });
  return response.ok;
}

export const officeApi = {
  decide: (id, body) => postJson(`/api/decisions/${encodeURIComponent(id)}`, body),
  sendMessage: (agentKey, text) => postJson("/api/agents/message", { key: agentKey, text }),
  setTemplate: (projectKey, template) => postJson(`/api/projects/${encodeURIComponent(projectKey)}/template`, { template }),
  closeProject: (projectKey) => postJson(`/api/projects/${encodeURIComponent(projectKey)}/close`, {}),
  async loadHistory(agentKey) {
    const response = await fetch(`/api/agents/history?key=${encodeURIComponent(agentKey)}`, { cache: "no-store" });
    return response.ok ? (await response.json()).entries : [];
  },
};
