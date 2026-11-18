# ADR 0002: Autenticação entre hooks e coletor, e pareamento do painel

- Status: Aceito em 18/11/2026 (respostas do usuário na seção "Decisões do usuário")
- Data: 2026-11-18
- Origem: pendência da fase 4 em `docs/arquitetura/plano-de-refatoracao.md` (seção 15) e achados A e B da revisão de segurança
- Relacionados: ADR 0001 (item 6, caminhos fixos dos hooks); plano, seção 11.2 (fase 7); `docs/arquitetura/fase-6-sede.md` (passo 6.6 e numeração dos ADRs)

## Resumo da decisão

1. Nenhum hook do escritório continua do tipo `http`. A resposta de um hook HTTP vale como saída do hook, e quem estiver escutando em `127.0.0.1:8420` decide por ele.
2. Os eventos de atividade viram hooks `command` com `async: true`, em forma exec (`args`, sem shell), chamando o `curl` do sistema com a saída descartada no dispositivo nulo e um token de portador lido de um arquivo. O token só vale nas rotas de atividade.
3. As três decisões (`PermissionRequest`, `PreToolUse` de `AskUserQuestion` e `Stop`, que entrega as mensagens da fila) passam por um script Node único, `hooks/office-decision.mjs`. Ele assina o pedido com HMAC-SHA256, aceita só resposta assinada com a mesma chave e ligada ao nonce do pedido, e monta sozinho a saída para o Claude Code a partir de um contrato mínimo. `updatedPermissions`, `additionalContext` e `interrupt` nunca saem do script, e `updatedInput` só sai para `AskUserQuestion`, reconstruído com as perguntas que o próprio script recebeu.
4. Um segredo por usuário do sistema, gerado pelo instalador em `~/.orquestra-office/secret`, com permissão restrita ao dono. O coletor lê o mesmo arquivo: direto na CLI da fase 7 e como `secret` do Compose no Docker. Girar o segredo revoga tudo.
5. Todo `/api/*` exige um cookie de aparelho pareado (`HttpOnly; SameSite=Strict`), também em `localhost`. O primeiro navegador é pareado por um comando que abre o escritório já pareado; os outros aparelhos são pareados por QR ou link de uso único, gerado num aparelho já pareado.
6. O executor (`127.0.0.1:8421`) passa a exigir um token próprio, obtido pela página com um desafio que o coletor assina.
7. Migração sem período de transição: pedidos sem assinatura recebem `200 {}`, não decidem nada e acendem um aviso de "hooks antigos" na página.
8. Implementação numa fase própria, a fase S, depois da fase 4 e antes da fase 5, porque a fase 6 mexe no mesmo instalador e no mesmo alerta de aprovação.

## 1. Contexto

### 1.1 O que existe hoje

Lido em `hooks/lib/claude-settings.mjs`, `collector/src/http/*.js`, `collector/src/claude/hook-responses.js`, `hooks/lib/codex-config.mjs` e `runner/src/http/*.js`.

| Entrada no `settings.json` | Tipo | Rota | O que a resposta faz |
|---|---|---|---|
| `SessionStart` | `command` (`node office-session-start.mjs`, 5 s) | `/events/claude` | nada: o script ignora a resposta e não imprime |
| `UserPromptSubmit`, `PreToolUse` sem `matcher`, `PostToolUse`, `PostToolUseFailure`, `Notification`, `StopFailure`, `SubagentStart`, `SubagentStop`, `SessionEnd` | `http`, 3 s, `onFailure: "continue"` | `/events/claude` | o coletor devolve `{}` |
| `Stop` | `http`, 3 s | `/hooks/claude/stop` | `decision: "block"` com as mensagens da fila, apresentadas ao modelo como "Mensagem do usuário" |
| `PermissionRequest` | `http`, 150 s | `/hooks/claude/permission` | `decision.behavior` allow ou deny |
| `PreToolUse` com `matcher: "AskUserQuestion"` | `http`, 150 s | `/hooks/claude/question` | `permissionDecision: "allow"` com `updatedInput` |
| `statusLine` | `command` (`node office-statusline.mjs`) | `/events/statusline` | nada |
| `notify` do Codex | `curl` com argv | `/events/codex` | nada |

Correção ao que circulava: são 12 entradas `http` e 1 `command`. Das 12, 9 são só atividade; o `Stop` também decide, porque entrega mensagens ao agente. São três decisões, não duas.

No painel, a guarda de `Host` (contra DNS rebinding) vale para tudo. Os POSTs de `/api/*` passam por `isSameOrigin`, que aceita pedido sem `Origin`. Os GETs passam por `Sec-Fetch-Site` ou, sem ele, por `Origin`. Qualquer conexão em `/api/stream` conta como espectador e faz o coletor segurar pedidos. O executor aceita pedido com `Host` local e `Origin` da lista ou sem `Origin`.

### 1.2 O que a documentação oficial garante

Fonte: [Hooks reference](https://code.claude.com/docs/en/hooks), lida em 18/11/2026.

- **HTTP.** "2xx with a JSON object body: parsed using the same JSON output schema as command hooks." Resposta 2xx vazia equivale a sair com 0 sem saída. Não há `async` para hooks HTTP. Há `headers` com variáveis de ambiente, só as listadas em `allowedEnvVars`.
- **`PermissionRequest`.** `updatedInput` "Replaces the entire input object". `updatedPermissions` aceita entradas como `setMode` (inclusive `bypassPermissions`) e `replaceRules`, com `destination: "userSettings"`, que grava em `~/.claude/settings.json`. Ou seja, uma resposta falsa pode deixar a máquina em modo sem permissão de forma permanente.
- **`PreToolUse`.** `permissionDecision: "allow"` pula o prompt; `updatedInput` troca a entrada; `additionalContext` entra no contexto do modelo.
- **`Stop`.** `decision: "block"` com `reason` faz o agente continuar seguindo o texto.
- **`async`.** "This field is only available on `type: "command"` hooks." Não bloqueia nem decide, e o `timeout` não é aplicado. Porém: "After the background process exits, Claude Code delivers the `additionalContext` and `systemMessage` fields from the hook's JSON response to Claude on the next conversation turn." Portanto `async` sozinho não basta: o comando precisa não imprimir nada. Em `-p` (sessões do executor), hooks `async` ainda rodando são mortos no encerramento. Cada execução cria um processo.
- **Forma exec.** Com `args`, o comando é executado direto, sem shell, em todas as plataformas. Sem `args`, o Windows usa o Git Bash, o que soma um processo por evento. No Windows, o executável precisa ser real (`node.exe` e `curl.exe` servem). O campo existe desde a v2.1.139, segundo relatos de terceiros; o instalador atual já exige a v2.1.295 por causa do `onFailure`.
- **`onFailure`.** Exige v2.1.295. Não tem efeito em `Stop` nem em hooks `async`.
- **Entrada.** Não há carimbo de tempo nos campos comuns. `PreToolUse` e `PostToolUse` trazem `tool_use_id`, e `PostToolUse` "fires concurrently when Claude makes parallel tool calls".

### 1.3 Achados

| Id | Achado | Gravidade |
|---|---|---|
| A | Quem responder em `127.0.0.1:8420` (porta livre com o container parado, outro usuário do sistema, `OFFICE_URL` remoto) decide permissões, reescreve comandos, persiste regras e injeta contexto. Confirmado | Médio; Alto com `OFFICE_URL` remoto |
| B | No modo LAN, um `curl` sem `Origin` lê `/api/state` (com os ids pendentes), aprova `POST /api/decisions/<id>` e manda mensagem ao agente. Confirmado | Alto no modo LAN |
| A2 | O `Stop` está no grupo de A: uma resposta falsa injeta instruções com o rótulo "Mensagem do usuário" | Alto, junto com A |
| A3 | `updatedPermissions` com `destination: "userSettings"` faz o efeito de A sobreviver ao atacante | agrava A |
| B2 | No Docker, o coletor não distingue a máquina da rede: a porta publicada chega pelo gateway do Docker e o `Host` vem do cliente. Uma regra "localhost não precisa de senha" cai com `curl -H "Host: localhost"` | invalida a saída "só a LAN pede senha" sem mudança de porta |
| B3 | O próprio agente, com `Bash(curl:*)` liberado (comum), aprova os próprios pedidos: de um subagente, de outra sessão ou de um processo em segundo plano criado antes | Médio; contorna o sistema de permissões do Claude Code |
| B4 | No modo LAN, as rotas de hook também ficam na rede: `POST /hooks/claude/stop` esvazia e lê a fila de mensagens; `/events/*` cria atividade falsa | Médio |
| B5 | O executor aceita pedido sem `Origin`: qualquer processo local abre sessão do Claude Code em qualquer pasta, manda mensagem, interrompe | Médio em máquina com mais de um usuário; Baixo em máquina pessoal |

### 1.4 Modelo de ameaça

Dentro do escopo:

1. outra página aberta no navegador (já coberto: `Host`, `Origin`, `Sec-Fetch-Site`, `frame-ancestors`);
2. outro aparelho na rede local;
3. outro usuário do sistema, ou processo dele, inclusive ocupando a porta 8420;
4. o caminho de rede até um `OFFICE_URL` remoto;
5. o próprio agente usando, com um comando já liberado, um poder que o Claude Code não deu a ele.

Fora do escopo: código rodando como o mesmo usuário que lê arquivos de propósito. Ele já consegue editar `~/.claude/settings.json` e se dar qualquer permissão, então o escritório não tem como protegê-lo. Também fica fora quem escuta o tráfego da rede local, porque o modo LAN é HTTP (seção 8).

Princípio que orienta as escolhas: **o escritório não pode dar a ninguém, nem ao próprio agente, um poder que o Claude Code ainda não deu.**

### 1.5 Restrições

- O coletor roda no Docker (porta publicada) e, na fase 7, direto via `npx` em `127.0.0.1`.
- Zero dependência npm, Node 22 ou mais novo, página sem build.
- `?modo=demo` não faz nenhuma requisição à API (passo 3.10) e precisa continuar assim.
- Quem usa sozinho em `localhost` não deve ganhar passo de login, o máximo possível.
- `hooks/office-session-start.mjs` e `hooks/office-statusline.mjs` não mudam de nome nem de lugar (ADR 0001, item 6).

## 2. Hooks de atividade

### 2.1 Opções

| Opção | Como | Segurança | Custo por evento | Contras |
|---|---|---|---|---|
| A1. Manter `http` | como hoje, talvez com cabeçalho de token via `allowedEnvVars` | não resolve A: a resposta continua valendo como saída do hook | síncrono, poucos ms no caminho de cada ferramenta | o token precisaria estar no ambiente da sessão, que o agente lê com `env` |
| A2. `command` `async` com `node` | `node hooks/office-event.mjs` em forma exec, assina com HMAC e não imprime nada | resolve A | fora do caminho da ferramenta; estimativa no Windows: 50 a 150 ms de relógio, 40 a 80 ms de CPU e 35 a 45 MB por processo | um processo Node por evento (dois por chamada de ferramenta) |
| **A3. `command` `async` com `curl` (recomendada)** | `curl.exe` (ou `/usr/bin/curl`) em forma exec, `-o NUL` ou `-o /dev/null`, `-H @<arquivo de cabeçalho>`, `--data-binary @-` | resolve A: a saída do `curl` vai para o nulo e não há o que o Claude Code ler | fora do caminho; estimativa: 10 a 30 ms e 5 a 10 MB por processo | depende do `curl` do sistema; segundo tipo de credencial (portador) só para atividade |
| A4. `command` síncrono | qualquer um dos dois sem `async` | resolve A | soma o processo inteiro a cada `PreToolUse` e `PostToolUse` | deixa as ferramentas mais lentas que hoje |

Os números de A2 e A3 são estimativas: esta etapa não tinha terminal. O passo S.0 mede antes de qualquer código (seção 6).

Com três sessões em paralelo fazendo 20 chamadas de ferramenta por minuto cada, são cerca de 120 processos por minuto. Pelas estimativas, A2 gasta de 5 a 10 s de CPU por minuto (perto de 10 % de um núcleo, mais a varredura do antivírus a cada `node.exe`), e A3 gasta de 1 a 3 s. A forma exec é obrigatória nas duas: em forma shell, o Windows soma um Git Bash a cada evento.

### 2.2 Recomendação: A3

- Eventos: `UserPromptSubmit`, `PreToolUse` sem `matcher`, `PostToolUse`, `PostToolUseFailure`, `Notification`, `StopFailure`, `SubagentStart` e `SubagentStop` com `async: true`.
- `SessionEnd` fica síncrono, com `timeout` de 1,5 s: em `-p` o Claude Code mata hooks `async` no encerramento, e as sessões do executor perderiam a saída.
- O instalador grava o caminho absoluto do `curl` encontrado na instalação (`C:\Windows\System32\curl.exe` no Windows 10 1803 ou mais novo, `/usr/bin/curl` no macOS) e o dispositivo nulo da plataforma. Sem `curl`, o instalador para com uma mensagem clara.
- O token vai num arquivo de cabeçalho (`-H @arquivo`, `curl` 7.55 ou mais novo), nunca no argv: no macOS e no Linux, o `ps` mostra o argv a todos os usuários.
- O token de atividade é derivado do segredo (`HMAC(K, "orquestra-office/activity-token/v1")`) e só vale em `/events/claude`, `/events/statusline` e `/events/codex`. Se um processo que ocupou a porta o capturar, ele só consegue forjar atividade, nunca decisão.
- `office-session-start.mjs` e `office-statusline.mjs` continuam como estão (Node, caminho fixo) e passam a mandar o mesmo token. Eles já ignoram a resposta.
- O `notify` do Codex continua `curl` e ganha `-H @arquivo` e `-o` nulo.

Exemplo de entrada gravada no Windows:

```json
{
  "type": "command",
  "command": "C:\\Windows\\System32\\curl.exe",
  "args": ["-s", "-m", "3", "-o", "NUL", "-H", "@C:\\Users\\<usuario>\\.orquestra-office\\activity.header", "-H", "Content-Type: application/json", "--data-binary", "@-", "http://127.0.0.1:8420/events/claude"],
  "async": true
}
```

**Ordem dos eventos.** Com `async`, cada evento vira um processo e eles podem chegar fora de ordem. O caso real é o `PostToolUse` de uma ferramenta rápida chegar antes do `PreToolUse`, deixando o boneco "lendo" depois que a leitura acabou. O coletor passa a ignorar um `PreToolUse` cujo `tool_use_id` já teve `PostToolUse` ou `PostToolUseFailure` aplicado. Entre o último `PostToolUse` e o `Stop` (síncrono) sempre há uma ida ao modelo, então a ordem por chegada basta ali. Um `PostToolUse` que chegue depois do `Stop` não volta o status para "trabalhando": vale a mesma regra, pela marca de turno encerrado.

Plano B: se o S.0 mostrar que a forma exec com `curl` falha no Windows (há relatos de `args` ignorados em versões antigas), A2 com o mesmo protocolo HMAC das decisões.

## 3. Decisões: permissão, pergunta e mensagens no fim do turno

### 3.1 Opções

| Opção | Autentica o coletor para o hook? | Autentica o hook para o coletor? | Funciona no Docker? | Observação |
|---|---|---|---|---|
| **D1. HMAC-SHA256 com segredo compartilhado, nos dois sentidos (recomendada)** | sim: resposta assinada e presa ao nonce do pedido | sim | sim | `node:crypto`, sem dependência; sem relógio |
| D2. Token no cabeçalho e no corpo | não: quem ocupa a porta recebe o token e responde o que quiser | sim, até o token vazar para quem ocupou a porta | sim | é o item (3) da revisão; serve para atividade, não para decisão |
| D3. Socket Unix ou pipe nomeado com permissão de arquivo | sim no POSIX (pasta 0700); no Windows o primeiro a criar o pipe fica com o nome | pela permissão do arquivo | não: o Docker Desktop não liga um socket do Windows a um container Linux | exige `command` de qualquer jeito; só serviria à CLI |
| D4. HTTPS com certificado fixado | sim | só com token por cima | sim | o Node não gera certificado X.509 sem `openssl` ou um codificador ASN.1 próprio |
| D5. Assinatura Ed25519 (privada no coletor, pública no hook) | sim | precisa de outro segredo | sim | separa quem assina de quem verifica, mas o ganho é contra código do mesmo usuário, fora do escopo |
| D6. Hook `mcp_tool` com um servidor MCP do escritório | o servidor MCP é iniciado pelo Claude Code, então é confiável | o problema reaparece entre o MCP e o coletor | sim | mais uma peça para o mesmo resultado de D1 |

### 3.2 Recomendação: D1

Um script, `hooks/office-decision.mjs`, gravado em forma exec (`"command": "node"`, `"args": ["<hooks>/office-decision.mjs"]`) nas três entradas: `PermissionRequest` (`timeout` 150 s, `onFailure: "continue"`, `statusMessage` atual), `PreToolUse` com `matcher: "AskUserQuestion"` (idem) e `Stop` (`timeout` 5 s). O caminho entra na lista de caminhos fixos do ADR 0001.

**Protocolo de pedido assinado (v1).** Vale para as decisões e para o pareamento inicial (seção 4.3).

| Peça | Valor |
|---|---|
| Chave | `K`: 32 bytes aleatórios, em base64url, no arquivo do segredo |
| Nonce | 16 bytes aleatórios por pedido, base64url, no cabeçalho `X-Office-Nonce` |
| Assinatura do pedido | cabeçalho `X-Office-Signature: v1=<base64url(HMAC-SHA256(K, "orquestra-office/request/v1\n" + caminho + "\n" + nonce + "\n" + sha256hex(corpo)))>` |
| Assinatura da resposta | mesmo cabeçalho na resposta: `HMAC-SHA256(K, "orquestra-office/response/v1\n" + caminho + "\n" + nonce + "\n" + status + "\n" + sha256hex(corpo da resposta))` |
| Comparação | `crypto.timingSafeEqual` |

O rótulo separa pedido de resposta, então uma assinatura não serve no outro sentido. O caminho na mensagem impede usar a resposta do `stop` como resposta da `permission`. O nonce impede repetir uma resposta antiga. Não há carimbo de tempo de propósito: o relógio da VM do Docker atrasa depois de hibernar, e quem conseguiria repetir um pedido capturado no loopback já leria a resposta.

**Contrato mínimo da resposta.** O coletor deixa de falar o formato do Claude Code; quem fala é o script.

| Rota | Corpo da resposta |
|---|---|
| `/hooks/claude/permission` | `{"decision": null}`, `{"decision": {"behavior": "allow"}}` ou `{"decision": {"behavior": "deny", "message": "..."}}` |
| `/hooks/claude/question` | `{"answers": null}` ou `{"answers": {"<texto da pergunta>": "<resposta>"}}` |
| `/hooks/claude/stop` | `{"messages": ["...", "..."]}` |

**Filtro no script, por construção.** O script monta a saída do zero, nunca repassa campos do coletor:

- permissão: `{"hookSpecificOutput": {"hookEventName": "PermissionRequest", "decision": {"behavior": "allow"}}}` ou `deny` com `message` de até 1 000 caracteres. Nunca `updatedInput`, `updatedPermissions` nem `interrupt`;
- pergunta: `permissionDecision: "allow"` com `updatedInput: {"questions": <as perguntas que o script recebeu no stdin>, "answers": ...}`. Cada chave precisa ser o texto de uma pergunta do stdin e cada valor uma string não vazia de até 2 000 caracteres; senão, nenhuma saída;
- fim do turno: `{"decision": "block", "reason": "<cabeçalho>\n\n<mensagens>"}`, com limite por mensagem e no total;
- `additionalContext` e `systemMessage` nunca são emitidos.

Com a chave vazada, o pior caso fica limitado a aprovar ou negar o pedido pendente tal como o agente o fez, responder perguntas com texto e entregar mensagens. Reescrever comando, gravar regra ou trocar o modo de permissão deixa de ser possível por esse caminho.

**Falha.** Qualquer erro (coletor fora, assinatura inválida, corpo fora do contrato, segredo ausente) termina com código 0 e stdout vazio: o pedido segue para o terminal, como hoje quando não há página aberta. A causa vai numa linha no stderr, visível no log de depuração do Claude Code.

**Onde mora o segredo.**

| Modo | Lugar | Quem lê |
|---|---|---|
| Hooks, sempre | `~/.orquestra-office/secret` (pasta 0700, arquivo 0600 no POSIX; no Windows, a ACL do perfil do usuário). O caminho é fixo pelo `homedir()` ou gravado nos `args` pelo instalador, nunca lido do ambiente em tempo de execução: o `.claude/settings.json` de um projeto pode definir variáveis de ambiente | `office-decision.mjs`, `office-session-start.mjs`, `office-statusline.mjs`; o `activity.header` ao lado é lido pelo `curl` |
| CLI (fase 7) | o mesmo arquivo; a CLI cria se faltar | `createOffice({ secretFile })` e `createRunner({ secretFile })` |
| Docker | `secrets:` do Compose com `file:` apontando para o mesmo arquivo; dentro do container, `/run/secrets/office_secret`, caminho que o `Dockerfile` define em `OFFICE_SECRET_FILE` | o coletor |

Não use variável de ambiente nem `.env` para o segredo: aparece em `docker inspect`, e o `.env` fica na pasta do repositório. No Windows, em instalações padrão, pastas criadas direto em `C:\` costumam herdar permissão de modificação para Usuários Autenticados (conferir com `icacls C:\projects`). Sem arquivo de segredo, o `docker compose up` falha com a mensagem "rode o instalador antes".

**Rotação.** `node hooks/install-claude-hooks.mjs --rotate-secret` (na fase 7, `npx orquestra-office rotate-secret`) grava um `K` novo e o `activity.header` novo. Hooks e `curl` leem o arquivo a cada execução, então mudam na hora. O coletor da CLI percebe a troca pela data de modificação. No Docker, o arquivo é montado pelo inode, então a rotação pede `docker compose restart office`; o comando avisa. Cada sessão de aparelho guarda o `keyId` (os primeiros bytes de `HMAC(K, "orquestra-office/key-id/v1")`), e o coletor descarta as de outra chave ao subir. Girar o segredo é, de propósito, o botão de pânico: invalida hooks antigos, aparelhos pareados e tokens do executor. Não há período com duas chaves: entre a troca e o reinício, as decisões voltam para o terminal, o que é seguro.

## 4. Painel, rede local e executor

### 4.1 `localhost`

| Opção | Como | Passo extra | O que fica aberto |
|---|---|---|---|
| P0. Sem autenticação (hoje) | nada muda | nenhum | B3, outro usuário do sistema e, no Docker com LAN, B2 |
| **P1. Cookie de aparelho em todo `/api/*` (recomendada)** | o primeiro navegador é pareado por um comando que abre o escritório já pareado | nenhum no fluxo normal; um comando quando o navegador não tem o cookie | nada do escopo |
| P2. Sem cookie só no ouvinte local | dois ouvintes: `127.0.0.1` livre; IP da rede com pareamento. No Docker, duas portas do container publicadas em endereços diferentes | nenhum | B3 e outro usuário do sistema |

Recomendo P1. Como o coletor no Docker não distingue local de rede (B2), a regra mais simples e verificável é uma só para todos. O passo extra fica escondido no comando que a pessoa já roda: `npx orquestra-office` abre o navegador pareado e, no Docker, `node hooks/open-office.mjs` faz o mesmo. O cookie dura 90 dias, renovados a cada uso.

### 4.2 Rede local

| Opção | Como | Contras |
|---|---|---|
| L1. Somente leitura sem pareamento | a rede vê, só o pareado age | `/api/state` e `/api/agents/history` têm o texto dos pedidos e os comandos completos; qualquer espectador ainda faz o coletor segurar pedidos |
| **L2. Pareamento por QR ou link, com controle total (recomendada)** | num aparelho pareado, "Parear aparelho" mostra QR e link de uso único, válido por 2 minutos; a lista de aparelhos tem "Revogar" | um QR por aparelho |
| L3. Pareamento com papel | igual a L2, com a escolha "só ver" ou "ver e decidir" ao parear | um campo a mais no domínio e na interface |

Recomendo L2: o celular pareado é seu, e "Revogar" resolve aparelho perdido. L3 entra depois sem quebrar contrato, se houver demanda.

### 4.3 Como o pareamento funciona

- **Cookie.** `office_session=<32 bytes aleatórios>; HttpOnly; SameSite=Strict; Path=/api; Max-Age=7776000`. Sem `Secure`, porque o escritório é HTTP. O coletor guarda só o SHA-256 do valor.
- **Primeiro navegador.** O comando de abrir manda `POST /pairing/bootstrap` como pedido assinado (seção 3.2), confere a assinatura da resposta e abre `http://localhost:8420/#pair=<código>`. O código é aleatório, de uso único, vale 2 minutos e vive só na memória do coletor. Na CLI da fase 7, coletor e CLI estão no mesmo processo, então a CLI pede o código direto, sem HMAC.
- **Resgate.** A página lê `#pair=` (o fragmento não vai para o servidor nem para o `Referer`), chama `POST /api/pairings/redeem`, recebe o cookie e limpa o endereço com `history.replaceState`.
- **Outro aparelho.** Num aparelho pareado, `POST /api/pairings` devolve um código novo e os endereços da rede (de `OFFICE_ALLOWED_HOSTS`). A página mostra o QR e o link `http://<OFFICE_LAN_IP>:8420/#pair=<código>`.
- **Sem cookie.** `/api/*` responde `401 {"error": "unpaired"}`. A página mostra "Este navegador não está pareado", com o comando a rodar (em `localhost`) ou "abra o escritório no computador e use Parear aparelho" (na rede).
- **Espectadores.** Só conexões pareadas em `/api/stream` contam para segurar pedidos. A `<img>` citada no README deixa de contar.
- **Origem.** Os POSTs de `/api/*` passam a exigir `Origin` presente e igual ao `Host`; pedido sem `Origin` deixa de contar como mesma origem. As guardas de `Host` e `Sec-Fetch-Site` continuam: o `SameSite=Strict` não separa portas de `localhost`, e uma página de `localhost:3000` é do mesmo site.
- **Arquivos estáticos** continuam públicos, porque são o próprio código da página e não guardam dado.
- **`?modo=demo`** não muda: o backend de demonstração não chama a API. Os métodos novos (`listDevices`, `pairDevice`, `revokeDevice`) existem nos dois backends, como exige `web/test/backends.test.js`, e na demonstração devolvem dados de exemplo.
- **Hooks e cookie são credenciais separadas.** A chave dos hooks não aprova nada em `/api/decisions`. Para o próprio agente aprovar um pedido, ele teria de ler um arquivo fora do projeto e calcular um HMAC para parear, coisa que nenhum comando comum já liberado faz sozinho (B3).

### 4.4 Executor (`127.0.0.1:8421`)

| Opção | Como | Contras |
|---|---|---|
| R0. Como está | `Host` local e `Origin` da lista ou ausente | B5 continua |
| R1. Cookie do coletor | a página manda o cookie para o executor | `localhost:8420` e `127.0.0.1:8421` são hosts diferentes para cookie; o executor teria de perguntar ao coletor a cada pedido, e um processo que ocupasse a porta 8420 diria "válido" |
| **R2. Token próprio via desafio assinado pelo coletor (recomendada)** | 1) a página pede `POST /auth/challenge` ao executor e recebe um nonce; 2) pede ao coletor `POST /api/runner-ticket` com o nonce (com cookie) e recebe `HMAC(K, "orquestra-office/runner-ticket/v1\n" + nonce)`; 3) troca no executor por um token aleatório em `POST /auth/session`; 4) usa `Authorization: Bearer` nos `fetch` e `?token=` no `EventSource` | três idas na abertura da página; o executor passa a ler o segredo |
| R3. Executor dentro do coletor | só na CLI da fase 7: o coletor expõe `/api/runner/*` com o cookie e a porta 8421 some | não cobre o Docker, onde o executor é outro processo |

Recomendo R2: funciona igual no Docker e na CLI e não depende de relógio. O executor continua só em `127.0.0.1`. `/health` continua público. O `Access-Control-Allow-Headers` ganha `Authorization`. R3 fica como otimização possível da fase 7.

### 4.5 Contrato

Erros seguem o formato atual `{ "error": string }`. Nenhuma lista nova precisa de paginação: são no máximo 20 aparelhos e 20 códigos pendentes.

```yaml
openapi: 3.1.0
info: { title: orquestra-office collector, version: "auth-v1" }
components:
  securitySchemes:
    deviceCookie: { type: apiKey, in: cookie, name: office_session }
    activityToken: { type: http, scheme: bearer }
    signedRequest: { type: apiKey, in: header, name: X-Office-Signature, description: "HMAC v1 da seção 3.2, com X-Office-Nonce" }
  responses:
    Unpaired: { description: sem cookie válido, content: { application/json: { schema: { $ref: "#/components/schemas/Error" } } } }
  schemas:
    Error: { type: object, required: [error], properties: { error: { type: string } } }
    PairingCode:
      type: object
      required: [code, expiresAt]
      properties:
        code: { type: string, description: "base64url, 128 bits, uso único" }
        expiresAt: { type: integer, description: "epoch ms, relógio do coletor" }
        urls: { type: array, items: { type: string, format: uri } }
    Device:
      type: object
      required: [id, label, host, createdAt, lastSeenAt, isCurrent]
      properties:
        id: { type: string }
        label: { type: string, maxLength: 40 }
        host: { type: string }
        createdAt: { type: integer }
        lastSeenAt: { type: integer }
        isCurrent: { type: boolean }
paths:
  /events/claude: { post: { security: [{ activityToken: [] }], responses: { "200": { description: "{} (sem Authorization: {} e aviso de hooks antigos)" }, "401": { description: token errado } } } }
  /events/statusline: { post: { security: [{ activityToken: [] }], responses: { "200": { description: "{}" }, "401": { description: token errado } } } }
  /events/codex: { post: { security: [{ activityToken: [] }], responses: { "200": { description: "{}" }, "401": { description: token errado } } } }
  /hooks/claude/permission: { post: { security: [{ signedRequest: [] }], responses: { "200": { description: "resposta assinada: { decision }" }, "401": { description: assinatura inválida } } } }
  /hooks/claude/question: { post: { security: [{ signedRequest: [] }], responses: { "200": { description: "resposta assinada: { answers }" }, "401": { description: assinatura inválida } } } }
  /hooks/claude/stop: { post: { security: [{ signedRequest: [] }], responses: { "200": { description: "resposta assinada: { messages }" }, "401": { description: assinatura inválida } } } }
  /pairing/bootstrap:
    post:
      security: [{ signedRequest: [] }]
      responses:
        "200": { description: resposta assinada, content: { application/json: { schema: { $ref: "#/components/schemas/PairingCode" } } } }
        "401": { description: assinatura inválida }
        "429": { description: códigos pendentes demais }
  /api/pairings/redeem:
    post:
      security: []
      description: "Exige Origin igual ao Host e JSON."
      requestBody: { content: { application/json: { schema: { type: object, required: [code], properties: { code: { type: string } } } } } }
      responses:
        "204": { description: "Set-Cookie office_session" }
        "400": { description: código inválido, usado ou vencido }
        "403": { description: origem recusada }
  /api/pairings:
    post:
      security: [{ deviceCookie: [] }]
      responses:
        "200": { content: { application/json: { schema: { $ref: "#/components/schemas/PairingCode" } } } }
        "401": { $ref: "#/components/responses/Unpaired" }
  /api/devices:
    get:
      security: [{ deviceCookie: [] }]
      responses:
        "200": { content: { application/json: { schema: { type: object, required: [devices], properties: { devices: { type: array, maxItems: 20, items: { $ref: "#/components/schemas/Device" } } } } } } }
        "401": { $ref: "#/components/responses/Unpaired" }
  /api/devices/{id}/revoke:
    post:
      security: [{ deviceCookie: [] }]
      parameters: [{ name: id, in: path, required: true, schema: { type: string } }]
      responses: { "204": { description: revogado }, "401": { $ref: "#/components/responses/Unpaired" }, "404": { description: não existe } }
  /api/runner-ticket:
    post:
      security: [{ deviceCookie: [] }]
      requestBody: { content: { application/json: { schema: { type: object, required: [nonce], properties: { nonce: { type: string, maxLength: 64 } } } } } }
      responses: { "200": { content: { application/json: { schema: { type: object, required: [ticket], properties: { ticket: { type: string } } } } } }, "401": { $ref: "#/components/responses/Unpaired" } }
```

As rotas atuais de `/api/*` (`state`, `stream`, `agents/history`, `agents/message`, `decisions/{id}`, `projects/{key}/template`, `projects/{key}/close`) mantêm o corpo e ganham `security: [{ deviceCookie: [] }]` e a resposta `401`. O estado público ganha `security: { legacyHooksSeenAt: number | null, isSecretMissing: boolean }`.

No executor: `POST /auth/challenge` devolve `{ nonce }`; `POST /auth/session` recebe `{ nonce, ticket }` e devolve `{ token, expiresAt }`; as demais rotas, menos `/health`, respondem `401` sem `Authorization: Bearer` (ou `?token=` no fluxo de eventos).

### 4.6 Dados e fronteiras

| Onde | O quê |
|---|---|
| `~/.orquestra-office/secret` | `K` em base64url |
| `~/.orquestra-office/activity.header` | `Authorization: Bearer <token de atividade>` |
| `DATA_DIR/devices.json` (volume `office-data` ou pasta da CLI) | `{ version: 1, keyId, devices: [{ id, tokenHash, label, host, createdAt, lastSeenAt }] }`; sessão sem uso por 30 dias sai |
| memória do coletor | códigos de pareamento, nonces de pedidos de pareamento |
| memória do executor | desafios (60 s) e tokens (12 h ou até o executor parar) |

No coletor, o pareamento vira um contexto próprio, `access/`, com `domain/` (códigos de uso único, sessões de aparelho), `application/` (resgatar, emitir, pareamento inicial, revogar) e `infra/` (arquivo de aparelhos, arquivo do segredo). A verificação de hook fica na borda, em `http/hook-auth.js`, porque é tradução de protocolo. A montagem das mensagens assinadas fica em `collector/src/shared/auth/`, que o executor pode importar (ADR 0001, item 3). Os hooks têm cópia própria em `hooks/lib/`, porque precisam continuar copiáveis como pasta (fase 7); um teste de contrato com vetores fixos prende as duas cópias.

## 5. Migração

**Reinstalar é obrigatório**, uma vez por pasta de configuração do Claude Code (com a fase 6, uma por conta) e uma vez para o Codex. As entradas `http` precisam virar `command`, e alguém precisa criar o segredo.

- **O que se atualiza sozinho.** `office-session-start.mjs` e `office-statusline.mjs` são arquivos do repositório chamados pelo caminho; com o código novo, passam a mandar o token assim que o segredo existir.
- **O instalador** reconhece as entradas antigas pelo caminho da URL (`/events/claude`, `/hooks/claude/...`), como já faz, e as substitui. Reconhece também as novas pelo nome do script e pelo caminho no `args`. Cria o segredo se faltar, nunca o sobrescreve sem `--rotate-secret`, e avisa "migrado de hooks HTTP para command".
- **Coletor novo com hooks antigos.** Pedido sem `Authorization` nas rotas de atividade, ou sem assinatura nas de decisão, recebe `200 {}`: o Claude Code trata como sucesso sem saída e não mostra erro no terminal. Nada é registrado, segurado nem entregue. O coletor marca `legacyHooksSeenAt`, e a página mostra "Há hooks de uma versão antiga neste computador. Rode `node hooks/install-claude-hooks.mjs`" (ou o comando da CLI). Com token ou assinatura errados, a resposta é `401`.
- **Hooks novos com coletor antigo.** O coletor antigo ignora os cabeçalhos e responde no formato antigo, sem assinatura. O `office-decision.mjs` rejeita, e o pedido vai para o terminal. Falha segura.
- **Docker.** O `compose.yaml` passa a exigir o arquivo do segredo. Sem ele, o `docker compose up` falha com a mensagem "rode o instalador antes". A ordem do README muda para: instaladores, `docker compose up -d --build`, `node hooks/open-office.mjs`.
- **Navegador.** Depois da atualização, a página mostra "Este navegador não está pareado" até o primeiro `open-office`.
- **Sem período de transição.** Aceitar atividade sem token "por uma versão" manteria B4 aberto e só pouparia uma reinstalação que o aviso já pede. O projeto ainda não foi publicado, então quase não há instalações fora a do autor.

## 6. Plano de implementação

### 6.1 Posição na fila

Fase S, depois da fase 4 (o agent que está em `hooks/` termina e faz o commit) e antes da fase 5. Motivos: corrige A antes da publicação do repositório; a fase 5 não depende dela; e a fase 6 precisa vir depois, porque o 6.6 grava `--account` nos mesmos comandos que esta fase troca para forma exec, e o 6.25 refaz o alerta de aprovação, que passa a depender do pareamento. A fase 7 herda tudo: a CLI cria o segredo, passa `secretFile` às duas composições e abre o navegador pareado.

Alternativa aceitável: entre as fases 5 e 6. Depois da fase 6, não.

Comandos de verificação: V-C, V-R, V-W, V-H, V-Docker e V-Browser, da seção 10.1 do plano. Depois do S.8, o V-Docker passa a esperar `200` em `/` e `401` em `/api/state`. Esta fase acrescenta o V-Auth:

```powershell
curl.exe -s -o NUL -w "%{http_code}`n" http://127.0.0.1:8420/api/state
curl.exe -s -o NUL -w "%{http_code}`n" -X POST -H "Content-Type: application/json" -H "Host: localhost" --data "{}" http://<OFFICE_LAN_IP>:8420/api/decisions/x
curl.exe -s -w "%{http_code}`n" -X POST -H "Content-Type: application/json" --data "{}" http://127.0.0.1:8420/hooks/claude/stop
```

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8420/api/state
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Content-Type: application/json" -H "Host: localhost" --data "{}" "http://$OFFICE_LAN_IP:8420/api/decisions/x"
curl -s -w "%{http_code}\n" -X POST -H "Content-Type: application/json" --data "{}" http://127.0.0.1:8420/hooks/claude/stop
```

Esperado: `401`, `401` e `{}200`. Mais o roteiro manual: com o container parado, um servidor falso em 8420 que responde `allow` com `updatedInput`, `updatedPermissions` (`setMode` `bypassPermissions` em `userSettings`) e `additionalContext`; numa sessão real com `CLAUDE_CONFIG_DIR` temporário, um comando Bash não é reescrito, nenhuma regra é gravada, nada aparece no contexto e o prompt do terminal aparece normalmente.

### 6.2 Passos

Um agent escrevendo por vez, teste primeiro em todo passo de domínio e de protocolo.

| Passo | Agent | Arquivos | Testes e verificação | Esperado |
|---|---|---|---|---|
| S.0 Medir e confirmar, sem mudar o repositório | `backend-node-typescript` (scripts só no scratchpad) | nenhum | 200 execuções de cada: `node` trivial em forma exec, `curl.exe` em forma exec e `node` em forma shell pelo Git Bash (tempo p50 e p95, CPU, memória), no Windows e, se possível, no macOS. Sessão real do Claude Code (versão anotada) com `CLAUDE_CONFIG_DIR` temporário: `async` com `args` funciona no Windows; o stdout vazio não gera aviso; o `~` em `secrets.file` do Compose funciona no Windows e no macOS | números e confirmações anexados a este ADR; se a forma exec com `curl` falhar, adotar A2 |
| S.1 Segredo nos hooks | `backend-node-typescript` | `hooks/lib/office-home.mjs`, `hooks/lib/office-secret.mjs`, `hooks/test/office-secret.test.mjs` | V-H com `HOME`/`USERPROFILE` temporários: cria a pasta 0700 e o arquivo 0600 (POSIX), não sobrescreve, `--rotate-secret` troca, deriva o token de atividade e grava `activity.header`; o caminho não vem do ambiente em tempo de execução | verde |
| S.2 Protocolo e contrato | `backend-node-typescript` | `collector/src/shared/auth/signed-message.js` (montagem pura das mensagens), `hooks/lib/signed-message.mjs`, `collector/test/signed-message.test.js`, `hooks/test/signed-message-contract.test.mjs` | V-C e V-H: vetores fixos dão a mesma assinatura nos dois lados; rótulo de pedido não valida resposta; caminho diferente não valida; corpo alterado não valida | verde |
| S.3 Coletor: autenticação das rotas de hook | `backend-node-typescript` | `collector/src/http/hook-auth.js`, `http/hook-routes.js`, `access/infra/office-secret-file.js`, `composition.js` (`secretFile`), `main.js` (`OFFICE_SECRET_FILE`), `claude/hook-responses.js` (substituído pelo contrato mínimo), `office/application/public-office-view.js`, testes | V-C: sem cabeçalho dá `200 {}` e marca `legacyHooksSeenAt`; token errado dá `401`; token de atividade não vale em rota de decisão; pedido assinado segura e responde assinado; segredo ausente deixa `isSecretMissing` | verde |
| S.4 Coletor: eventos fora de ordem | `backend-node-typescript` | `collector/src/claude/claude-event.js` (leva `toolUseId`), `office/domain/office-store.js`, testes | V-C: `PreToolUse` depois do `PostToolUse` do mesmo `tool_use_id` não muda o status; `PostToolUse` depois do `Stop` não volta para "trabalhando"; histórico mantém as duas entradas | verde |
| S.5 Script de decisão | `backend-node-typescript` | `hooks/office-decision.mjs` (caminho fixo), `hooks/lib/hook-output.mjs`, `hooks/test/office-decision.test.mjs`, `hooks/test/support/fake-office.mjs` (assina) | V-H contra o escritório falso: saída exata para allow, deny, pergunta e mensagens; assinatura errada, nonce de outro pedido, corpo fora do contrato e segredo ausente dão stdout vazio e código 0; campos extras do coletor (`updatedPermissions`, `additionalContext`, `interrupt`, `updatedInput` na permissão) nunca aparecem; chave de pergunta que não está no stdin anula a resposta | verde |
| S.6 Instaladores | `backend-node-typescript` | `hooks/lib/claude-settings.mjs`, `hooks/lib/codex-config.mjs`, `hooks/install-claude-hooks.mjs`, `hooks/install-codex-notify.mjs`, `hooks/office-session-start.mjs`, `hooks/office-statusline.mjs`, testes | V-H: `settings.json` antigo (fixture com as 12 entradas HTTP) vira o novo layout; hooks do usuário intactos; instalar duas vezes não duplica; `--remove` limpa; caminho do `curl` e dispositivo nulo por plataforma; Codex com `-H @` e `-o` nulo, reconhecendo o `notify` antigo; sessão real: atividade aparece, permissão decidida no escritório volta à sessão | verde, migração idempotente |
| S.7 Docker | `devops-docker` | `compose.yaml` (`secrets`), `collector/Dockerfile` (`OFFICE_SECRET_FILE=/run/secrets/office_secret`) | V-Docker sem o arquivo (falha com a mensagem) e com o arquivo; V-Auth, terceira linha; roteiro do servidor falso | fecha o achado A |
| S.8 Coletor: pareamento | `backend-node-typescript` | `collector/src/access/domain/{pairing-codes, device-sessions}.js`, `access/application/{bootstrap-pairing, issue-pairing-code, redeem-pairing, revoke-device}.js`, `access/infra/device-sessions-file.js`, `http/panel-auth.js`, `http/pairing-routes.js`, `http/office-api-routes.js`, `http/request-policy.js` (POST sem `Origin` recusado), `http/event-stream.js` (só pareado conta), `composition.js`, `collector/test/architecture.test.js` (contexto `access/`), testes | V-C: código de uso único e vencido recusados; cookie com os atributos certos; só o hash vai para o disco; `keyId` diferente descarta sessões; `401` em todo `/api/*` sem cookie; `Host: localhost` vindo da rede não ajuda; espectador sem cookie não segura pedido; V-Auth, duas primeiras linhas | fecha o achado B |
| S.9 Página: pareamento | `fullstack-feature` | `web/scripts/infra/office-api.js`, `infra/backends/{live-backend, demo-backend}.js`, `app/pairing.js`, `view/office/pairing-view.js`, `view/office/devices-view.js`, `web/index.html`, `web/styles/*`, `web/vendor/` (biblioteca de QR, se aprovada), `web/test/{backends, views}.test.js` | V-W; V-Browser: resgate pelo fragmento e endereço limpo; tela "não pareado"; "Parear aparelho" com QR; celular pareado aprova; "Revogar"; aviso de hooks antigos; `?modo=demo` sem nenhuma requisição à API | verde |
| S.10 Abrir já pareado | `backend-node-typescript` | `hooks/open-office.mjs`, `hooks/lib/open-browser.mjs`, `hooks/install-claude-hooks.mjs` (abre no fim, se o coletor responder), testes | V-H contra o escritório falso: pedido assinado; resposta sem assinatura válida não abre nada; manual no Windows e no macOS | um comando abre o escritório pareado |
| S.11 Executor | `backend-node-typescript` | `runner/src/http/{runner-auth, server, request-guard}.js`, `runner/src/infra/office-secret-file.js`, `runner/src/composition.js`, `runner/src/main.js`, `collector/src/http/office-api-routes.js` (`/api/runner-ticket`), `web/scripts/infra/runner-client.js`, testes | V-R e V-C: sem token dá `401` (menos `/health`); desafio de uso único; ticket de outro nonce recusado; V-W; manual: abrir sessão, terminal ao vivo, interromper, encerrar | fecha B5 |
| S.12 Documentação | `productivity-docs` | `README.md` (instalação, modo LAN, "O que fica guardado", desinstalar com o segredo), `docs/adr/0001-arquitetura-em-camadas.md` (item 6 com `office-decision.mjs`), `docs/arquitetura/plano-de-refatoracao.md` (seção 15 aponta para cá, fase S na seção 10, V-Docker, fase 7), `docs/arquitetura/fase-6-sede.md` (ADRs do 6.2 viram 0003 a 0005) | leitura | documentos coerentes |
| S.13 Revisões (somente leitura, em paralelo) | `security-appsec` (protocolo, cookie, pareamento, executor), `security-threat-model` (modelo da seção 1.4), `productivity-code-reviewer` | nenhum | relatórios | correções viram passos novos |

### 6.3 Paralelismo e cuidados

- S.0 é somente leitura no repositório e pode rodar enquanto a fase 4 termina. Todo o resto é sequencial, porque S.3, S.8 e S.11 mexem em `composition.js`, e S.5, S.6 e S.10 mexem em `hooks/`.
- As três revisões do S.13 rodam juntas. Uma revisão de segurança do bloco S.1 a S.7 pode rodar junto com o S.8, porque lê arquivos que o S.8 não toca.
- Entre S.3 e S.7, não reconstrua a imagem que você usa no dia a dia: o coletor novo ignora os hooks antigos até o S.6. Trabalhe na branch e reconstrua no fim do S.7.
- Os passos S.1 a S.7 entregam sozinhos a correção do achado A. Se for preciso publicar antes, eles podem sair primeiro, com o pareamento logo depois.

## 7. Alternativas descartadas

- **Manter `http` com cabeçalho de token (A1).** O Claude Code não verifica quem responde, então A continua aberto.
- **`async` com `node` em toda atividade (A2).** Correto e uniforme, mas custa cerca de 5 vezes a CPU do `curl` por evento no Windows. Fica como plano B.
- **Token no cabeçalho para as decisões (D2).** Autentica só o cliente; quem ocupa a porta recebe o token e responde o que quiser.
- **Socket Unix ou pipe nomeado (D3).** Não atravessa do Windows para o container Linux, e no Windows o primeiro a criar o pipe fica com o nome.
- **HTTPS com certificado fixado (D4).** Exige gerar certificado sem dependência.
- **Ed25519 (D5) e servidor MCP (D6).** Custam mais e só ganham contra código do mesmo usuário, fora do escopo.
- **Sem login em `localhost` (P0, P2).** Mantêm B3 e outro usuário do sistema, e P2 exige duas portas no Docker.
- **Rede só com leitura sem pareamento (L1).** Expõe pedidos e comandos completos a toda a rede.
- **Executor validando o cookie no coletor (R1).** Depende de quem estiver em 8420.
- **Carimbo de tempo nas assinaturas.** O relógio da VM do Docker atrasa depois de hibernar, e o nonce já impede repetir resposta.
- **Segredo em variável de ambiente ou no `.env`.** Fica em `docker inspect` e numa pasta que, no Windows, pode ser legível por outros usuários.
- **Período de transição aceitando pedidos sem assinatura.** Mantém B4 e só adia uma reinstalação que o aviso já pede.

## 8. Consequências

Positivas:

- Um processo que ocupe a porta 8420, outro usuário do sistema ou um `OFFICE_URL` remoto deixam de decidir por você. Na pior hipótese, a chave vazada só aprova o pedido tal como o agente fez.
- As ferramentas ficam mais rápidas que hoje: nenhum evento de atividade espera rede.
- A rede local deixa de ver pedidos, comandos e mensagens sem pareamento, e um espectador não pareado deixa de segurar pedidos.
- O agente não aprova os próprios pedidos com um `curl` liberado.
- O coletor deixa de falar o formato de saída do Claude Code; o contrato com o hook é pequeno, versionado e testado nos dois lados.
- Organizações que restringem hooks HTTP (`allowedHttpHookUrls`) deixam de bloquear o escritório.

Negativas:

- Reinstalação obrigatória, uma por pasta de configuração, e um comando a mais na instalação pelo Docker (`open-office`).
- Um navegador novo, ou com cookies limpos, precisa rodar o comando de abrir.
- Um processo por evento de atividade. A estimativa com `curl` é baixa, mas só o S.0 confirma.
- Dependência do `curl` do sistema (Windows 10 1803 ou mais novo, macOS); sem ele, o instalador recusa.
- Um arquivo novo no disco, `devices.json`, só com hashes. O README atualiza "O que fica guardado".
- No modo LAN, o cookie trafega em HTTP: quem escuta a rede pode copiá-lo. Pareamento protege contra quem só alcança a porta. HTTPS na rede local fica para outro ADR, se houver demanda.
- Cookies não isolam porta: qualquer servidor em `localhost` recebe o cookie em `/api`. É código local, fora do escopo, e `Path=/api` reduz o alcance.
- O ADR 0002 planejado pela fase 6 (Sede em salão aberto) e os seguintes passam a ser 0003 a 0005.
- Infraestrutura: nada novo. Custo mensal: zero.

## 9. Perguntas ao usuário

| Id | Pergunta | Recomendação | Custo para você |
|---|---|---|---|
| Q1 | Em `localhost`, exigir pareamento (P1) ou deixar sem login (P2)? | P1 | P1: no fluxo normal, nenhum passo (o comando que você já roda abre pareado); navegador novo ou cookies limpos pedem um comando. P2: nenhum passo, mas o agente com `curl` liberado aprova os próprios pedidos, outro usuário da máquina também, e o Docker com LAN passa a publicar duas portas |
| Q2 | Na rede local: pareamento com controle total (L2), com escolha "só ver" ou "ver e decidir" (L3), ou leitura sem pareamento (L1)? | L2 | L2: um QR por aparelho. L3: o mesmo QR e uma escolha a mais ao parear. L1: nenhum passo, mas pedidos e comandos completos ficam visíveis para a rede |
| Q3 | Atividade por `curl` com token (A3) ou por `node` com HMAC (A2)? | A3, confirmada pelo S.0 | A3: exige o `curl` do sistema; dois tipos de credencial no código. A2: cerca de 5 vezes mais CPU por evento no Windows |
| Q4 | Migração com corte seco e aviso, ou aceitar atividade sem token por uma versão? | Corte seco | Corte seco: depois de atualizar, rodar o instalador antes do `docker compose up`, e uma pasta de configuração esquecida fica sem atividade até reinstalar (com aviso). Transição: nada quebra na hora, mas a rede continua forjando atividade e esvaziando a fila durante a versão |
| Q5 | Pasta do segredo (antecipa a D9): `~/.orquestra-office` em todos os sistemas, ou `%LOCALAPPDATA%\orquestra-office` no Windows? | `~/.orquestra-office` | Mudar depois exige mover o segredo e regravar caminhos no `settings.json`, no `config.toml` do Codex e no `compose.yaml` (reinstalar de novo) |
| Q6 | Posição da fase S: entre as fases 4 e 5, ou entre 5 e 6? | Entre 4 e 5 | Atrasa a fase 5 em 14 passos. Entre 5 e 6, o achado A fica aberto por mais uma fase; depois da 6, o 6.6 seria refeito |
| Q7 | Autenticar o executor agora (S.11) ou adiar para a fase 7? | Agora | Agora: um passo a mais nesta fase e três idas a mais na abertura da página. Adiar: B5 fica aberto até a fase 7, com o risco descrito no README |
| Q8 | QR com biblioteca vendorizada em `web/vendor` (cerca de 20 KB, MIT, com licença ao lado) ou só link e código para digitar no celular? | QR vendorizado | QR: um arquivo a mais para manter, como os outros de `web/vendor`. Só link: digitar um código de 22 caracteres no celular a cada aparelho |

## 10. Fontes

- [Claude Code, Hooks reference](https://code.claude.com/docs/en/hooks): resposta de hook HTTP, campos de hook `command` (`args`, `async`, `shell`, `onFailure`), "Run hooks in the background", controle de decisão de `PermissionRequest`, `PreToolUse` e `Stop`, "Permission update entries", campos de entrada (`tool_use_id`), "Security considerations". Lida em 18/11/2026.
- [Docker, How to use secrets in Compose](https://docs.docker.com/compose/how-tos/use-secrets/) e [Compose file reference, secrets](https://docs.docker.com/reference/compose-file/secrets/): montagem em `/run/secrets/<nome>` como arquivo único. O suporte a `~` no caminho não está documentado; o S.0 confere.
- Versão do campo `args` (v2.1.139), de terceiros, sem confirmação no changelog oficial: [issue 58119](https://claudeissues.com/issue/58119-docs-hooks-command-hook-args-field-exec-form-not-documented-in-hooks-reference), [issue 58441](https://claudeissues.com/issue/58441-bug-doctor-schema-validator-rejects-exec-form-args-hooks-added-in-2-1-139), [wikidocs](https://wikidocs.net/458158). Relato de falha da forma exec no Windows, não verificado: [issue 90495](https://claudeissues.com/issue/90495-windows-exec-form-hook-args-dropped-still-routed-through-bash-exe-causing-eval-s).
- Código lido: `hooks/lib/{claude-settings, codex-config, office-url}.mjs`, `hooks/{install-claude-hooks, install-codex-notify, office-session-start, office-statusline}.mjs`, `hooks/test/support/fake-office.mjs`, `collector/src/{main, composition}.js`, `collector/src/http/{server, hook-routes, office-api-routes, request-policy, event-stream, security-headers}.js`, `collector/src/claude/{hook-responses, claude-event}.js`, `collector/src/control/{domain/pending-decisions, domain/decision-answer, application/hold-request, application/send-message-to-agent}.js`, `collector/src/office/application/{public-office-view, record-activity}.js`, `collector/Dockerfile`, `compose.yaml`, `compose.lan.yaml`, `runner/src/{main.js, http/server.js, http/request-guard.js, claude/claude-process.js}`, `web/scripts/infra/{office-api, runner-client}.js`, `README.md`, `docs/adr/0001-arquitetura-em-camadas.md`, `docs/arquitetura/plano-de-refatoracao.md`, `docs/arquitetura/fase-6-sede.md`.

## Decisões do usuário

Respondidas em 18/11/2026.

| Pergunta | Decisão |
|---|---|
| Q1 `localhost` | P1, pareamento: todo `/api/*` exige o cookie de aparelho pareado, também em `localhost`. |
| Q2 rede local | L2, pareamento por QR ou link de uso único, com controle total. |
| Q4 migração | Corte seco, com o aviso de "hooks antigos" na página. |
| Q3, Q5, Q7, Q8 | Seguem a recomendação: atividade por `curl` com token (A3), se o S.0 confirmar; segredo em `~/.orquestra-office`; executor autenticado já na fase S; QR com biblioteca vendorizada. |
| Q6 ordem | A fase 5 já estava em andamento quando o ADR ficou pronto. A fase S roda em paralelo, numa branch própria, e entra antes do passo 6.6 da Sede, que mexe nos hooks. |
