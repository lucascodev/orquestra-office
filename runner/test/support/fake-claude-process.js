export function fakeClaudeLauncher() {
  const processes = [];
  const startProcess = ({ cwd, onChange, onExit }) => {
    const fake = {
      cwd,
      sent: [],
      emit: onChange,
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
