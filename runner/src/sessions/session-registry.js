import { statSync } from "node:fs";
import { createSession } from "./session.js";

const MAX_OPEN_SESSIONS = 8;
const ENDED_SESSION_TTL_MS = 10 * 60_000;
const PROMPT_LIMIT = 8_000;

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function createSessionRegistry({ startProcess, now = Date.now }) {
  const sessions = new Map();

  function forgetOldSessions() {
    for (const [id, session] of sessions) {
      const { endedAt } = session.summary();
      if (endedAt && now() - endedAt > ENDED_SESSION_TTL_MS) sessions.delete(id);
    }
  }

  const openCount = () => [...sessions.values()].filter((session) => session.summary().status !== "ended").length;

  function open({ cwd, prompt }) {
    const folder = typeof cwd === "string" ? cwd.trim() : "";
    const firstMessage = typeof prompt === "string" ? prompt.trim().slice(0, PROMPT_LIMIT) : "";
    if (!folder || !isDirectory(folder)) return { error: "Essa pasta não existe nesta máquina." };
    if (!firstMessage) return { error: "Escreva a primeira mensagem para o agente." };
    if (openCount() >= MAX_OPEN_SESSIONS) return { error: `Já existem ${MAX_OPEN_SESSIONS} sessões abertas pelo escritório. Encerre uma antes.` };
    const session = createSession({ cwd: folder, startProcess, now });
    sessions.set(session.id, session);
    session.send(firstMessage);
    return { session };
  }

  return {
    open,
    get: (id) => sessions.get(id) ?? null,
    list: () => {
      forgetOldSessions();
      return [...sessions.values()].map((session) => session.summary());
    },
    stopAll: () => sessions.forEach((session) => session.stop()),
  };
}
