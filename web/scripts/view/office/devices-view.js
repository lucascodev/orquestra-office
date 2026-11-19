import { esc } from "../shared/escape-html.js";
import { ago } from "../shared/format.js";

function deviceRow(device) {
  const revokeLabel = device.isCurrent ? "Sair deste" : "Revogar";
  return `<li class="device">
    <div class="device-id">
      <span class="device-name"><b>${esc(device.label || "Navegador")}</b>${device.isCurrent ? ` <span class="badge">este aparelho</span>` : ""}</span>
      <span class="muted mono">${esc(device.host)} · usado ${esc(ago(device.lastSeenAt))}</span>
    </div>
    <button class="btn btn-sm btn-secondary" type="button" data-revoke="${esc(device.id)}"${device.isCurrent ? " data-is-current" : ""}>${revokeLabel}</button>
  </li>`;
}

export function renderDevices(devices) {
  if (devices === null) return `<p class="pending-error" role="alert">Não deu para carregar os aparelhos.</p>`;
  return `<ul class="devices">${devices.map(deviceRow).join("")}</ul>`;
}
