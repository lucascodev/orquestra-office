import { renderDevices } from "../view/office/devices-view.js";
import { renderPairingCode } from "../view/office/pairing-view.js";

export function createDevicesDialog({ dialog, control }) {
  const list = dialog.querySelector("[data-devices]");
  const pairing = dialog.querySelector("[data-pairing-code]");
  const pairButton = dialog.querySelector("[data-pair]");

  async function refresh() {
    list.innerHTML = renderDevices(await control.listDevices());
  }

  async function show() {
    pairing.hidden = true;
    pairing.innerHTML = "";
    dialog.showModal();
    await refresh();
  }

  dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());

  pairButton.addEventListener("click", async () => {
    pairButton.disabled = true;
    pairing.innerHTML = renderPairingCode(await control.pairDevice());
    pairing.hidden = false;
    pairButton.disabled = false;
  });

  list.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-revoke]");
    if (!button) return;
    button.disabled = true;
    await control.revokeDevice(button.dataset.revoke);
    await refresh();
  });

  return { show };
}
