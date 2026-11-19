import { ownValueOf } from "../../domain/shared/own-value.js";
import { esc } from "../shared/escape-html.js";

const CONNECTIONS = {
  connecting: { tone: "pending", text: "conectando" },
  live: { tone: "live", text: "ao vivo" },
  offline: { tone: "off", text: "sem conexão com o coletor" },
  demo: { tone: "demo", text: "demonstração", detail: "Dados de exemplo: nada aqui vem de agentes reais." },
};

export function renderConnection(mode) {
  const { tone, text, detail } = ownValueOf(CONNECTIONS, mode) ?? CONNECTIONS.connecting;
  const explained = detail ? `<span class="sr-only">. ${esc(detail)}</span>` : "";
  return `<i class="hq-dot" data-tone="${esc(tone)}" aria-hidden="true"></i><span title="${esc(detail ?? text)}">${esc(text)}</span>${explained}`;
}
