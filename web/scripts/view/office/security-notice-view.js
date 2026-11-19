const INSTALL_COMMAND = "node hooks/install-claude-hooks.mjs";

export function renderSecurityNotice(security) {
  if (security?.isSecretMissing) {
    return `<p class="notice" role="status">O coletor não achou o segredo do escritório: as decisões voltam para o terminal. Rode <code class="mono">${INSTALL_COMMAND}</code> e reinicie o coletor.</p>`;
  }
  if (security?.legacyHooksSeenAt) {
    return `<p class="notice" role="status">Há hooks de uma versão antiga neste computador, e o escritório ignora o que eles mandam. Rode <code class="mono">${INSTALL_COMMAND}</code> (e <code class="mono">node hooks/install-codex-notify.mjs</code>, se usa o Codex).</p>`;
  }
  return "";
}
