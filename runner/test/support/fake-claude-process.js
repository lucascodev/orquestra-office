import { stdoutChanges } from "../../src/claude/stdout-changes.js";

const CLEAN_EXIT = Object.freeze({ code: 0, error: "" });

// Like Claude Code, it prints stream-json on stdout and, given a sessionId, announces it on the first message.
export function fakeClaudeLauncher({ sessionId = null } = {}) {
  const processes = [];
  const startProcess = ({ cwd, onChange, onExit }) => {
    const stdout = stdoutChanges(onChange);
    const fake = {
      cwd,
      sent: [],
      interrupts: 0,
      printEvent: (event) => stdout(`${JSON.stringify(event)}\n`),
      exit: onExit,
      send: (text) => {
        fake.sent.push(text);
        if (sessionId) fake.printEvent({ type: "system", subtype: "init", session_id: sessionId });
      },
      interrupt: () => { fake.interrupts += 1; },
      stop: () => onExit(CLEAN_EXIT),
    };
    processes.push(fake);
    return fake;
  };
  return { startProcess, processes };
}
