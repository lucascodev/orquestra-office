export function fakeClaudeLauncher() {
  const processes = [];
  const startProcess = ({ cwd, onEvent, onExit }) => {
    const fake = {
      cwd,
      sent: [],
      emit: onEvent,
      exit: onExit,
      send: (text) => { fake.sent.push(text); },
      interrupt: () => {},
      stop: () => onExit({ code: 0, error: "" }),
    };
    processes.push(fake);
    return fake;
  };
  return { startProcess, processes };
}
