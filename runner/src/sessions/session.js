import { randomUUID } from "node:crypto";

const ENTRY_LIMIT = 400;

export function createSession({ cwd, startProcess, now = Date.now }) {
  const state = { id: randomUUID(), sessionId: null, cwd, status: "starting", startedAt: now(), endedAt: null, entries: [], partial: "" };
  const listeners = new Set();
  const sessionWaiters = new Set();

  const emit = (change) => listeners.forEach((listener) => listener(change));
  const isEnded = () => state.status === "ended";

  function addEntry(entry) {
    const stamped = { at: now(), ...entry };
    state.entries = [...state.entries, stamped].slice(-ENTRY_LIMIT);
    state.partial = "";
    emit({ type: "entry", entry: stamped });
  }

  function setStatus(status) {
    if (state.status === status || isEnded()) return;
    state.status = status;
    emit({ type: "status", status });
  }

  function learnSessionId(sessionId) {
    if (state.sessionId === sessionId) return;
    state.sessionId = sessionId;
    emit({ type: "session", sessionId });
    sessionWaiters.forEach((resolve) => resolve(sessionId));
    sessionWaiters.clear();
  }

  function apply(change) {
    if (change.type === "entry") addEntry(change.entry);
    else if (change.type === "status") setStatus(change.status);
    else if (change.type === "session") learnSessionId(change.sessionId);
    else if (change.type === "delta") {
      state.partial += change.text;
      emit(change);
    }
  }

  function end({ code, error }) {
    if (error) addEntry({ kind: "error", text: "a sessão caiu", detail: error });
    else addEntry({ kind: "note", text: code === 0 ? "sessão encerrada" : `sessão encerrada (código ${code})`, detail: "" });
    state.status = "ended";
    state.endedAt = now();
    emit({ type: "status", status: "ended" });
    sessionWaiters.forEach((resolve) => resolve(state.sessionId));
    sessionWaiters.clear();
  }

  const process = startProcess({ cwd, onChange: apply, onExit: end });

  function send(text) {
    if (isEnded()) return false;
    addEntry({ kind: "prompt", text, detail: "" });
    setStatus("working");
    process.send(text);
    return true;
  }

  function sessionIdWithin(timeoutMs) {
    if (state.sessionId || isEnded()) return Promise.resolve(state.sessionId);
    return new Promise((resolve) => {
      const timer = setTimeout(() => { sessionWaiters.delete(resolve); resolve(state.sessionId); }, timeoutMs);
      timer.unref?.();
      sessionWaiters.add((sessionId) => { clearTimeout(timer); resolve(sessionId); });
    });
  }

  return {
    id: state.id,
    send,
    interrupt: () => { if (!isEnded()) process.interrupt(); return !isEnded(); },
    stop: () => { if (!isEnded()) process.stop(); return true; },
    sessionIdWithin,
    summary: () => ({ id: state.id, sessionId: state.sessionId, cwd: state.cwd, status: state.status, startedAt: state.startedAt, endedAt: state.endedAt }),
    transcript: () => ({ entries: state.entries, partial: state.partial }),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
