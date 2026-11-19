[English](SECURITY.md) | **Português (Brasil)**

# Política de segurança

O Orquestra Office roda na sua máquina e mexe em coisas sensíveis: grava na configuração do Claude Code e do Codex, recebe comandos e respostas das ferramentas, e decide pedidos de permissão em nome de quem usa. Este documento diz o que é suportado, como relatar uma falha e o que conta como falha.

## Versões suportadas

| Versão | Suportada |
|---|---|
| `main` | sim |
| qualquer outra branch, fork ou cópia antiga | não |

O projeto ainda não tem versão publicada. A correção de uma falha entra na `main`, e quem usa atualiza a pasta e roda de novo os comandos de instalação do [README](README.pt-BR.md#instalar).

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

A fase S do ADR 0002 está na `main`.

- **Segredo.** O instalador cria `~/.orquestra-office/secret`, legível só pelo dono no macOS e no Linux, e nunca o sobrescreve sem `--rotate-secret`. O coletor lê o mesmo arquivo, montado como `secret` do Compose no Docker. Girar o segredo invalida os aparelhos pareados, os tokens do executor e os hooks com a chave antiga.
- **Hooks.** Nenhum hook do escritório é do tipo `http`. A atividade vai pelo `curl` do sistema, sem shell, com um token de portador lido de um arquivo, que só vale nas rotas de atividade. Permissão, pergunta e fim do turno passam por `hooks/office-decision.mjs`, que assina o pedido com HMAC-SHA256 e só aceita resposta assinada com a mesma chave e ligada ao nonce do pedido. Sem essa resposta, o pedido vai para o terminal. O script nunca devolve `updatedPermissions`, `additionalContext` nem `interrupt`, e só devolve `updatedInput` para `AskUserQuestion`, montado com as perguntas que ele mesmo recebeu.
- **Hooks antigos.** Um pedido sem token ou sem assinatura recebe `200 {}`, não registra, segura nem entrega nada, e acende na página o aviso de hooks de uma versão antiga. Token ou assinatura errados recebem `401`.
- **Painel.** Todo `/api/*` exige o cookie de um aparelho pareado (`HttpOnly`, `SameSite=Strict`, `Path=/api`), também em `127.0.0.1`. O primeiro navegador é pareado por `node hooks/open-office.mjs`, que pede um desafio de uso único (30 segundos) e um código de uso único (2 minutos) com pedidos assinados. Os outros aparelhos são pareados por QR ou link de uso único, gerado num aparelho já pareado. O disco guarda só o hash do cookie, e só uma página pareada conta como espectador e segura pedidos.
- **Executor.** Todo pedido, menos `/health`, exige um token de 12 horas, que a página obtém trocando um desafio de uso único assinado pelo coletor.
- **Coletor.** Escuta só em `127.0.0.1` por padrão, e o `compose.yaml` publica a porta só nesse endereço. Confere `Host` contra DNS rebinding, recusa leitura e ação vindas de outro site (`Sec-Fetch-Site` e `Origin`) e ação sem `Origin`, impede que outra página enquadre o escritório (`frame-ancestors`), limita o tamanho do corpo e o número de espectadores.
- **Endereço.** Os hooks só aceitam um endereço desta máquina, e `localhost` vira `127.0.0.1`. O endereço fica gravado no comando de cada hook; nenhum deles lê `OFFICE_URL` durante a sessão. Endereço remoto exige `--allow-remote-office` e `https://`.
- **Instaladores.** Gravam de forma atômica, mexem só no que o escritório gravou e recusam uma pasta com caractere que o shell interpreta.

Limites conhecidos, registrados no ADR 0002:

- O coletor lembra os nonces só enquanto está de pé. Quem capturou um pedido assinado de `Stop`, permissão ou pergunta, ocupando a porta com o coletor parado, consegue repeti-lo depois: esvazia a fila de mensagens daquela sessão ou cria um pedido pendente falso, sem decidir nada em sessão nenhuma. O bootstrap do pareamento não tem esse problema, porque exige um desafio de uso único.
- No modo LAN, que é HTTP, quem escuta a rede consegue copiar o cookie de um aparelho pareado.
- Cookies não separam portas: outro servidor em `127.0.0.1` recebe o cookie em `/api`. É código local, fora do escopo abaixo.

Relatos sobre esses limites ajudam quando trazem um caminho que o ADR não descreve.

## Fora do escopo

- Código rodando como o mesmo usuário do sistema que lê ou edita arquivos de propósito. Ele já pode editar `~/.claude/settings.json` e se dar qualquer permissão, e o escritório não tem como impedir.
- Quem escuta o tráfego da rede local no modo LAN, que é HTTP. O README avisa para ligar o modo LAN só em rede confiável.
- Riscos que o README e o [guia de uso](docs/guia.md) já documentam como escolha de quem usa: modo LAN em rede não confiável, `--allow-remote-office` apontando para um servidor que você não controla, e o backup do `settings.json` com os mesmos tokens do original.
- Falhas no Claude Code, no Codex ou nas bibliotecas de `web/vendor` em si. Relate ao projeto de origem; se o jeito como o escritório usa a biblioteca abre a falha, aí é escopo.
- Os dados de exemplo do modo demo e da landing, que são fictícios e públicos.
- Negação de serviço que exige acesso local e só derruba o próprio escritório, sem afetar a sessão do Claude Code. Os hooks já seguem quando o coletor não responde.
- Relatório automático de ferramenta sem demonstração de impacto neste projeto.
