const JSON_HEADERS = { "Content-Type": "application/json" };
const UNPAIRED_STATUS = 401;

export class UnpairedError extends Error {
  constructor(isSecretMissing) {
    super("this browser is not paired with the office");
    this.name = "UnpairedError";
    this.isSecretMissing = isSecretMissing;
  }
}

const post = (url, body) => fetch(url, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) });

async function postJson(url, body) {
  return (await post(url, body)).ok;
}

async function unpairedErrorOf(response) {
  const body = await response.json().catch(() => ({}));
  return new UnpairedError(body?.isSecretMissing === true);
}

export const officeApi = {
  async loadState() {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (response.status === UNPAIRED_STATUS) throw await unpairedErrorOf(response);
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
  redeemPairing: (code, label) => postJson("/api/pairings/redeem", { code, label }),
  async pairDevice() {
    const response = await post("/api/pairings", {});
    return response.ok ? response.json() : null;
  },
  async listDevices() {
    const response = await fetch("/api/devices", { cache: "no-store" });
    return response.ok ? (await response.json()).devices : null;
  },
  revokeDevice: (id) => postJson(`/api/devices/${encodeURIComponent(id)}/revoke`, {}),
};
