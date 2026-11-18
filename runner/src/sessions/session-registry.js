import { toMessageText } from "./message-text.js";
import { createSession } from "./session.js";

const MAX_OPEN_SESSIONS = 8;
const ENDED_SESSION_TTL_MS = 10 * 60_000;

export function createSessionRegistry({ startProcess, isDirectory, now = Date.now }) {
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
    const firstMessage = toMessageText(prompt);
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
