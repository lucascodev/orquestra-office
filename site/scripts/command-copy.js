const FEEDBACK_MS = 2_000;
const ANNOUNCE_DELAY_MS = 50;
const COMMAND_SEPARATOR = "\n";
const ACTIVE_PANEL = '[role="tabpanel"]:not([hidden])';

export function setupCommandCopy(section, clipboard = navigator.clipboard) {
  const button = section.querySelector("[data-copy-commands]");
  const label = button.querySelector("[data-copy-label]");
  const status = section.querySelector("[data-copy-status]");
  const idleLabel = label.textContent;
  let resetTimer = 0;

  const commandsIn = (panel) => [...panel.querySelectorAll("[data-command]")];

  function announce(message) {
    status.textContent = "";
    setTimeout(() => { status.textContent = message; }, ANNOUNCE_DELAY_MS);
  }

  function showResult(state, visibleLabel, message) {
    clearTimeout(resetTimer);
    button.dataset.copyState = state;
    label.textContent = visibleLabel;
    announce(message);
    resetTimer = setTimeout(() => {
      delete button.dataset.copyState;
      label.textContent = idleLabel;
    }, FEEDBACK_MS);
  }

  function selectForManualCopy(commands) {
    const range = document.createRange();
    range.setStartBefore(commands[0]);
    range.setEndAfter(commands.at(-1));
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  async function copyActiveCommands() {
    const commands = commandsIn(section.querySelector(ACTIVE_PANEL));
    try {
      await clipboard.writeText(commands.map((command) => command.textContent).join(COMMAND_SEPARATOR));
      showResult("done", button.dataset.doneLabel, button.dataset.doneStatus);
    } catch {
      selectForManualCopy(commands);
      showResult("failed", idleLabel, button.dataset.failedStatus);
    }
  }

  button.addEventListener("click", copyActiveCommands);
  button.hidden = false;
}
