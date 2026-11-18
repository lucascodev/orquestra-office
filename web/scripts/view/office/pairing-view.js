import { phoneLinkOf } from "../../domain/office/phone-link.js";
import { esc } from "../shared/escape-html.js";
import { clockTime } from "../shared/format.js";
import { qrSvg } from "../shared/qr-svg.js";

const OPEN_COMMAND = "node hooks/open-office.mjs";
const INSTALL_COMMAND = "node hooks/install-claude-hooks.mjs";

const secretMissingNote = () => `<p>O coletor não achou o segredo do escritório. Rode <code class="mono">${INSTALL_COMMAND}</code> nesta máquina e reinicie o coletor (no Docker, <code class="mono">docker compose restart office</code>).</p>`;

const onThisMachine = () => `<p>Para abrir o escritório já pareado, rode no terminal desta máquina, na pasta do escritório:</p>
    <pre class="command mono">${OPEN_COMMAND}</pre>
    <p class="muted">Ele abre o navegador padrão. Se você usa outro navegador, copie o endereço que o comando mostra.</p>`;

const onAnotherDevice = () => `<p>Abra o escritório no computador, clique em <b>Aparelhos</b> e depois em <b>Parear aparelho</b>. Leia o QR com este aparelho ou abra o link que aparece lá.</p>`;

export function renderUnpaired({ isOnThisMachine, isSecretMissing }) {
  return `<div class="empty-state pairing-needed">
    <h2>Este navegador não está pareado</h2>
    ${isSecretMissing ? secretMissingNote() : ""}
    ${isOnThisMachine ? onThisMachine() : onAnotherDevice()}
  </div>`;
}

const PAIRING_FAILED = `<p class="pending-error" role="alert">Não deu para gerar um código agora. Espere os códigos abertos vencerem (2 minutos) e tente de novo.</p>`;

export function renderPairingCode(issued) {
  const link = issued ? phoneLinkOf(issued.urls ?? []) : null;
  if (!link) return PAIRING_FAILED;
  return `<div class="pairing-code">
    ${qrSvg(link, { label: "QR para parear outro aparelho" })}
    <p>Leia o QR com o outro aparelho ou abra este link nele:</p>
    <p class="pairing-link mono">${esc(link)}</p>
    <p class="muted">Vale até ${esc(clockTime(issued.expiresAt))} e uma vez só. O aparelho precisa estar na mesma rede.</p>
  </div>`;
}
