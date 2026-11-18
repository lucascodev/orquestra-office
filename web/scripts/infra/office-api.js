const JSON_HEADERS = { "Content-Type": "application/json" };

async function postJson(url, body) {
  const response = await fetch(url, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) });
  return response.ok;
}

export const officeApi = {
  async loadState() {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) throw new Error(String(response.status));
    return response.json();
  },
  watchState({ onState, onError }) {
    const stream = new EventSource("/api/stream");
    stream.addEventListener("state", (event) => onState(JSON.parse(event.data)));
    stream.onerror = onError;
    return () => stream.close();
  },
  decide: (id, body) => postJson(`/api/decisions/${encodeURIComponent(id)}`, body),
  sendMessage: (agentKey, text) => postJson("/api/agents/message", { key: agentKey, text }),
  setTemplate: (projectKey, template) => postJson(`/api/projects/${encodeURIComponent(projectKey)}/template`, { template }),
  closeProject: (projectKey) => postJson(`/api/projects/${encodeURIComponent(projectKey)}/close`, {}),
  async loadHistory(agentKey) {
    const response = await fetch(`/api/agents/history?key=${encodeURIComponent(agentKey)}`, { cache: "no-store" });
    return response.ok ? (await response.json()).entries : [];
  },
};
