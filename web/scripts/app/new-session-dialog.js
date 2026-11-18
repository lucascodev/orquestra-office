export function createNewSessionDialog({ dialog, control, onOpened }) {
  const form = dialog.querySelector("form");
  const error = dialog.querySelector('[role="alert"]');
  const submit = form.querySelector('[type="submit"]');

  function show(folder) {
    form.reset();
    form.elements.cwd.value = folder;
    error.hidden = true;
    dialog.showModal();
    (folder ? form.elements.prompt : form.elements.cwd).focus();
  }

  function setBusy(isBusy) {
    submit.disabled = isBusy;
    submit.setAttribute("aria-busy", String(isBusy));
  }

  dialog.querySelector("[data-cancel]").addEventListener("click", () => dialog.close());

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setBusy(true);
    const { session, error: message } = await control.openSession(form.elements.cwd.value.trim(), form.elements.prompt.value.trim());
    setBusy(false);
    if (!session) {
      error.textContent = message;
      error.hidden = false;
      return;
    }
    dialog.close();
    onOpened(session);
  });

  return { show };
}
