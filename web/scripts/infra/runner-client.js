import { officeApi } from "./office-api.js";

const RUNNER_URL = "http://127.0.0.1:8421";
const JSON_HEADERS = { "Content-Type": "application/json" };
const NO_ANSWER = "O executor não respondeu. Confira se ele está rodando.";
const UNAUTHORIZED_STATUS = 401;
const RENEW_BEFORE_MS = 60_000;

let session = null;

const postToRunner = (path, body, headers = {}) => fetch(`${RUNNER_URL}${path}`, { method: "POST", headers: { ...JSON_HEADERS, ...headers }, body: JSON.stringify(body) });

// The runner's nonce goes to the collector, which signs it only for a paired page; the signed ticket buys a runner token.
async function newSession() {
  const challenge = await postToRunner("/auth/challenge", {});
  if (!challenge.ok) return null;
  const { nonce } = await challenge.json();
  const ticket = await officeApi.runnerTicket(nonce);
  if (!ticket) return null;
  const opened = await postToRunner("/auth/session", { nonce, ticket });
  return opened.ok ? opened.json() : null;
}

async function tokenOf({ isRenewing = false } = {}) {
  if (isRenewing || !session || session.expiresAt - RENEW_BEFORE_MS <= Date.now()) session = await newSession();
  return session?.token ?? null;
}

// A runner restarted since the last call forgot its tokens; one retry with a fresh token covers that.
async function authorized(send) {
  const response = await send({ Authorization: `Bearer ${await tokenOf()}` });
  if (response.status !== UNAUTHORIZED_STATUS) return response;
  return send({ Authorization: `Bearer ${await tokenOf({ isRenewing: true })}` });
}

const post = (path, body = {}) => authorized((headers) => postToRunner(path, body, headers));

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
      const response = await authorized((headers) => fetch(`${RUNNER_URL}/sessions`, { cache: "no-store", headers }));
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
  // EventSource cannot send headers, so the token goes in the address of the stream, the one route that reads it there.
  watch(sessionId, { onSnapshot, onChange }) {
    let stream = null;
    let isClosed = false;
    tokenOf().then((token) => {
      if (isClosed || !token) return;
      stream = new EventSource(`${RUNNER_URL}/sessions/${sessionId}/stream?token=${encodeURIComponent(token)}`);
      stream.addEventListener("snapshot", (event) => onSnapshot(JSON.parse(event.data)));
      stream.addEventListener("change", (event) => onChange(JSON.parse(event.data)));
    }, () => {});
    return () => {
      isClosed = true;
      stream?.close();
    };
  },
};
