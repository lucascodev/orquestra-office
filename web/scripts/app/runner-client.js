const RUNNER_URL = "http://127.0.0.1:8421";
const JSON_HEADERS = { "Content-Type": "application/json" };
const NO_ANSWER = "O executor não respondeu. Confira se ele está rodando.";

const post = (path, body = {}) => fetch(`${RUNNER_URL}${path}`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) });

async function act(path, body) {
  try {
    return (await post(path, body)).ok;
  } catch {
    return false;
  }
}

export const runnerClient = {
  async listSessions() {
    try {
      const response = await fetch(`${RUNNER_URL}/sessions`, { cache: "no-store" });
      return response.ok ? (await response.json()).sessions : null;
    } catch {
      return null;
    }
  },
  async openSession(cwd, prompt) {
    try {
      const response = await post("/sessions", { cwd, prompt });
      const body = await response.json();
      return response.ok ? { session: body.session } : { error: body.error ?? NO_ANSWER };
    } catch {
      return { error: NO_ANSWER };
    }
  },
  send: (sessionId, text) => act(`/sessions/${sessionId}/messages`, { text }),
  interrupt: (sessionId) => act(`/sessions/${sessionId}/interrupt`),
  stop: (sessionId) => act(`/sessions/${sessionId}/stop`),
  watch(sessionId, { onSnapshot, onChange }) {
    const stream = new EventSource(`${RUNNER_URL}/sessions/${sessionId}/stream`);
    stream.addEventListener("snapshot", (event) => onSnapshot(JSON.parse(event.data)));
    stream.addEventListener("change", (event) => onChange(JSON.parse(event.data)));
    return () => stream.close();
  },
};
