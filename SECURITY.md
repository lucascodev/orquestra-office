# Política de segurança

> **English.** Only the `main` branch is supported; there are no released versions yet. Report vulnerabilities privately through GitHub: open the **Security** tab of this repository and click **Report a vulnerability** ([direct link](https://github.com/lucascodev/orquestra-office/security/advisories/new)). Do not open a public issue. In scope: the hook installers that write to your Claude Code and Codex configuration, the collector on port 8420, permission decisions, device pairing and the hook authentication design, and the runner on `127.0.0.1:8421`. The threat model is summarized below and detailed in [ADR 0002](docs/adr/0002-autenticacao-hooks-e-painel.md).

O Orquestra Office roda na sua máquina e mexe em coisas sensíveis: grava na configuração do Claude Code e do Codex, recebe comandos e respostas das ferramentas, e decide pedidos de permissão em nome de quem usa. Este documento diz o que é suportado, como relatar uma falha e o que conta como falha.

## Versões suportadas

| Versão | Suportada |
|---|---|
| `main` | sim |
| qualquer outra branch, fork ou cópia antiga | não |

O projeto ainda não tem versão publicada. A correção de uma falha entra na `main`, e quem usa atualiza a pasta e roda de novo os comandos de instalação do [README](README.md).

## Como relatar

Use o relato privado de vulnerabilidade do GitHub:

1. Abra a aba **Security** do repositório [lucascodev/orquestra-office](https://github.com/lucascodev/orquestra-office).
2. Clique em **Report a vulnerability** ([link direto](https://github.com/lucascodev/orquestra-office/security/advisories/new)).
3. Preencha o relato. Ele fica visível só para você e para o mantenedor.

Não abra issue pública, pull request nem comentário sobre uma falha que ainda não foi corrigida. O projeto não tem canal de e-mail.

Ajuda muito trazer:

- o componente afetado (hooks, coletor, executor, página) e o commit da `main` que você testou;
- sistema operacional, versão do Node e se o coletor roda no Docker ou direto pelo Node;
- os passos para reproduzir, de preferência com um comando ou script mínimo;
- o impacto: o que quem ataca precisa ter (outra página no navegador, um aparelho na rede, outro usuário da máquina) e o que consegue fazer.

Não mande segredo real, conteúdo do seu `settings.json` nem texto de sessões no relato. Dados fictícios bastam para reproduzir.

### O que esperar

O projeto é mantido por uma pessoa, então não há prazo garantido. A meta é confirmar o recebimento em até 7 dias e combinar com você, no próprio relato, a correção e a data de divulgação. Quando a correção entra na `main`, o aviso de segurança é publicado no repositório, com crédito a quem relatou, se você quiser.

## Escopo

Contam como falha de segurança, entre outras:

- **Hooks e instaladores** (`hooks/`). Os instaladores gravam no `settings.json` do Claude Code e no `config.toml` do Codex, fazem backup e anotam o que gravaram em `orquestra-office.json`. Exemplos: o instalador apagar ou alterar um hook que não é do escritório, gravar um comando que o shell interpreta, expor o backup (que pode ter tokens do `env`) a outro usuário, ou um hook gravado executar algo plantado no repositório aberto.
- **Coletor** (porta 8420). Recebe os eventos dos hooks, guarda o estado e serve a página e a API. Exemplos: outra página aberta no navegador ler ou alterar o estado, um dado que deveria ficar só na memória ir para o disco, um corpo de requisição derrubar o processo, ou o coletor ficar acessível fora de `127.0.0.1` sem o modo LAN ligado.
- **Decisões de permissão.** O coletor segura pedidos de permissão, perguntas do agente e mensagens que entram no fim do turno. Exemplos: aprovar um pedido sem ser quem usa o escritório, reescrever o comando que o agente pediu, gravar regra de permissão ou trocar o modo de permissão do Claude Code, ou injetar texto com o rótulo de mensagem do usuário.
- **Pareamento e autenticação dos hooks**, como desenhados no [ADR 0002](docs/adr/0002-autenticacao-hooks-e-painel.md): assinatura HMAC entre hooks e coletor, cookie de aparelho pareado em `/api/*`, códigos de pareamento de uso único e rotação do segredo. Falha no desenho também conta.
- **Executor** (`127.0.0.1:8421`). Abre sessões do Claude Code em modo de fluxo. Exemplos: um processo ou página que não é o escritório abrir sessão, mandar mensagem, interromper ou encerrar uma sessão.
- **Uso das bibliotecas copiadas em `web/vendor`** de um jeito que abra uma falha, por exemplo HTML de uma resposta do agente que chega à página sem passar pelo DOMPurify.

## Modelo de ameaça

Resumo da seção 1.4 do [ADR 0002](docs/adr/0002-autenticacao-hooks-e-painel.md). O princípio: **o escritório não pode dar a ninguém, nem ao próprio agente, um poder que o Claude Code ainda não deu.**

Quem está no modelo:

1. outra página aberta no navegador;
2. outro aparelho na rede local;
3. outro usuário do sistema, ou um processo dele, inclusive ocupando a porta 8420 com o coletor parado;
4. o caminho de rede até um `OFFICE_URL` remoto;
5. o próprio agente usando um comando já liberado (por exemplo `curl`) para conseguir um poder que o Claude Code não deu a ele, como aprovar os próprios pedidos.

### Situação na `main`

- O coletor escuta só em `127.0.0.1` por padrão, e o `compose.yaml` publica a porta só nesse endereço.
- O coletor confere `Host` contra DNS rebinding, recusa leitura e ação vindas de outro site (`Sec-Fetch-Site` e `Origin`), impede que outra página enquadre o escritório (`frame-ancestors`), limita o tamanho do corpo e o número de espectadores.
- Os hooks só aceitam um `OFFICE_URL` desta máquina. Endereço remoto exige `--allow-remote-office` e `https://`.
- Os instaladores gravam de forma atômica, mexem só no que o escritório gravou e recusam uma pasta com caractere que o shell interpreta.

O ADR 0002 registra, na seção 1.3, os limites que continuam na `main`: os hooks de decisão são do tipo `http`, então quem responder em `127.0.0.1:8420` decide por eles, e o modo LAN não tem senha. A correção (hooks `command` com assinatura HMAC, pareamento por cookie e token do executor) está decidida nesse ADR e ainda não entrou na `main`. Relatos sobre esses achados ajudam quando trazem um caminho que o ADR não descreve.

## Fora do escopo

- Código rodando como o mesmo usuário do sistema que lê ou edita arquivos de propósito. Ele já pode editar `~/.claude/settings.json` e se dar qualquer permissão, e o escritório não tem como impedir.
- Quem escuta o tráfego da rede local no modo LAN, que é HTTP. O README avisa para ligar o modo LAN só em rede confiável.
- Riscos que o README já documenta como escolha de quem usa: modo LAN em rede não confiável, `--allow-remote-office` apontando para um servidor que você não controla, e o backup do `settings.json` com os mesmos tokens do original.
- Falhas no Claude Code, no Codex ou nas bibliotecas de `web/vendor` em si. Relate ao projeto de origem; se o jeito como o escritório usa a biblioteca abre a falha, aí é escopo.
- Os dados de exemplo do modo demo e da landing, que são fictícios e públicos.
- Negação de serviço que exige acesso local e só derruba o próprio escritório, sem afetar a sessão do Claude Code. Os hooks já seguem quando o coletor não responde.
- Relatório automático de ferramenta sem demonstração de impacto neste projeto.
