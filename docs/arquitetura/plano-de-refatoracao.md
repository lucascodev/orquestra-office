# Plano de refatoração: camadas, Clean Architecture e Clean Code

Data: 2026-11-18. Estado: fases 0 a 2 executadas (rede de segurança, collector e runner); fases 3 a 5 pendentes. Decisão registrada em `docs/adr/0001-arquitetura-em-camadas.md`.

## 1. Resumo

O projeto já está em bom estado: sem dependências, sem build, com fábricas `createX({ deps })`, regras de comportamento dos bonecos puras e testadas, e privacidade e segurança cobertas por teste. Os problemas reais são poucos e localizados:

1. O runner lê o interior do collector (`runner/src/sessions/transcript.js:1`).
2. No collector, o domínio importa um adapter (`office/office-store.js:1`), a camada HTTP monta as próprias dependências (`http/server.js:22`) e os casos de uso moram nas rotas (`http/claude-routes.js`, `http/office-api.js`).
3. No web, a pasta `view/` mistura regra pura com HTML. Seis arquivos são código morto e quebrado. `app/data-source.js` testa `isDemo()` em todo método, e o renderer 3D toma decisões de movimento que deveriam ser regra testável.
4. Há conhecimento duplicado entre pacotes (formato da chave do agente, regra de quem recebe mensagem, ids de tema, texto das ações) sem nenhum teste que pegue divergência.

A estrutura alvo mantém as convenções do projeto (kebab-case, `createX`, sem sufixo `.use-case`, pasta `view/` no web) e acrescenta camadas só onde há ganho. A refatoração vai em 5 fases (0 a 4) mais uma opcional (5), uma área por fase, com testes de caracterização antes de mexer nas áreas sem teste.

Três requisitos novos ficam fora da refatoração, como fases posteriores na ordem aprovada (seção 11): o escritório em formato de campus, com todos os itens na v1 e os 7 temas preservados (fase 6); instalação com `npx orquestra-office` (fase 7); landing page no GitHub Pages (fase 8). A refatoração deixa prontas as costuras de que eles precisam; cada costura está marcada com "Preparo" nos passos da seção 10.

## 2. Escopo e método

- Lidos todos os arquivos de código de `collector/`, `runner/`, `web/scripts`, `web/test`, `hooks/`, os testes, `Dockerfile`, `compose*.yaml`, `README.md`, `web/index.html` e os arquivos soltos da raiz. `web/vendor` não foi lido. O `.env` também não foi lido, porque guarda configuração da máquina.
- Dependências mapeadas pelos `import`, não pelos nomes de pasta.
- Nada foi executado nesta etapa (sem testes, sem `node --check`): esta etapa não tinha ferramenta de terminal. A fase 0 registra a linha de base real.

## 3. Restrições que a estrutura alvo respeita

| Restrição | Consequência no plano |
|---|---|
| Web sem build, servida como arquivos estáticos | Imports relativos com extensão `.js`. `web/index.html` continua carregando `scripts/app/main.js`. Nenhum arquivo do web importa algo fora de `web/`. |
| `WEB_DIR` do collector e o teste `collector/test/server.test.js:10` dependem de `web/index.html` | A pasta `web/` e o `index.html` não mudam de lugar. |
| Collector e runner sem dependências npm | Verificação de camadas por testes `node:test` que leem os imports, sem dependency-cruiser nem eslint. |
| Docker: contexto `./collector`, `COPY src ./src`, `CMD node src/main.js` | `collector/src/main.js` fica onde está. Nada em `collector/src` importa fora de `collector/src`. O código compartilhado com o runner mora dentro de `collector/src/shared/`. |
| Hooks gravados com caminho absoluto no `~/.claude/settings.json` | `hooks/office-session-start.mjs` e `hooks/office-statusline.mjs` mantêm nome e lugar. O instalador reconhece os hooks dele pelo nome do arquivo (`install-claude-hooks.mjs:40,43`); renomear deixaria entradas órfãs. |
| README manda rodar `node runner/src/main.js`, `node hooks/install-*.mjs` | Esses caminhos ficam. |
| Sem git | Fase 0 cria a rede de segurança antes de qualquer passo. |
| Os 7 temas e o seletor "Escritório" por projeto precisam sobreviver ao campus (fase 6) | O catálogo de temas e o `template` por projeto no collector não mudam; a sala 3D passa a ser montável sozinha, numa origem, com o tema dela. |
| Futuro pacote npm (fase 7) | A composição de cada pacote vira função de configuração (`createOffice`, `createRunner`), sem ler `process.env` nem depender do diretório atual; a CLI reaproveita as duas. |

## 4. Mapa de dependências reais

### 4.1 collector

```text
main.js ─→ control/pending-decisions, http/server, office/office-store, office/persistence
http/server ─→ control/outbox, control/pending-decisions, events/codex-event, office/session-history,
               http/claude-routes, http/event-stream, http/office-api, http/request-guard, http/static-files,
               node:http, node:fs/promises (lê state.js)
http/claude-routes ─→ control/hook-responses, events/claude-event, events/claude-history,
                      events/statusline-reading, events/tool-summary
http/office-api ─→ (nada; recebe store, decisions, outbox, history)
events/claude-event ─→ events/describe-tool
events/claude-history ─→ office/agent-key, events/tool-summary
office/office-store ─→ events/describe-tool (baseName)  ← seta para fora
                       office/agent-key, office/templates
office/persistence ─→ node:fs
control/pending-decisions ─→ node:crypto
runner/src/sessions/transcript ─→ collector/src/events/tool-summary  ← outro pacote
```

### 4.2 runner

```text
main.js ─→ http/server, sessions/claude-process, sessions/session-registry
http/server ─→ http/request-guard
sessions/session-registry ─→ sessions/session, node:fs (statSync)
sessions/session ─→ sessions/transcript (protocolo stream-json do Claude), node:crypto
sessions/transcript ─→ ../../../collector/src/events/tool-summary.js
sessions/claude-process ─→ node:child_process
```

### 4.3 web

```text
app/main ─→ app/{agent-panel, data-source, decision-actions, new-session-dialog, panel-resizer},
            art/themes, three/renderer, view/{agent-names, agent-rules, control-view, office-view, status}
app/agent-panel ─→ view/{control-view, format, office-view, terminal-entries}, app/{decision-actions, terminal-pane}
app/data-source ─→ data/{cloud-team, demo-data}, app/{office-api, runner-client}
app/terminal-pane ─→ view/{icons, terminal-markdown}

regras puras (hoje em view/, nenhuma importa DOM, three ou fetch):
view/agent-names ─→ art/pixels, data/first-names
view/agent-temperament, seated-fidgets ─→ art/pixels
view/agent-reactions ─→ art/pixels, view/agent-temperament
view/agent-thoughts ─→ art/pixels, data/thoughts
view/conversations ─→ art/pixels, data/conversations, view/agent-reactions
view/conversation-tracker ─→ view/conversations
view/free-time-clock ─→ view/agent-reactions
view/room-layout ─→ view/wall-plan
view/room-places ─→ view/agent-reactions, view/room-layout
view/terminal-format ─→ data/terminal-tools

HTML em string:
view/office-view ─→ art/themes, view/{control-view, format, status}
view/control-view ─→ view/{format, icons}
view/terminal-entries ─→ view/{format, terminal-format, terminal-markdown}
view/terminal-markdown ─→ vendor/{purify, highlight, marked}

3D:
three/renderer ─→ view/{agent-thoughts, conversation-tracker, free-time-clock, room-places, room-routes},
                  three/{kit, people, room, thought-bubble}
three/people ─→ art/pixels, view/{agent-temperament, seated-fidgets}, three/{emotes, kit, poses, reactions}
three/room ─→ art/pixels, view/{room-layout, room-places, wall-plan}, three/{commons, decor, furniture, kit, parts, people}
three/{commons, decor, furniture, office-walls, parts, emotes} ─→ three/kit (e entre si)
three/kit ─→ vendor/three.module.min.js

código morto (ninguém importa a partir de app/main.js):
view/room-scene ─→ art/{characters, iso, pixels, props}
art/{characters, props, sprites, templates} ─→ art/pixels { rect, svg }  ← exports que não existem
```

A direção já está certa no web: nenhuma regra pura importa DOM, three ou rede. O problema é de lugar e de nome, não de seta.

### 4.4 hooks

Quatro scripts independentes, sem imports entre si. Repetem `OFFICE_URL` (4 vezes), `readStdin` (2 vezes) e o carimbo de backup (2 vezes).

## 5. Revisão de arquitetura: projeto inteiro

Ordem: (A) regra de dependência, (B) regra de negócio na borda, (C) organização e Clean Code.

| # | Onde | Violação | Por que importa | Para onde vai |
|---|---|---|---|---|
| A1 | `runner/src/sessions/transcript.js:1` | Runner importa o interior do collector (`collector/src/events/tool-summary.js`) | Qualquer reorganização do collector quebra o runner sem aviso; o contrato é invisível | `collector/src/shared/claude/summarize-tool.js`, a única API pública do collector, com teste de arquitetura dos dois lados (seção 8) |
| A2 | `collector/src/office/office-store.js:1` | Agregado do domínio importa `baseName` do adapter de entrada `events/describe-tool.js` | Seta para fora: o núcleo depende de quem traduz payload do Claude | `collector/src/office/domain/path-name.js`; o adapter passa a importar do domínio |
| A3 | `collector/src/http/server.js:22` | A camada HTTP cria as próprias dependências (`createOutbox()`, `createPendingDecisions()`, `createSessionHistory()` como valor padrão); a composição fica dividida entre `main.js` e `server.js` | A borda conhece classes concretas; trocar ou testar exige saber dos padrões escondidos | `collector/src/composition.js` (`createOffice(config)`), usado por `main.js`, pelos testes e, na fase 7, pela CLI |
| A4 | `collector/src/http/server.js:59-67` | Leitura de arquivo (`state.js`) dentro do handler HTTP | I/O misturado com roteamento | `collector/src/http/cloud-state-route.js` (ou removido, decisão D3) |
| A5 | `runner/src/sessions/session.js:2,55` | A sessão (aplicação) aplica o protocolo stream-json do Claude (`changesOf`) | A aplicação conhece o formato do processo externo; a porta `startProcess` fala o vocabulário do Claude | O adapter `claude/claude-process.js` traduz os eventos e chama `onChange`; a sessão só recebe mudanças |
| A6 | `runner/src/sessions/session-registry.js:1,8-14` | Registro (aplicação) faz `statSync` no disco | I/O dentro da regra; teste depende de pasta real | `runner/src/infra/is-directory.js`, injetado pela composição |
| A7 | `collector/src/main.js:9-10,21` | Endereço `0.0.0.0` fixo e `WEB_DIR`/`DATA_DIR` padrão relativos ao diretório atual | Fora do container, escutar em todas as interfaces expõe aprovações e mensagens na rede; rodar de outra pasta não acha a página | `OFFICE_HOST` com padrão `127.0.0.1` (o `Dockerfile` define `0.0.0.0`); padrões resolvidos a partir de `import.meta.url` |
| B1 | `collector/src/http/claude-routes.js:23-68` | Casos de uso (segurar permissão, segurar pergunta, entregar mensagens no fim do turno, anotar a decisão) dentro da camada HTTP, misturados com o mapeamento do protocolo | Só dá para testar subindo HTTP; regra e protocolo mudam juntos | `collector/src/control/application/*.js` e `office/application/record-activity.js`; a rota vira tradução fina |
| B2 | `collector/src/http/office-api.js:4-24,38` | Validação da resposta da decisão e a regra "quem pode receber mensagem" em `http/` | Regra de negócio na borda | `control/domain/decision-answer.js`, `office/domain/can-receive-messages.js`, `control/application/{decide-pending-request, send-message-to-agent}.js` |
| B3 | `collector/src/http/server.js:17-20` | Projeção pública do estado (esconde `meters`) na camada HTTP | É regra de privacidade; hoje ninguém a testa isolada | `collector/src/office/application/public-office-view.js` |
| B4 | `web/scripts/three/renderer.js:211-241` | Decisões de movimento (manter rota, continuar sentado quando as mesas mudam, entrar pela porta numa sala já visitada, fase da reação) dentro do renderer WebGL | Comportamento recente e visível sem nenhum teste; só dá para ver no navegador | `web/scripts/domain/behavior/movement-plan.js`, função pura; o renderer só executa |
| B5 | `web/scripts/view/office-view.js:10-14` | `needsYou` e `sortedProjects` (ordem das salas) no módulo de HTML, usados por `app/main.js:62` | Regra de ordenação presa ao renderizador | `web/scripts/domain/office/project-order.js` |
| B6 | `web/scripts/app/decision-actions.js:4-23` | O corpo da decisão (contrato com o collector) é montado lendo o DOM | O formato que o collector valida não tem teste | `domain/office/decision-body.js` (puro) e `app/decision-form.js` (lê o DOM) |
| B7 | `web/scripts/app/data-source.js:92-154` | Cada método decide entre prévia e ao vivo com `if (isDemo())`; mistura fetch, `<script>` para a nuvem (50-60) e simulação | Aberto/fechado violado: um modo novo mexe em todo método | Estratégias `infra/backends/live-backend.js` e `demo-backend.js` com os mesmos métodos; `data-source.js` escolhe uma vez |
| B8 | `web/scripts/view/status.js:1-14` | Conjuntos de status (regra) e rótulo, glifo e cor (exibição) no mesmo arquivo; `LIT` repetido em `three/renderer.js:23` e `three/room.js:19` | Se um muda e o outro não, a sala é reconstruída sem acender o monitor ou o contrário | `domain/office/agent-status.js` (`ACTIVE_STATUSES`, `statusOf`, `isScreenLit`) e `view/office/status-display.js` |
| C1 | `web/scripts/view/room-scene.js`, `web/scripts/art/{characters, iso, props, sprites, templates}.js` | Código morto: ninguém importa `room-scene.js`; os outros importam `rect` e `svg` de `art/pixels.js`, que não os exporta (falhariam ao carregar); `room-scene.js:78` chama `layoutRoom(project)` sem o tema | Ruído e falsa pista de onde mora o desenho | Apagar (decisão D1) |
| C2 | `web/scripts/view/` (22 arquivos), `three/` (13), `app/` (9), `art/` (7) | Pastas depósito; `view/` guarda regra pura com nome de apresentação | Não dá para impor regra de camada por pasta | Estrutura da seção 6.3 |
| C3 | `web/scripts/art/pixels.js` | `hashOf` e `rng`, base de toda regra determinística, numa pasta chamada `art` | Domínio dependendo de pasta de apresentação pelo nome | `web/scripts/domain/shared/seeded-random.js` |
| C4 | `web/scripts/app/main.js` | Composição e controlador da página no mesmo arquivo (195 linhas) | Dois motivos para mudar | `app/main.js` (composição) e `app/office-page.js` (estado, seleção, render, adiar render durante o clique) |
| C5 | `web/scripts/data/demo-data.js`, `data/cloud-team.js:10-32` | Lógica (simulação, mapeamento) dentro de `data/`, que deveria ser só catálogo | Um arquivo com dado e função | `infra/demo/*`, `infra/cloud/cloud-team-mapper.js`; catálogo fica em `data/` |
| C6 | `web/scripts/view/control-view.js` | Sete renderizadores de três contextos (uso do plano, pedido pendente, ficha do agente) | Arquivo com vários artefatos | `view/office/usage-view.js`, `view/sheet/pending-request-view.js`, `view/sheet/agent-sheet-view.js` |
| C7 | `web/scripts/app/main.js:58`, `app/data-source.js:20` | Formato da chave do agente (`claude:${sessionId}`) repetido; o mesmo formato vive em `collector/src/office/agent-key.js` | Conhecimento duplicado | `domain/office/live-sessions.js` (`agentKeyOfSession`) |
| C8 | `web/scripts/app/main.js:32,145`, `app/data-source.js:12-18`, `app/panel-resizer.js:9-18` | Três cópias de leitura e escrita protegida do `localStorage` | Duplicação real | `web/scripts/infra/local-preferences.js` |
| C9 | `collector/src/office/office-store.js` (211 linhas) | Chave do projeto, estatística do dia, contador de uso, regras de expiração e o agregado no mesmo arquivo; `:161` interpreta a chave com `split(":")` fora de `agent-key.js` | Regras de TTL sem teste isolado | `office/domain/{project-key, daily-stats, agent-expiry}.js`, `agent-key.js` ganha `sessionIdOfKey` |
| C10 | `collector/src/events/describe-tool.js:1-7` e `events/tool-summary.js:3-6` | Os mesmos conjuntos de nomes de ferramenta declarados duas vezes | Ferramenta nova entra num lugar e não no outro | `collector/src/shared/claude/tool-names.js` |
| C11 | `collector/src/http/request-guard.js` | Política de host e origem (segurança) junto com leitura e escrita de JSON (I/O) | Duas responsabilidades | `http/request-policy.js` e `http/json-io.js` |
| C12 | `runner/src/http/server.js:6,40` e `sessions/session-registry.js:6,30` | Limite de 8 000 caracteres da mensagem declarado duas vezes, validado em camadas diferentes | Duplicação; mensagem e primeira mensagem podem divergir | `runner/src/sessions/message-text.js` |
| C13 | `hooks/install-claude-hooks.mjs:35,60-75`; `hooks/install-codex-notify.mjs:11-29` | Transformação pura misturada com I/O e `process.exit`; `remove` lido de `process.argv` como global escondido; zero teste | Os instaladores reescrevem o `settings.json` e o `config.toml` do usuário | `hooks/lib/{claude-settings, codex-config}.mjs` puros e testados |
| C14 | `hooks/*.mjs` | `OFFICE_URL` x4, `readStdin` x2, carimbo de backup x2 | Duplicação | `hooks/lib/{office-url, read-stdin, config-backup}.mjs` |
| C15 | Contratos em texto entre pacotes: `web/scripts/view/agent-thoughts.js:8` lê "editando X", "rodando X" gerados em `collector/src/events/describe-tool.js:29-56`; `web/scripts/view/terminal-format.js:3-4` lê "Ferramenta: resumo" e "Escrever X" gerados em `collector/src/events/tool-summary.js:25`, `events/claude-history.js:19` e `runner/src/sessions/transcript.js:13` | Contrato implícito em frase em português | Mudar uma palavra no collector apaga pensamentos e cores do terminal sem quebrar teste; também impede uma versão em inglês | Já na fase 3: teste de contrato. Opcional (D6): campos estruturados na fase 5 |
| C16 | `collector/src/http/office-api.js:38` e `web/scripts/view/agent-rules.js:3`; `collector/src/office/templates.js:1` e `web/scripts/art/themes.js:6-53` | Mesma regra e mesma lista de ids nos dois processos | Divergência silenciosa; a lista de temas é o que o campus precisa preservar | Teste de contrato no web que importa os módulos do collector |
| C17 | `web/scripts/view/room-places.js:15-19,62` e `web/scripts/three/commons.js:7-10,40` | Posições das cadeiras da reunião e do sofá declaradas duas vezes (0,9 contra 0,82; ±0,42) | Mover um móvel deixa alguém sentado no ar; o campus move reunião e lounge para salas comuns | `domain/room/room-dimensions.js` lido pelos dois |
| C18 | Números mágicos: `collector/src/http/claude-routes.js:13-18` (500, 40, 120, 300), `events/claude-event.js:23,54,56` (40, 30), `events/claude-history.js:22` (60), `events/describe-tool.js:18,40,54,56` (24, 40, 30), `events/tool-summary.js:37` (60), `main.js:25` (30 000), `runner/src/main.js:22` (6 000), `web/scripts/app/main.js:192` (30 000) | Limites sem nome | Intenção escondida | Constantes nomeadas no arquivo de destino |
| C19 | `web/scripts/three/furniture.js:10` e `three/office-walls.js:11` | `pickOf` duplicado | Duplicação pequena | `pickWith(random, list)` em `domain/shared/seeded-random.js` |
| C20 | `collector/src/office/persistence.js:25-29` | `load()` engole JSON corrompido sem log | Arquivo estragado vira escritório vazio sem pista | Logar o caso de arquivo corrompido e continuar devolvendo `null` |
| C21 | Nomes curtos: `collector/src/office/office-store.js:62` (`a`), `web/scripts/view/office-view.js:10,13,29,50,57,75` (`a`, `p`, `t`), `view/format.js:5,9` (`s`, `c`) | Nomes sem intenção | Leitura | Renomear no passo em que o arquivo for mexido |
| C22 | `web/styles/office.css:80` | `rgb(0 0 0 / 0.35)` cru numa sombra | O design system proíbe cor crua | Token de sombra em `tokens.css` |
| C23 | `web/scripts/view/room-layout.js:37-160` | Ilhas de mesas, área comum (reunião, lounge, divisórias), parede do fundo e corredores calculados num arquivo só | Uma sala é o único formato possível; o campus precisaria reescrever | `domain/room/desk-islands.js`, `domain/room/room-zones.js`, `domain/room/room-layout.js` (compõe) |
| C24 | `web/scripts/view/room-places.js:35-121` | O catálogo de pontos da sala (mesas, atividades, porta) e a escolha de quem vai para onde no mesmo arquivo | A escolha só funciona sobre uma sala; o campus precisa da mesma escolha sobre o prédio | `domain/room/room-spots.js` (catálogo) e `domain/behavior/room-places.js` (escolha sobre um catálogo) |

## 6. Estrutura alvo

Convenções mantidas: arquivos em kebab-case, fábricas `createX`, sem classes, sem sufixos de camada no nome. A pasta diz a camada; o nome diz o que o arquivo faz.

### 6.1 collector

```text
collector/src/
  main.js                              lê env (PORT, OFFICE_HOST, DATA_DIR, WEB_DIR, SITE_DIR...), chama createOffice, listen, encerramento limpo
  composition.js                       createOffice(config): adapters, casos de uso e servidor; sem process.env, sem cwd
  shared/                              API pública para o runner; não importa nada fora de shared/
    text/clip.js
    claude/tool-names.js               nomes de ferramenta por tipo (leitura, edição, escrita, comando...)
    claude/summarize-tool.js           resumo e detalhe de uma chamada de ferramenta
  office/                              salas, agentes, uso do plano
    domain/
      office-store.js                  agregado: apply, recordUsage, sweep, setTemplate, closeProject, findAgent, snapshot, onChange
      agent-key.js                     + sessionIdOfKey
      project-key.js
      path-name.js                     baseName
      daily-stats.js                   dayOf, freshStats, growthOf (fase 6 acrescenta tempo por status aqui)
      agent-expiry.js                  regras e prazos do sweep
      templates.js
      can-receive-messages.js
    application/
      record-activity.js               aplica o evento e grava a entrada no histórico
      public-office-view.js            estado público sem meters, com pendentes e fila
    infra/
      office-state-file.js             era persistence.js
  control/                             pedidos segurados e mensagens na fila
    domain/
      pending-decisions.js
      outbox.js
      decision-answer.js
    application/
      hold-permission.js
      hold-question.js
      deliver-queued-messages.js
      decide-pending-request.js
      send-message-to-agent.js
  history/
    session-history.js
  claude/                              adapter do protocolo do Claude Code (entrada e saída)
    claude-event.js
    claude-history-entry.js
    describe-activity.js               era describe-tool.js, sem baseName
    hook-questions.js                  questionsOf, saneamento das perguntas
    hook-responses.js
    statusline-reading.js
  codex/
    codex-event.js
  http/
    server.js                          roteador: guarda de host e despacho
    hook-routes.js                     payload → adapter claude → caso de uso → resposta do hook
    office-api-routes.js               /api/*
    cloud-state-route.js               /cloud/state.js (some se D3 remover a aba)
    event-stream.js
    static-files.js
    request-policy.js                  createHostPolicy, isSameOrigin, isJson
    json-io.js                         readJsonBody, sendJson
```

Imports permitidos:

| Camada | Pode importar |
|---|---|
| `shared/` | só `shared/` |
| `*/domain/` | o próprio `domain/`, outro `*/domain/`, `shared/` |
| `*/application/` | `domain/`, `history/`, `shared/` |
| `claude/`, `codex/` | `office/domain/`, `shared/` |
| `http/` | `application/`, `domain/`, `claude/`, `codex/`, `history/`, `shared/`, `node:http` |
| `*/infra/` | `domain/`, `node:*` |
| `composition.js`, `main.js` | tudo |

### 6.2 runner

```text
runner/src/
  main.js                              lê env, chama createRunner, listen, encerramento (caminho fixo, README)
  composition.js                       createRunner(config): launcher, registro e servidor; usado por main, testes e CLI
  sessions/                            aplicação
    session.js                         recebe mudanças, não eventos do Claude
    session-registry.js                recebe isDirectory injetado
    message-text.js                    apara e limita a mensagem (8 000)
  claude/                              adapter do processo do Claude Code
    claude-process.js                  spawn; traduz eventos em mudanças e chama onChange
    json-lines.js                      lineReader e parseEvent
    stream-changes.js                  era transcript.js; importa collector/src/shared
  infra/
    is-directory.js
  http/
    server.js
    request-guard.js
```

Imports permitidos: `sessions/` só `sessions/` (nada de `node:child_process`, `node:fs`, `http/`, `claude/`). `claude/` importa `node:child_process`, `collector/src/shared/` e nada de `http/`. Fora de `runner/`, só `collector/src/shared/`.

### 6.3 web

```text
web/
  index.html                           inalterado (carrega scripts/app/main.js)
  styles/                              inalterado (token de sombra novo em tokens.css)
  vendor/                              intocado
  scripts/
    app/                               composição e controladores do DOM, sem regra
      main.js                          composição: modo (ao vivo ou ?modo=demo), fonte de dados, painéis, renderer
      office-page.js                   estado da página, seleção, render, adiar render durante o clique
      data-source.js                   recebe o backend escolhido; junta nuvem e executor
      agent-panel.js
      terminal-pane.js
      panel-resizer.js
      new-session-dialog.js
      decision-form.js                 era decision-actions.js: lê o cartão e chama buildDecision
    domain/                            regra pura: sem DOM, three, fetch, storage, Date.now
      shared/seeded-random.js          hashOf, rng, pick, pickWith (era art/pixels.js)
      office/
        agent-status.js                ACTIVE_STATUSES, statusOf, isScreenLit
        agent-names.js
        can-receive-messages.js        era view/agent-rules.js
        project-order.js               needsYou, sortedProjects
        live-sessions.js               agentKeyOfSession, liveSessionOf, liveAgentsOf
        decision-body.js               buildDecision
      behavior/
        agent-reactions.js
        agent-temperament.js
        free-time-clock.js
        seated-fidgets.js
        agent-thoughts.js
        room-places.js                 quem vai para onde, sobre um catálogo de pontos
        movement-plan.js               decisões extraídas de three/renderer.js; recebe routeFor(from, to)
      conversations/
        conversations.js
        conversation-tracker.js
      room/                            uma sala em coordenadas locais
        room-layout.js                 compõe ilhas de mesas e zonas
        desk-islands.js                times, ilhas, mesas vagas e reservadas
        room-zones.js                  porta, parede do fundo, reunião, lounge, divisórias, cantos, plantas, corredores
        room-spots.js                  catálogo de pontos: mesas, atividades de tempo livre, porta
        room-routes.js
        wall-plan.js
        room-dimensions.js             âncoras de cadeira, sofá e mesa lidas também pelo three/ (C17)
      terminal/
        terminal-format.js
    data/                              catálogos, sem lógica e sem imports
      themes.js                        era art/themes.js; os 7 temas, intactos
      first-names.js
      thoughts.js
      conversation-lines.js            era data/conversations.js (evita nome igual ao do domínio)
      terminal-tools.js
      cloud-roles.js                   ROLE_LABELS e CLOUD_KEY (some se D3 remover a aba)
    infra/                             mundo externo
      office-api.js
      runner-client.js
      local-preferences.js
      backends/live-backend.js
      backends/demo-backend.js
      demo/demo-world.js               estado de exemplo e simulação (tick, resolver, fila)
      demo/demo-terminal.js            histórico e terminal de exemplo
      cloud/cloud-state-loader.js      <script> de /cloud/state.js (some com D3)
      cloud/cloud-team-mapper.js       cloudProject (some com D3)
    view/                              HTML em string, formatação, ícones; sem estado
      shared/escape-html.js
      shared/format.js
      shared/icons.js
      office/tabs-view.js
      office/team-view.js
      office/room-view.js              renderOffice (com o seletor "Escritório"), renderNoProjects
      office/agent-badges.js           agentMark, statusBadge, originOf
      office/usage-view.js
      office/status-display.js         STATUS (rótulo, glifo, cor por token), describeStatus
      sheet/pending-request-view.js
      sheet/agent-sheet-view.js
      terminal/terminal-entries.js
      terminal/terminal-markdown.js
    three/                             cena 3D
      kit.js
      scene/renderer.js                loop, show, orquestração
      scene/camera-framing.js          enquadramento; vira controle de câmera com zoom e pan na fase 6
      scene/name-tags.js               etiquetas, placas de mesa reservada
      scene/thought-bubble.js
      people/people.js
      people/looks.js                  paletas de camisa, cabelo e pele
      people/poses.js
      people/reactions.js
      people/emotes.js
      furniture/room.js                monta uma sala a partir do layout e do tema dela, numa origem dada
      furniture/commons.js
      furniture/decor.js
      furniture/furniture.js
      furniture/office-walls.js
      furniture/parts.js
  test/                                mesmos arquivos, imports atualizados, mais os novos da fase 3
```

Imports permitidos:

| Pasta | Pode importar |
|---|---|
| `data/` | nada |
| `domain/` | `domain/`, `data/` |
| `view/` | `domain/`, `data/`, `view/`; `vendor/` só em `view/terminal/terminal-markdown.js` |
| `three/` | `domain/`, `data/`, `three/`; `vendor/` só em `three/kit.js` |
| `infra/` | `domain/`, `data/`, `infra/` |
| `app/` | tudo acima |

Por que manter o nome `view/`: é a convenção do projeto, e hoje o nome está errado só para metade dos arquivos. Saindo a regra pura para `domain/`, `view/` passa a dizer a verdade.

Por que `room-places.js` vai para `behavior/` e não para `room/`: escolher para onde cada agente vai é comportamento; a sala só fornece o catálogo de pontos. Essa separação é a costura do campus (seção 11.1).

### 6.4 hooks

```text
hooks/
  install-claude-hooks.mjs             CLI fino: lê, faz backup, chama lib, grava, mensagens e código de saída
  install-codex-notify.mjs             idem
  office-session-start.mjs             caminho fixo (gravado no settings.json)
  office-statusline.mjs                caminho fixo
  lib/
    office-url.mjs
    read-stdin.mjs
    config-backup.mjs                  carimbo e cópia .bak-<data>
    claude-settings.mjs                withOfficeHooks, withOfficeStatusline: puros, recebem { isRemoving, officeUrl, hooksDir }
    codex-config.mjs                   applyNotify(lines, { isRemoving, officeUrl }) → { lines } ou { error }
    status-line-text.mjs               lineOf
  test/
    claude-settings.test.mjs
    codex-config.test.mjs
    status-line-text.test.mjs
```

Sem camadas aqui: são scripts. O ganho é separar a transformação pura (testável) do I/O, porque um erro nela estraga a configuração do usuário. Receber `hooksDir` e `officeUrl` como parâmetro é o que permite à CLI da fase 7 instalar a partir de outra pasta.

## 7. Onde a cerimônia não se paga

- **Sem `src/modules/<x>/` no collector.** São três contextos e cerca de 30 arquivos; um nível a mais só alonga os imports.
- **Sem interface de repositório para o `office-store`.** Uma implementação, em memória, pura. A persistência recebe o snapshot pronto. O adapter de arquivo é injetado como objeto simples pela composição, sem contrato formal.
- **Sem porta para relógio e id.** `now` já é injetado onde importa (`pending-decisions`, `session`, `session-registry`). `randomUUID` não é verificado por nenhum teste.
- **Sem caso de uso para ações que só repassam:** `setTemplate`, `closeProject`, `historyOf`, `recordUsage`. A rota chama o store ou o histórico direto.
- **Sem `config.js` separado.** O env é lido só no `main.js`; a composição recebe um objeto. A CLI monta o próprio objeto.
- **Sem compartilhar `isJson` e `readJsonBody` entre collector e runner.** A cópia tem 20 linhas e manter os pacotes independentes vale mais que a deduplicação. Só o resumo de ferramenta, que é contrato com o web, fica compartilhado.
- **Sem porta para `officeApi` e `runnerClient` isolados no web.** A porta com duas implementações reais é o backend (ao vivo e prévia). É lá que a abstração se paga.
- **Sem nomear cada coordenada e ângulo** em `three/` (móveis, poses, emotes). São dados de modelagem; constante nomeada só para o que é compartilhado com o domínio (C17).
- **Sem DTO nem mapper novo.** Os dados já cruzam como objetos simples; os adapters `claude/` e `codex/` são os mappers.
- **`history/` com um arquivo só, sem subpasta de camada.**
- **Sem JSDoc de tipo em todo lugar.** O contrato das duas estratégias de backend é garantido por teste (mesmos métodos), não por comentário.
- **Sem antecipar o campus em código.** A refatoração só separa o que já existe (ilhas, zonas, catálogo de pontos, rota injetada, sala montável numa origem); nenhuma planta de prédio, sala comum, tema de campus ou câmera com zoom entra antes da fase 6.
- **Sem separar o tema em "paleta" e "planta de mobília".** Hoje um tema traz cores e a lista de itens de parede, cantos e objetos de chão. O campus usa os dois juntos na sala do projeto, então dividir não compra nada.

## 8. Acoplamento runner → collector

`runner/src/sessions/transcript.js:1` importa `clip` e `summarizeTool` de `collector/src/events/tool-summary.js` porque o terminal ao vivo (runner) e o histórico (collector) precisam produzir o mesmo texto, que o web interpreta (`terminal-format.js`).

| Opção | Como | Prós | Contras |
|---|---|---|---|
| 1. `collector/src/shared/` como API pública (recomendada) | O código sai de `events/` para `collector/src/shared/claude/summarize-tool.js` e `shared/text/clip.js`. `shared/` não importa nada fora de si. O runner só pode importar de lá. Dois testes de arquitetura garantem as duas regras. | Docker intocado (`shared/` já está em `src/`). Contrato explícito e verificado. Uma fonte para o texto que o web lê. O pacote npm da fase 7 mantém o layout do repositório, então o caminho relativo continua valendo. | O runner continua precisando do collector ao lado, o que já é o caso hoje e no pacote npm. |
| 2. Pacote `shared/` na raiz | `shared/claude/...`, importado pelos dois | Simetria | O contexto do build é `./collector`: exigiria contexto na raiz, mudar `Dockerfile` e `compose.yaml` e criar `.dockerignore`, senão o `.env` e os arquivos soltos entram no contexto. Fere a restrição de a imagem copiar só `collector/src`. |
| 3. Duplicar no runner | Cópia em `runner/src/claude/summarize-tool.js` com teste que compara as duas cópias | Pacotes totalmente independentes | Duas cópias de um contrato; o teste de igualdade é a única defesa |

Recomendo a opção 1. A opção 3 passa a valer só se o runner um dia for distribuído sem o collector.

Execução sem quebrar a fase seguinte: na fase 1, `collector/src/events/tool-summary.js` vira reexportação de `shared/` (o runner segue funcionando). Na fase 2, o runner aponta para `shared/` e o último passo apaga a reexportação, depois de um `grep` confirmar que ninguém mais a importa.

## 9. Arquivo atual → destino

### 9.1 collector

| Atual | Destino |
|---|---|
| `src/main.js` | fica; só lê env (com `OFFICE_HOST`), chama `createOffice`, listen e shutdown |
| (novo) | `src/composition.js` |
| `src/control/hook-responses.js` | `src/claude/hook-responses.js` |
| `src/control/outbox.js` | `src/control/domain/outbox.js` |
| `src/control/pending-decisions.js` | `src/control/domain/pending-decisions.js` |
| `src/events/claude-event.js` | `src/claude/claude-event.js` |
| `src/events/claude-history.js` | `src/claude/claude-history-entry.js` |
| `src/events/codex-event.js` | `src/codex/codex-event.js` |
| `src/events/describe-tool.js` | `src/claude/describe-activity.js`; `baseName` → `src/office/domain/path-name.js`; conjuntos → `src/shared/claude/tool-names.js` |
| `src/events/statusline-reading.js` | `src/claude/statusline-reading.js` |
| `src/events/tool-summary.js` | `src/shared/claude/summarize-tool.js` + `src/shared/text/clip.js` (reexportação temporária até o passo 2.2) |
| `src/http/claude-routes.js` | `src/http/hook-routes.js` (fino) + `src/control/application/{hold-permission, hold-question, deliver-queued-messages}.js` + `src/office/application/record-activity.js` + `src/claude/hook-questions.js` |
| `src/http/event-stream.js` | fica |
| `src/http/office-api.js` | `src/control/application/{decide-pending-request, send-message-to-agent}.js` + `src/control/domain/decision-answer.js` + `src/office/domain/can-receive-messages.js`; rotas em `src/http/office-api-routes.js` |
| `src/http/request-guard.js` | `src/http/request-policy.js` + `src/http/json-io.js` |
| `src/http/server.js` | fica como roteador; `publicView` → `src/office/application/public-office-view.js`; `state.js` → `src/http/cloud-state-route.js` |
| `src/http/static-files.js` | fica |
| `src/office/agent-key.js` | `src/office/domain/agent-key.js` (+ `sessionIdOfKey`) |
| `src/office/office-store.js` | `src/office/domain/office-store.js` + `project-key.js`, `daily-stats.js`, `agent-expiry.js` |
| `src/office/persistence.js` | `src/office/infra/office-state-file.js` |
| `src/office/session-history.js` | `src/history/session-history.js` |
| `src/office/templates.js` | `src/office/domain/templates.js` |
| `test/claude-event.test.js`, `office-control.test.js`, `office-store.test.js`, `server.test.js`, `tool-summary.test.js` | ficam, imports atualizados; `office-control` e `server` passam a usar `createOffice` |
| (novos) | `test/persistence.test.js`, `test/session-history.test.js`, `test/office-rules.test.js`, `test/control-use-cases.test.js`, `test/architecture.test.js` |
| `Dockerfile` | ganha `OFFICE_HOST=0.0.0.0` no `ENV` (e perde `SITE_DIR` se D3 remover a aba) |
| `package.json` | inalterado |

### 9.2 runner

| Atual | Destino |
|---|---|
| `src/main.js` | fica; lê env e chama `createRunner`; `SHUTDOWN_GRACE_MS` |
| (novo) | `src/composition.js` |
| `src/http/server.js` | fica; usa `sessions/message-text.js` |
| `src/http/request-guard.js` | fica |
| `src/sessions/claude-process.js` | `src/claude/claude-process.js` (+ `src/claude/json-lines.js`) |
| `src/sessions/session.js` | fica; recebe mudanças por `onChange` |
| `src/sessions/session-registry.js` | fica; `isDirectory` injetado |
| `src/sessions/transcript.js` | `src/claude/stream-changes.js` |
| (novos) | `src/infra/is-directory.js`, `src/sessions/message-text.js` |
| `test/runner.test.js` | fica; o processo falso passa os eventos por `changesOf` |
| (novos) | `test/json-lines.test.js`, `test/session-registry.test.js`, `test/session.test.js`, `test/architecture.test.js` |

### 9.3 web

| Atual | Destino |
|---|---|
| `scripts/app/main.js` | `scripts/app/main.js` (composição) + `scripts/app/office-page.js` |
| `scripts/app/agent-panel.js` | fica |
| `scripts/app/data-source.js` | fica (recebe o backend) + `scripts/infra/backends/{live-backend, demo-backend}.js` + `scripts/domain/office/live-sessions.js` |
| `scripts/app/decision-actions.js` | `scripts/app/decision-form.js` + `scripts/domain/office/decision-body.js` |
| `scripts/app/new-session-dialog.js` | fica |
| `scripts/app/office-api.js` | `scripts/infra/office-api.js` |
| `scripts/app/panel-resizer.js` | fica; usa `infra/local-preferences.js` |
| `scripts/app/runner-client.js` | `scripts/infra/runner-client.js` |
| `scripts/app/terminal-pane.js` | fica |
| `scripts/art/pixels.js` | `scripts/domain/shared/seeded-random.js` |
| `scripts/art/themes.js` | `scripts/data/themes.js` (conteúdo intacto) |
| `scripts/art/characters.js`, `iso.js`, `props.js`, `sprites.js`, `templates.js` | apagar (D1) |
| `scripts/data/cloud-team.js` | `scripts/data/cloud-roles.js` + `scripts/infra/cloud/cloud-team-mapper.js` (ou apagar, D3) |
| `scripts/data/conversations.js` | `scripts/data/conversation-lines.js` |
| `scripts/data/demo-data.js` | `scripts/infra/demo/demo-world.js` + `scripts/infra/demo/demo-terminal.js` |
| `scripts/data/first-names.js`, `terminal-tools.js`, `thoughts.js` | ficam |
| `scripts/three/renderer.js` | `scripts/three/scene/renderer.js` + `scene/camera-framing.js` + `scene/name-tags.js` + `scripts/domain/behavior/movement-plan.js` |
| `scripts/three/thought-bubble.js` | `scripts/three/scene/thought-bubble.js` |
| `scripts/three/people.js` | `scripts/three/people/people.js` + `people/looks.js` |
| `scripts/three/poses.js`, `reactions.js`, `emotes.js` | `scripts/three/people/` |
| `scripts/three/room.js`, `commons.js`, `decor.js`, `furniture.js`, `office-walls.js`, `parts.js` | `scripts/three/furniture/` |
| `scripts/three/kit.js` | fica |
| `scripts/view/agent-names.js` | `scripts/domain/office/agent-names.js` |
| `scripts/view/agent-reactions.js` | `scripts/domain/behavior/agent-reactions.js` |
| `scripts/view/agent-rules.js` | `scripts/domain/office/can-receive-messages.js` |
| `scripts/view/agent-temperament.js` | `scripts/domain/behavior/agent-temperament.js` |
| `scripts/view/agent-thoughts.js` | `scripts/domain/behavior/agent-thoughts.js` |
| `scripts/view/control-view.js` | `scripts/view/office/usage-view.js` + `scripts/view/sheet/{pending-request-view, agent-sheet-view}.js` |
| `scripts/view/conversation-tracker.js`, `conversations.js` | `scripts/domain/conversations/` |
| `scripts/view/format.js` | `scripts/view/shared/format.js` + `scripts/view/shared/escape-html.js` |
| `scripts/view/free-time-clock.js`, `seated-fidgets.js` | `scripts/domain/behavior/` |
| `scripts/view/icons.js` | `scripts/view/shared/icons.js` |
| `scripts/view/office-view.js` | `scripts/view/office/{tabs-view, team-view, room-view, agent-badges}.js` + `scripts/domain/office/project-order.js` |
| `scripts/view/room-layout.js` | `scripts/domain/room/room-layout.js` + `desk-islands.js` + `room-zones.js` |
| `scripts/view/room-places.js` | `scripts/domain/room/room-spots.js` (catálogo) + `scripts/domain/behavior/room-places.js` (escolha) |
| `scripts/view/room-routes.js`, `wall-plan.js` | `scripts/domain/room/` |
| `scripts/view/room-scene.js` | apagar (D1) |
| `scripts/view/status.js` | `scripts/domain/office/agent-status.js` + `scripts/view/office/status-display.js` |
| `scripts/view/terminal-entries.js`, `terminal-markdown.js` | `scripts/view/terminal/` |
| `scripts/view/terminal-format.js` | `scripts/domain/terminal/terminal-format.js` |
| (novos) | `scripts/infra/local-preferences.js`, `scripts/infra/cloud/cloud-state-loader.js`, `scripts/domain/room/room-dimensions.js` |
| `index.html`, `styles/*`, `vendor/*` | ficam |
| `test/agent-behavior.test.js`, `agent-conversations.test.js`, `terminal-format.test.js` | ficam, imports atualizados |
| (novos) | `test/architecture.test.js`, `test/contracts.test.js`, `test/room-rules.test.js`, `test/office-rules.test.js`, `test/views.test.js`, `test/backends.test.js`, `test/movement-plan.test.js` |

### 9.4 hooks

| Atual | Destino |
|---|---|
| `install-claude-hooks.mjs` | fica (CLI) + `lib/claude-settings.mjs` |
| `install-codex-notify.mjs` | fica (CLI) + `lib/codex-config.mjs` |
| `office-session-start.mjs` | fica; usa `lib/office-url.mjs`, `lib/read-stdin.mjs` |
| `office-statusline.mjs` | fica; usa `lib/office-url.mjs`, `lib/read-stdin.mjs`, `lib/status-line-text.mjs` |
| (novos) | `lib/config-backup.mjs`, `test/*.test.mjs` |

### 9.5 Raiz (todos: decisão do usuário)

| Arquivo | Quem referencia | Proposta |
|---|---|---|
| `state.js` | `collector/src/http/server.js:61` (via `SITE_DIR`, montagem `./:/site:ro` em `compose.yaml:12`), `index.html:285` da raiz, `README.md:41`. O conteúdo atual tem `closedAt` e `archivedAgents`, sem `agents`, então `cloudProject` (`web/scripts/data/cloud-team.js:13`) devolve `null` e a aba "time na nuvem" não aparece hoje | D3: manter ou remover junto com a aba |
| `state-sync.js`, `state-sync-0718b.js`, `state-sync-0727.js`, `state-sync-closed-0736.js` | nenhuma referência no projeto (busca por nome) | D2: tirar do projeto |
| `handoff-patch-0726.py`, `handoff-note-0741.py` | nenhuma; editam um `HANDOFF.md` de outro projeto recebido por argumento | D2 |
| `rename-skills-0740.py` | nenhuma; renomeia skills numa árvore `.claude` recebida por argumento | D2 |
| `claude-manifest-0400.txt` | nenhuma; manifesto sha256 do `.claude/` de outro projeto | D2 |
| `index.html` (raiz) | nenhuma; página antiga "Escritório do Orquestra" que lê `state.js` (linha 285) e usa `window.claude` (artefato do claude.ai); o coletor não a serve (`WEB_DIR` aponta para `web/`) | D4 |
| `nginx.conf` | nenhuma (nem `compose.yaml` nem `Dockerfile`); serviria o `index.html` da raiz | D4 |
| `compose.yaml`, `compose.lan.yaml` | uso normal | ficam; com D3 = remover, sai `./:/site:ro` |
| `.env` | `compose.lan.yaml` | fica; entra no `.gitignore` antes do primeiro commit (D5) |

## 10. Plano de execução da refatoração

### 10.1 Comandos de verificação

Definidos uma vez e citados nos passos pelo nome.

**V-C (collector)**

```powershell
Push-Location collector; npm test; Pop-Location
```

```bash
(cd collector && npm test)
```

**V-R (runner)**

```powershell
Push-Location runner; npm test; Pop-Location
```

```bash
(cd runner && npm test)
```

**V-W (web): testes e sintaxe de cada arquivo**

```powershell
node --test web/test/*.test.js
Get-ChildItem web/scripts -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName; if ($LASTEXITCODE) { throw "syntax: $($_.FullName)" } }
```

```bash
node --test web/test/*.test.js
find web/scripts -name '*.js' -print0 | xargs -0 -n1 node --check
```

O `node --check` só confere sintaxe; caminho de import quebrado passa. Quem pega import quebrado é `web/test/architecture.test.js` (passo 3.1), que precisa existir antes de qualquer arquivo do web mudar de lugar. Se o `node --check` acusar "Cannot use import statement outside a module", a versão do Node não detecta ESM sozinha: atualize o Node 22 (os testes do web já dependem dessa detecção).

**V-H (hooks)**

```powershell
node --test hooks/test/*.test.mjs
Get-ChildItem hooks -Recurse -Filter *.mjs | ForEach-Object { node --check $_.FullName; if ($LASTEXITCODE) { throw "syntax: $($_.FullName)" } }
```

```bash
node --test hooks/test/*.test.mjs
find hooks -name '*.mjs' -print0 | xargs -0 -n1 node --check
```

**V-Docker (imagem do collector)**

```powershell
docker compose up -d --build
(Invoke-WebRequest http://127.0.0.1:8420/api/state -UseBasicParsing).StatusCode
```

```bash
docker compose up -d --build
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8420/api/state
```

Esperado: `200`.

**V-Browser (manual)**

- Ao vivo: `http://localhost:8420` com o container no ar. O `web/` é montado no container, então mudança no web aparece só recarregando a página; mudança no collector exige V-Docker.
- Prévia com dados de exemplo: no DevTools, aba Network, bloqueie a URL `/api/state` e recarregue (a página cai no modo prévia); depois do passo 3.10, `http://localhost:8420/?modo=demo` faz o mesmo. Alternativa: `py -m http.server 8000 --directory web` (Windows) ou `python3 -m http.server 8000 --directory web` (macOS) e abrir `http://localhost:8000`. No Windows, se os módulos não carregarem por tipo MIME, use o bloqueio no DevTools.
- Roteiro: sala "reações" (todos os gestos, o boneco que anda, pensamentos, ninguém em sincronia), sala "orquestra" (subagente que chega, delegação com fala, entrega em mãos e saída pela porta), ficha do agente (terminal com markdown, diff, copiar, expandir, "novas linhas"), pedido de permissão e pergunta de exemplo (aprovar, negar com motivo, responder), trocar o tema pelo seletor "Escritório" passando pelos 7, alargar o painel, fechar sala, Esc fecha a ficha, console sem erro.

### 10.2 Fase 0: rede de segurança e decisões

Sem código de aplicação. Uma pessoa ou um agent por vez.

| Passo | Agent | Arquivos | Verificação | Esperado |
|---|---|---|---|---|
| 0.1 Criar o ponto de volta (D5). Recomendado: `.gitignore` com `.env`, `collector/data/`, `node_modules/`, `_site/`; depois `git init`, `git add -A`, commit da linha de base. Alternativa: um zip por fase (`Compress-Archive -Path collector,runner,web,hooks,docs,README.md,compose.yaml -DestinationPath ..\orquestra-office-antes-fase-N.zip`, no Git Bash `tar -czf ../orquestra-office-antes-fase-N.tgz collector runner web hooks docs README.md compose.yaml`) | `productivity-git-release` | `.gitignore` | `git status` limpo depois do commit | ponto de volta para cada passo |
| 0.2 Linha de base | sessão principal | nenhum | V-C, V-R, V-W, V-Browser (anotar contagem de testes e capturas das salas "reações" e "orquestra" e de uma sala em cada um dos 7 temas) | tudo verde; se algo falhar, corrigir antes, fora deste plano |
| 0.3 Respostas para D1 a D10 (seção 12) | usuário | nenhum | nenhuma | decisões registradas no ADR |
| 0.4 Se D2, D3 ou D4 pedirem remoção, aplicar agora (um commit por decisão), porque diminui o que as fases movem | `productivity-refactor` | arquivos da raiz e, para D3, os pontos listados na seção 12 | V-C, V-W, V-Docker, V-Browser | sem regressão |

### 10.3 Fase 1: collector

Agent de escrita: `productivity-test-engineer` no 1.1; `productivity-refactor` do 1.2 ao 1.9. JavaScript ESM, sem TypeScript, sem dependência nova.

| Passo | Arquivos | Verificação | Esperado | Caracterização antes? |
|---|---|---|---|---|
| 1.1 Testes de caracterização: `persistence.test.js` (gravar e ler numa pasta temporária, arquivo corrompido devolve `null`, gravação atômica deixa o `.json` final); `session-history.test.js` (corte em 200 por agente, despejo depois de 300 agentes); em `office-store.test.js`, prazos do `sweep` por tipo (subagente 15 min, sessão encerrada 30 min, silêncio 6 h, sala parada 30 dias, limpeza de `sessions` e `meters`), virada do dia zera estatística, contador que volta (como `/clear`) soma só o novo; `architecture.test.js` com a primeira regra: todo import relativo resolve e nada em `src/` importa fora de `src/` | `collector/test/*` | V-C | tudo verde sem tocar `src/` | este é o passo de caracterização |
| 1.2 `shared/`: `text/clip.js`, `claude/tool-names.js`, `claude/summarize-tool.js`; `events/tool-summary.js` vira reexportação; `events/describe-tool.js` usa `tool-names.js` (edição de `describe-activity` = Edit e MultiEdit unidos a Write e NotebookEdit, como hoje) | `src/shared/**`, `src/events/tool-summary.js`, `src/events/describe-tool.js`, `test/tool-summary.test.js` | V-C e V-R | verde nos dois pacotes | coberto por `claude-event` e `tool-summary` |
| 1.3 `office/domain/` e `office/infra/`: `path-name.js`, `agent-key.js` (+ `sessionIdOfKey`), `templates.js`, `project-key.js`, `daily-stats.js`, `agent-expiry.js`, `office-store.js` enxuto; `persistence.js` → `office/infra/office-state-file.js`. Preparo para a fase 6: `daily-stats.js` isolado é onde entra o tempo por status | `src/office/**`, `src/events/describe-tool.js`, `src/events/claude-history.js`, `src/main.js`, testes | V-C | verde; A2 resolvida | 1.1 |
| 1.4 Adapters: `events/*` (menos a reexportação) → `claude/` e `codex/`; `control/hook-responses.js` → `claude/`; `questionsOf` → `claude/hook-questions.js` | `src/claude/**`, `src/codex/**`, `src/http/claude-routes.js`, `src/http/server.js`, testes | V-C | verde | coberto |
| 1.5 `control/domain/`: `pending-decisions.js`, `outbox.js`, `decision-answer.js` (de `office-api.js`); `office/domain/can-receive-messages.js` | `src/control/**`, `src/office/domain/**`, `src/http/office-api.js`, testes | V-C | verde | coberto por `office-control.test.js` |
| 1.6 Casos de uso: `control/application/*` e `office/application/{record-activity, public-office-view}.js`; `http/hook-routes.js` e `http/office-api-routes.js` finos; `office-api.js` e `claude-routes.js` deixam de existir. Teste novo `control-use-cases.test.js` com store real e espera curta, sem HTTP | `src/control/application/**`, `src/office/application/**`, `src/http/**`, testes | V-C | `office-control.test.js` passa sem nenhuma mudança de asserção | `office-control.test.js` é a caracterização |
| 1.7 Composição: `composition.js` com `createOffice(config)`, sem `process.env` e sem caminho relativo ao diretório atual; `server.js` sem dependência padrão; `request-guard.js` → `request-policy.js` + `json-io.js`; rota de `state.js` em `cloud-state-route.js` (ou removida em 0.4). Preparo para a fase 7: `main.js` lê `OFFICE_HOST` com padrão `127.0.0.1` e o `Dockerfile` passa a definir `OFFICE_HOST=0.0.0.0`; padrões de `WEB_DIR` e `DATA_DIR` resolvidos a partir de `import.meta.url` (A7) | `src/composition.js`, `src/main.js`, `src/http/**`, `collector/Dockerfile`, `test/office-control.test.js`, `test/server.test.js` | V-C e V-Docker; `node collector/src/main.js` rodado de outra pasta acha a página e escuta só em `127.0.0.1` | verde, `200`, e o container continua acessível pela porta publicada | coberto por `server.test.js` |
| 1.8 Regras de camada no `architecture.test.js` (tabela da seção 6.1): `shared/` fechado; `domain/` sem `node:*`; só `composition.js` e `main.js` importam `infra/`; nada fora de `http/` importa `node:http`; `composition.js` não lê `process.env` | `test/architecture.test.js` | V-C | verde | não se aplica |
| 1.9 Clean Code: constantes para os números da C18 no collector, log de JSON corrompido (C20), nomes da C21 em `office-store.js` | arquivos citados | V-C, V-Docker, sessão real do Claude Code aparecendo em `http://localhost:8420` | verde, comportamento igual | coberto |
| 1.10 Revisão (somente leitura) | `productivity-code-reviewer` e `security-appsec` (guardas de host, origem e corpo mudaram de arquivo; endereço de escuta mudou) | nenhum | relatório | pode rodar em paralelo com a fase 2 |

### 10.4 Fase 2: runner

Agent de escrita: `productivity-test-engineer` no 2.1; `productivity-refactor` no resto.

| Passo | Arquivos | Verificação | Esperado | Caracterização antes? |
|---|---|---|---|---|
| 2.1 Extrair `lineReader` e `parseEvent` sem mudar uma linha para `sessions/json-lines.js` e testar (linha partida entre pedaços, linha em branco, JSON inválido ignorado). Testes de `session-registry` (limite de 8 abertas, encerradas esquecidas depois de 10 min com `now` injetado, primeira mensagem aparada e cortada) e de `session` (queda com erro gera entrada "a sessão caiu", `sessionIdWithin` devolve `null` no prazo). `architecture.test.js`: imports relativos resolvem | `runner/src/sessions/json-lines.js`, `sessions/claude-process.js`, `runner/test/*` | V-R | verde | este é o passo de caracterização |
| 2.2 `transcript.js` → `claude/stream-changes.js` importando `collector/src/shared/claude/summarize-tool.js`; `claude-process.js` e `json-lines.js` → `claude/`; o launcher traduz eventos em mudanças e chama `onChange` (A5); `session.js` deixa de importar o adapter; o processo falso do `runner.test.js` passa os eventos por `changesOf`. Buscar importadores de `collector/src/events/tool-summary.js`; sem nenhum, apagar a reexportação | `runner/src/**`, `runner/test/runner.test.js`, `collector/src/events/tool-summary.js` (apagado) | V-R e V-C | verde nos dois | coberto por `runner.test.js` |
| 2.3 `infra/is-directory.js` injetado (A6); `sessions/message-text.js` usado pelo registro e pelo HTTP (C12); `SHUTDOWN_GRACE_MS`. Preparo para a fase 7: `composition.js` com `createRunner(config)`; `main.js` só lê env e chama | `runner/src/**`, testes | V-R | verde | 2.1 |
| 2.4 Regras de camada (seção 6.2) no `architecture.test.js`; cruzamento de pacote só para `collector/src/shared/` | `runner/test/architecture.test.js` | V-R; manual: `node runner/src/main.js`, a página mostra "Abrir sessão…", abrir sessão numa pasta de teste, ver o texto chegando, Interromper, Encerrar | verde e fluxo igual | não se aplica |
| 2.5 Revisão (somente leitura) | `productivity-code-reviewer` | nenhum | relatório | pode rodar em paralelo com a fase 3 |

### 10.5 Fase 3: web

Agent de escrita: `productivity-test-engineer` em 3.1 e 3.14 (testes); `productivity-refactor` no resto. Regra de ouro desta fase: passo de mover não muda comportamento, passo de mudar comportamento não move arquivo.

| Passo | Arquivos | Verificação | Esperado | Caracterização antes? |
|---|---|---|---|---|
| 3.1 Rede de segurança. `architecture.test.js`: todo import relativo de `web/scripts` e `web/test` resolve para arquivo existente e todo nome importado é exportado pelo destino (com lista de exceção para os seis arquivos mortos até D1). `contracts.test.js`, importando o collector: ids de `THEMES` iguais a `TEMPLATE_IDS` (os 7 temas); as ações geradas por `describe-activity` ("editando a.js", "rodando npm", "delegou para x", "usando x") rendem pensamento com o alvo; a saída de `summarizeTool` para Write, Edit e Bash vira o formato certo em `terminal-format`; `canReceiveMessages` do web e do collector concordam numa tabela de casos. Caracterização do que não tem teste: `room-rules.test.js` (`planWall` encaixe em ordem; `layoutRoom` com mesas reservadas, mesas vagas e tamanho mínimo, para cada um dos 7 temas; `routeBetween` sem ponto repetido e escolhendo o corredor mais curto; `nearestLaneZ`; atividades de tempo livre disponíveis por tema); `office-rules.test.js` (`withAgentNames` estável e sem repetir, `sortedProjects`, `needsYou`, `statusOf`); `views.test.js` com saída de referência gravada do código atual para `renderTabs`, `renderTeam`, `renderOffice`, `renderUsage`, `renderPendingStrip`, `renderPendingCard`, `renderSheetShell`, `renderAgentIdentity`, `renderAgentFacts` (dados fixos e horários `0`, para `ago` não variar) | `web/test/*` | V-W | verde sem tocar `scripts/` | este é o passo de caracterização |
| 3.2 Apagar o código morto (D1) e a lista de exceção | 6 arquivos, `web/test/architecture.test.js` | V-W | verde | 3.1 |
| 3.3 `art/pixels.js` → `domain/shared/seeded-random.js` (+ `pickWith`, C19); `art/themes.js` → `data/themes.js`, sem mudar o conteúdo. Importadores: `view/{agent-names, agent-reactions, agent-temperament, agent-thoughts, conversations, seated-fidgets, office-view}.js`, `three/{people, room, furniture, office-walls}.js`, `app/main.js`, testes | citados | V-W e V-Browser (os 7 temas) | verde; `art/` some | 3.1 |
| 3.4 `domain/room/`: `room-layout`, `room-routes`, `wall-plan`; `room-places.js` dividido em `domain/room/room-spots.js` (catálogo: `seatStop`, pontos de tempo livre, `exitStop`) e `domain/behavior/room-places.js` (`assignPlaces` sobre um catálogo). Preparo para a fase 6: `room-layout.js` dividido em `desk-islands.js` e `room-zones.js` (C23, C24). Só mover e separar, sem mudar resultado | os arquivos citados, `three/room.js`, `three/renderer.js`, testes | V-W e V-Browser | `room-rules`, `agent-behavior` e `agent-conversations` verdes sem mudar asserção | 3.1 |
| 3.5 `domain/behavior/`: `agent-reactions`, `agent-temperament`, `free-time-clock`, `seated-fidgets`, `agent-thoughts` | os cinco, `three/people.js`, `three/renderer.js`, `domain/behavior/room-places.js`, testes | V-W e V-Browser | verde | coberto |
| 3.6 `domain/conversations/` e `data/conversations.js` → `data/conversation-lines.js` | os três, `three/renderer.js`, testes | V-W e V-Browser | verde | coberto |
| 3.7 `domain/office/`: `agent-names`, `can-receive-messages`, `agent-status` (com `isScreenLit` no lugar dos dois `LIT`, B8), `project-order`, `live-sessions` (C7); `domain/terminal/terminal-format.js` | citados, `app/main.js`, `app/data-source.js`, `three/room.js`, `three/renderer.js`, `view/office-view.js`, `view/terminal-entries.js`, testes | V-W e V-Browser | verde | 3.1 |
| 3.8 Dividir `view/`: `shared/` (format, escape-html, icons), `office/` (tabs, team, room, agent-badges, usage, status-display), `sheet/` (pending-request, agent-sheet), `terminal/` (entries, markdown) | `view/**`, `app/main.js`, `app/agent-panel.js`, `app/terminal-pane.js`, testes | V-W e V-Browser | `views.test.js` passa sem trocar nenhuma saída de referência | 3.1 |
| 3.9 `infra/`: `office-api`, `runner-client`, `local-preferences` (C8), `demo/demo-world`, `demo/demo-terminal`, `cloud/*` com `data/cloud-roles.js` (ou nada, se D3 removeu) | `infra/**`, `data/**`, `app/data-source.js`, `app/main.js`, `app/panel-resizer.js` | V-W e V-Browser nos dois modos | verde | manual (DOM e rede) |
| 3.10 Estratégias de backend (B7): `infra/backends/live-backend.js` e `demo-backend.js` com os mesmos métodos (`setTemplate`, `decide`, `sendMessage`, `loadHistory`, `closeProject`, `openSession`, `watchTerminal`, `interruptSession`, `stopSession`); `data-source.js` recebe o backend e não testa mais `isDemo()`. Preparo para a fase 8: `app/main.js` escolhe o backend de demonstração direto quando a URL tem `?modo=demo`, sem chamar `/api/state`, sem consultar o executor em `127.0.0.1:8421` e sem buscar `/cloud/state.js`. `backends.test.js` confere que os dois expõem os mesmos métodos | citados | V-W e roteiro completo do V-Browser nos dois modos, mais `?modo=demo` com o DevTools mostrando zero requisição fora dos arquivos estáticos | verde, comportamento igual | manual |
| 3.11 Decisão (B6): `domain/office/decision-body.js` puro e `app/decision-form.js`; teste de contrato com `collector/src/control/domain/decision-answer.js` (todo corpo montado é aceito) | citados, `app/main.js`, `app/agent-panel.js`, `web/test/contracts.test.js` | V-W e V-Browser (aprovar, negar com motivo, responder, "decidir no terminal") | verde | 3.1 |
| 3.12 `app/main.js` só composição; `app/office-page.js` com estado, seleção, render e o adiamento durante o clique (C4); constante para o intervalo de 30 s | `app/main.js`, `app/office-page.js` | V-W e V-Browser | verde | manual |
| 3.13 `three/`: subpastas `scene/`, `people/`, `furniture/`; `renderer.js` dividido em `camera-framing.js` e `name-tags.js`; `people/looks.js`. Preparo para a fase 6: `furniture/room.js` recebe a origem da sala (hoje sempre `0, 0`) e o tema dela, e devolve o grupo sem adicioná-lo à cena; trocar o tema reconstrói só esse grupo | `three/**`, `app/main.js` | V-W e V-Browser (os 7 temas) | verde, cena idêntica | manual |
| 3.14 Movimento (B4): extrair sem mudar comportamento `direct`, `keepsCourse` e `startingPoint` de `three/scene/renderer.js` para `domain/behavior/movement-plan.js`, que devolve `{ kind: "keep" }`, `{ kind: "place", stop }` ou `{ kind: "walk", from, path, isUrgent }`. Preparo para a fase 6: o plano recebe `routeFor(from, to)` em vez de chamar `routeBetween(origin, stop, lanes)`; a composição passa a rota da sala. Depois, `movement-plan.test.js`: quem estava sentado continua sentado quando as mesas mudam; quem chega numa sala já visitada sai da porta; trabalho urgente interrompe uma caminhada calma; movimento reduzido coloca direto; mesma parada mantém a rota | `domain/behavior/movement-plan.js`, `three/scene/renderer.js`, `web/test/movement-plan.test.js` | V-W e V-Browser (boneco que anda em "reações", subagente na "orquestra", trocar de sala e voltar) | verde, movimento igual | extrair mecanicamente, depois fixar com teste |
| 3.15 Regras de camada no `architecture.test.js` (tabela da seção 6.3); `domain/` sem `document`, `window`, `localStorage`, `fetch`, `EventSource`, `requestAnimationFrame`, `performance`, `Date.now`; `vendor/` só em `three/kit.js` e `view/terminal/terminal-markdown.js`; nenhum caminho absoluto de arquivo estático (`"/scripts`, `"/styles`) para a página funcionar sob um subcaminho (fase 8) | `web/test/architecture.test.js` | V-W | verde | não se aplica |
| 3.16 `domain/room/room-dimensions.js` lido por `room-spots.js`, `three/furniture/commons.js` e `furniture.js` (C17), porque a fase 6 tira reunião e lounge da sala do projeto; token de sombra (C22). Opcional (D7): extrair o avanço no caminho de `three/people/people.js` para `domain/behavior/walk-step.js` | citados, `web/styles/*` | V-W e V-Browser (altura de quem senta na reunião e no sofá) | verde | manual |
| 3.17 Revisão (somente leitura) | `productivity-code-reviewer` | nenhum | relatório | pode rodar em paralelo com a fase 4 |

### 10.6 Fase 4: hooks

Fase independente: não toca nenhum arquivo das outras fases e pode ir para qualquer posição da fila. Agent: `productivity-refactor` (testes com `productivity-test-engineer`).

| Passo | Arquivos | Verificação | Esperado | Caracterização antes? |
|---|---|---|---|---|
| 4.0 Saída de referência dos instaladores: rodar instalar, instalar de novo e remover com a configuração apontando para uma pasta temporária e guardar os arquivos gerados. PowerShell: `$env:CLAUDE_CONFIG_DIR = "$env:TEMP\office-hooks-check"; node hooks/install-claude-hooks.mjs`; idem `$env:CODEX_HOME`. Git Bash: `dir=$(mktemp -d); CLAUDE_CONFIG_DIR="$dir" node hooks/install-claude-hooks.mjs` | nenhum arquivo do projeto | comparar depois do 4.1 | arquivos gerados guardados | este é o passo de caracterização |
| 4.1 Extrair sem mudar comportamento `lib/claude-settings.mjs`, `lib/codex-config.mjs`, `lib/status-line-text.mjs`; `isRemoving`, `officeUrl` e `hooksDir` viram parâmetros (C13, preparo para a fase 7); CLIs ficam com I/O, mensagens e código de saída. Testes: instalar duas vezes não duplica; remover tira só os grupos do escritório e mantém os do usuário; linha de status do usuário fica intocada; instalar a partir de outra pasta substitui as entradas antigas (reconhecidas pelo nome do arquivo); Codex recusa `notify` alheio, insere na raiz antes da primeira tabela e remove o próprio | `hooks/**` | V-H; repetir o 4.0 e comparar | idêntico ao 4.0 | 4.0 |
| 4.2 `lib/office-url.mjs`, `lib/read-stdin.mjs`, `lib/config-backup.mjs` (C14). Os dois hooks importam só de `./lib/`, para poderem ser copiados com a pasta `lib/` para outro lugar (fase 7) | `hooks/**` | V-H; sessão real do Claude Code: a sala aparece e a linha de status mostra modelo e uso | igual | 4.0 |
| 4.3 README: comando `node --test hooks/test/*.test.mjs` em "Desenvolvimento" e a nova árvore de pastas | `README.md` | leitura | atualizado | não se aplica |
| 4.4 Revisão (somente leitura): instaladores reescrevem configuração do usuário | `security-appsec` | nenhum | relatório | não se aplica |

### 10.7 Fase 5 (opcional, D6): contrato estruturado em vez de texto

Troca a interpretação de frases (C15) por campos. Uma área por vez, nesta ordem: collector (eventos de atividade ganham `subject`; entradas de histórico ganham `toolName` e `summary` separados, mantendo `text`), runner (mesmos campos nas entradas do terminal), web (lê os campos e cai na interpretação do texto só quando eles faltam). A queda para texto sai numa limpeza posterior. Verificação: V-C, V-R, V-W, contratos atualizados, V-Browser. É pré-requisito de uma versão do escritório em inglês (D10). Se for feita, entra antes da fase 6, porque o feed de atividade do campus também lê essas frases.

### 10.8 Paralelismo

- Implementação é sequencial: um agent escrevendo por vez, na ordem 0 → 1 → 2 → 3 → 4 (→ 5) e depois 6 → 7 → 8.
- A fase 4 não compartilha arquivo com nenhuma outra da refatoração; pode trocar de posição na fila, mas continua sozinha enquanto escreve. Ela precisa terminar antes da fase 6, porque a 6 mexe em `hooks/office-statusline.mjs`.
- Somente leitura em paralelo: a revisão de cada fase (1.10, 2.5, 3.17, 4.4) roda junto com o primeiro passo da fase seguinte, porque lê arquivos que a fase seguinte não toca. O desenho detalhado de cada fase posterior (6.1, 7.1) também é somente leitura e pode começar enquanto a fase anterior termina.
- Dependências de ordem: 2.2 precisa de 1.2 (`shared/`). 3.1 importa caminhos do collector, então vem depois da fase 1. 3.11 importa `control/domain/decision-answer.js` (passo 1.5).

## 11. Fases posteriores (fora da refatoração)

Ordem aprovada: arquitetura (fases 0 a 4, mais a 5 se D6) → campus (fase 6) → `npx` (fase 7) → landing (fase 8). Nenhuma começa antes de as fases 1 a 4 terminarem. Cada uma lista o que a refatoração já deixou pronto, o desenho proposto e os passos por área.

Por que essa ordem funciona: o campus muda o contrato do collector (tempo por status, uso por conta) e a linha de status; empacotar depois evita publicar duas versões do contrato. A landing vem por último e já mostra o campus na demonstração.

### 11.1 Fase 6: o escritório como campus (v1 completa)

**Escopo da v1 (tudo entra).**

- Mapa único com o prédio inteiro: cada projeto é uma sala; salas comuns (recepção, copa, lounge, banheiros, reunião) ligadas por corredor; área externa (gramado, árvores, calçada, rua).
- Câmera com zoom e pan.
- Painel lateral com a árvore projetos → agentes e busca; feed de atividade embaixo.
- Resumo "meu dia" (tempo esperando você, tempo trabalhando) e uso de várias contas.
- Os 7 temas (Laboratório, Café, Biblioteca, Garagem, Estação espacial, Jardim, Fliperama) e o seletor "Escritório" por projeto continuam funcionando.

**Princípio.** O campus é uma composição de salas que já existem, não uma sala maior. A sala de hoje continua sendo calculada em coordenadas locais e montada com o tema dela; uma planta de prédio decide onde cada sala fica no mundo e como as portas se ligam.

**Como o tema convive com o campus.**

| Parte do mapa | Tema | Origem |
|---|---|---|
| Sala de um projeto (piso, paredes, mesas, cadeiras, monitores, itens de parede, cantos, objetos de chão, altura da parede) | O tema do projeto, escolhido no seletor "Escritório" | `project.template` no collector, como hoje; catálogo `data/themes.js` intacto |
| Corredores, recepção, copa, lounge, banheiros, reunião | O tema do campus | catálogo novo `data/campus-themes.js` |
| Área externa (gramado, árvores, calçada, rua) | O tema do campus | idem |

- **O catálogo dos 7 temas não muda.** Nenhum campo sai; o campus só lê. O contrato de ids com o collector (`TEMPLATE_IDS`) continua coberto pelo teste de contrato do 3.1.
- **A sala do projeto mantém a identidade do tema.** Ela continua com os itens de parede do tema (janela, estante, arquivo, copiadora, copa e bebedouro como copinha da equipe, quadro de cortiça, fliperama, cerca viva...), os cantos e os objetos de chão. O que sai dela no campus são a sala de reunião e o lounge, que viram salas comuns. `room-zones.js` (passo 3.4) ganha a variação "sala de projeto no campus", sem reunião e sem lounge.
- **As atividades de tempo livre continuam dependendo do tema.** Pontos da sala do projeto (janela, estante, arquivo, copiadora, plantas, copinha) ficam só para os agentes daquele projeto; pontos das salas comuns ficam para todos. Um projeto no tema Jardim (sem estante) continua sem a atividade da estante na própria sala, como o README descreve hoje.
- **Trocar o tema de um projeto reconstrói só a sala dele.** `furniture/room.js` já monta a sala como grupo numa origem (passo 3.13); a planta do prédio reserva o espaço pelo tamanho calculado (`layoutRoom`), e a altura de parede de cada tema (o Jardim tem 1,1) é por sala.
- **O tema do campus.** Catálogo próprio com as cores de corredor, salas comuns e área externa, no mesmo formato de objeto simples dos temas de sala. A v1 começa com um tema de campus neutro, que combina com os 7 de sala. Mais de um e um seletor "Campus" são decisão D8; se houver seletor, a escolha fica no navegador por `infra/local-preferences.js`, como a largura do painel.
- **No foco de uma sala** (clique na árvore ou zoom), o cabeçalho da sala mostra o seletor "Escritório" como hoje (`view/office/room-view.js`).

**Módulos do layout (web/scripts/domain).**

```text
domain/
  room/                                uma sala, coordenadas locais (vem da refatoração)
    desk-islands.js                    mesas do projeto
    room-zones.js                      porta, parede, cantos; variação "sala de projeto no campus" sem reunião e lounge
    room-layout.js                     compõe; ganha variações por tipo de sala (projeto, recepção, copa, lounge, banheiro, reunião)
    room-spots.js                      catálogo de pontos; cada ponto ganha roomId e o público que pode usá-lo (projeto ou todos)
    room-routes.js                     rota dentro da sala
    room-dimensions.js
    wall-plan.js
  building/                            novo: planta do prédio
    building-plan.js                   posiciona salas de projeto (tamanhos diferentes) e comuns, com portas e corredores
    site-plan.js                       área externa: gramado, árvores, calçada, rua
    world-position.js                  converte local ↔ mundo pela origem da sala
  navigation/                          novo: rotas entre salas
    building-routes.js                 sala → porta → corredor → porta → sala, reaproveitando room-routes nas pontas
  behavior/
    room-places.js                     a mesma escolha, sobre o catálogo do prédio, respeitando o público de cada ponto
    movement-plan.js                   inalterado; recebe routeFor do prédio em vez do da sala
  office/
    activity-feed.js                   novo: junta os logs dos agentes por horário
    project-tree.js                    novo: árvore projetos → agentes e filtro de busca
    my-day.js                          novo: soma tempo esperando você e trabalhando a partir das estatísticas do dia
data/
  room-kinds.js                        novo: o que cada tipo de sala comum contém
  campus-themes.js                     novo: tema do campus
```

Do lado do `three/`: um `scene/campus.js` novo monta todas as salas (cada uma com `furniture/room.js` e o tema dela), corredores, salas comuns e área externa; `scene/camera-framing.js` vira controle de câmera com zoom e pan (mouse, toque e teclado); `scene/name-tags.js` esconde etiquetas fora da área visível. Do lado do `view/` e do `app/`: árvore com busca, feed, "meu dia" e contas são renderizadores novos sobre as funções puras do domínio; `view/office/tabs-view.js` sai quando a árvore entra.

**Regras de comportamento que passam a atravessar salas.**

| Regra | Hoje | No campus |
|---|---|---|
| Tempo livre (café, água, janela, estante, arquivo, copiadora, quadro, reunião, sofá, plantas) | Pontos da própria sala | Copa, lounge, reunião e banheiros viram salas comuns: os pontos vêm do catálogo do prédio e a disputa por lugar é entre agentes de todos os projetos. Os pontos da sala do projeto continuam só da equipe. `assignPlaces` já ordena por chave, então rodar uma vez para o prédio inteiro mantém o lugar estável. Banheiro entra como atividade nova em `FREE_TIME` e em `REACTIONS` (só dados) |
| Volta apressada quando chega trabalho | Rota curta dentro da sala | Rota pelo corredor até a sala do projeto, com `routeFor` do prédio; a pressa (`HURRY_PACE`) continua igual, mas a viagem é mais longa |
| Papo no tempo livre | Círculos por distância na sala | Círculos por distância e mesma sala (`roomId`), em coordenadas do mundo; agentes de projetos diferentes conversam na copa |
| Nomes | Únicos por projeto (`withAgentNames` por sala) | Únicos no prédio: a mesma função, chamada com todos os agentes; muda o nome de quem já está na tela (D8) |
| Delegação e entrega em mãos | Dentro da sala | Continuam dentro da sala do projeto |
| Chegada e saída | Porta da sala | Porta do prédio, pela recepção e pela calçada |
| Temperamento, gestos na mesa, piscar | Por agente | Inalterados |
| Pensamentos (no máximo 3 visíveis) | Por sala | Por área visível da câmera |

**Dados novos do collector.**

- "Meu dia" precisa de tempo por status, que hoje não existe: o collector conta pedidos, ferramentas e turnos por dia. O lugar é `office/domain/daily-stats.js` (separado no passo 1.3), acumulando o tempo entre mudanças de status em "esperando você" (`needs_you`, `waiting`) e "trabalhando" (`working`, `reviewing`), por projeto e no total.
- O feed sai dos logs que já vêm no estado público, sem mudança no collector.
- Várias contas: hoje `usage` é um valor único no store; passa a ser um mapa por conta. Falta saber de onde vem o rótulo da conta: conferir na documentação do Claude Code o que a linha de status entrega; se não houver identificador, o hook de linha de status pode mandar o `CLAUDE_CONFIG_DIR` em uso, já que cada conta costuma ter o seu (D8).

**O que a refatoração deixa pronto.**

| Costura | Passo |
|---|---|
| Catálogo dos 7 temas isolado em `data/themes.js` e coberto por teste de contrato | 3.1, 3.3 |
| Ilhas de mesas separadas das zonas comuns | 3.4 |
| Catálogo de pontos separado da escolha de quem vai para onde | 3.4 |
| Movimento com rota injetada (`routeFor`) | 3.14 |
| Sala 3D montada numa origem com o tema dela, sem adicionar à cena | 3.13 |
| Câmera isolada em `camera-framing.js` | 3.13 |
| Posições de cadeira, sofá e mesa num lugar só | 3.16 |
| Estatística do dia isolada no collector | 1.3 |
| Leitura da linha de status isolada no adapter | 1.4 |

**Passos (uma área por vez).**

| Passo | Agent | Arquivos | Verificação |
|---|---|---|---|
| 6.1 Desenho detalhado: planta, empacotamento de salas de tamanhos diferentes, rotas, tema do campus, desempenho (dezenas de salas e bonecos: instanciação de geometria, nível de detalhe) | `fullstack-architect` (somente leitura) | documento | revisão do usuário |
| 6.2 Collector: tempo por status e uso por conta (contrato novo, com teste de contrato no web); linha de status manda o rótulo da conta | `backend-node-typescript` (em JavaScript) | `collector/src/office/domain/**`, `collector/src/claude/statusline-reading.js`, `hooks/office-statusline.mjs`, testes | V-C, V-H, V-Docker |
| 6.3 Web, domínio: `building/`, `navigation/`, catálogo do prédio com público por ponto, variações de sala, `activity-feed`, `project-tree`, `my-day`, `data/room-kinds.js`, `data/campus-themes.js`, com testes (inclusive: as 7 salas de tema montam no campus e mantêm as atividades do próprio tema) | `fullstack-feature` | `web/scripts/domain/**`, `web/scripts/data/**`, `web/test/**` | V-W |
| 6.4 Web, 3D: `scene/campus.js`, câmera com zoom e pan, salas posicionadas com o tema de cada projeto, salas comuns e área externa com o tema do campus | `fullstack-feature` | `web/scripts/three/**` | V-W e V-Browser (`?vista=campus`, os 7 temas lado a lado, trocar o tema de uma sala sem piscar as outras) |
| 6.5 Web, painéis: árvore com busca, feed, "meu dia", contas, seletor "Escritório" no foco da sala | `fullstack-feature` | `web/scripts/view/**`, `web/scripts/app/**`, `web/styles/**` | V-W e V-Browser nos dois modos |
| 6.6 Campus como visão padrão; a sala única vira o zoom numa sala; dados de exemplo atualizados para mostrar o campus; README | `fullstack-feature` e `productivity-docs` | `web/scripts/app/**`, `web/scripts/infra/demo/**`, `README.md` | V-W, V-Browser |
| 6.7 Revisão de código e de acessibilidade do painel e da câmera (teclado, movimento reduzido) | `productivity-code-reviewer` (somente leitura) | nenhum | relatório |

Durante a transição, a sala única continua sendo a visão padrão e o campus entra por um parâmetro (`?vista=campus`), até o 6.6.

### 11.2 Fase 7: instalação com `npx orquestra-office`

**Objetivo.** `npx orquestra-office` instala os hooks do Claude Code e o notify do Codex, sobe o coletor em `127.0.0.1:8420` sem Docker e abre o navegador. `npx orquestra-office uninstall` remove. O Docker continua como segunda opção.

**O que a refatoração deixa pronto.**

| Costura | Passo |
|---|---|
| `createOffice(config)` sem `process.env` e sem caminho relativo ao diretório atual | 1.7 |
| `OFFICE_HOST` com padrão `127.0.0.1`; `0.0.0.0` só no `Dockerfile` | 1.7 |
| `createRunner(config)` | 2.3 |
| Runner importa só `collector/src/shared/`, então o caminho relativo vale dentro do pacote | 2.2, 2.4 |
| Instaladores puros com `isRemoving`, `officeUrl` e `hooksDir` como parâmetro | 4.1 |
| Hooks dependem só de `./lib/`, copiáveis como pasta | 4.2 |

**Onde mora a composição da CLI.** Numa pasta nova na raiz, que é a única que conhece os três pacotes:

```text
cli/
  bin/orquestra-office.mjs             entrada do bin: lê argv, despacha o comando, código de saída
  commands/start.mjs                   padrão: instala (idempotente), sobe coletor e executor, abre o navegador
  commands/install.mjs                 copia hooks/*.mjs e hooks/lib/ para a pasta estável; chama hooks/lib com hooksDir dessa pasta
  commands/uninstall.mjs               remove as entradas do Claude Code e do Codex; --purge apaga a pasta estável
  app-home.mjs                         pasta estável por usuário (dados e cópia dos hooks)
  office-health.mjs                    já existe um coletor respondendo em 8420 (por exemplo o Docker)? então só abre o navegador
  open-browser.mjs                     start no Windows, open no macOS, xdg-open no Linux
```

`commands/start.mjs` chama `createOffice({ webDir, dataDir, holdMs, allowedHosts: [] })` e `createRunner(...)` e escuta os dois em `127.0.0.1`. `webDir` vem de `new URL("../../web/", import.meta.url)`; `dataDir` vem de `app-home.mjs`.

**Por que copiar os hooks para uma pasta estável.** O `npx` roda o pacote a partir do cache do npm, que pode ser limpo ou trocado de versão. O `settings.json` guarda o caminho absoluto do script; se ele apontar para o cache, as sessões quebram quando o cache sumir. A CLI copia `hooks/*.mjs` e `hooks/lib/` para a pasta estável e instala apontando para lá. Como o instalador reconhece as entradas antigas pelo nome do arquivo, quem instalou pelo repositório migra sozinho.

**Empacotamento.** Um `package.json` na raiz, sem dependências, mantendo o layout do repositório:

```json
{
  "name": "orquestra-office",
  "type": "module",
  "bin": { "orquestra-office": "cli/bin/orquestra-office.mjs" },
  "engines": { "node": ">=22" },
  "files": [
    "cli/",
    "collector/src/",
    "runner/src/",
    "hooks/*.mjs",
    "hooks/lib/",
    "web/index.html",
    "web/scripts/",
    "web/styles/",
    "web/vendor/"
  ]
}
```

Os `package.json` de `collector/` e `runner/` continuam para os testes e o Docker. O da raiz pode ganhar um `test` que roda as quatro suítes. Conferir o conteúdo com `npm pack --dry-run` antes de publicar (sem testes, sem `.env`, sem `state.js`).

**Passos (uma área por vez).**

| Passo | Agent | Arquivos | Verificação |
|---|---|---|---|
| 7.1 Desenho fino e ameaças: endereço de escuta, cópia dos hooks, processo em primeiro ou segundo plano (D9) | `fullstack-architect` e `security-threat-model` (somente leitura, em paralelo) | nenhum | documento |
| 7.2 `cli/` e `package.json` da raiz | `backend-node-typescript` (em JavaScript, sem TypeScript) | `cli/**`, `package.json` | testes de `cli/` com pasta estável e `CLAUDE_CONFIG_DIR`/`CODEX_HOME` temporários; `node cli/bin/orquestra-office.mjs` local; `npm pack --dry-run` |
| 7.3 README: instalação com `npx` como primeira opção, Docker como segunda | `productivity-docs` | `README.md` | leitura |
| 7.4 Revisão | `security-appsec` | nenhum | relatório |

### 11.3 Fase 8: landing page no GitHub Pages (PT e EN)

**Objetivo.** Uma landing em português e inglês que embute a página do escritório (já com o campus) em modo demonstração.

**Onde mora: `site/`, não `docs/`.** `docs/` guarda documentação interna (este plano e os ADRs). O GitHub Pages publicando a partir de uma pasta da branch só aceita a raiz ou `/docs`: em `/docs`, publicaria os documentos internos junto e ainda exigiria uma cópia de `web/` dentro de `docs/`, porque a página publicada não alcança arquivos fora da pasta. A saída é publicar por GitHub Actions um artefato montado na hora:

```text
site/
  index.html                           landing em português
  en/index.html                        landing em inglês
  styles/landing.css                   só tokens do design system (lidos de escritorio/styles/tokens.css)
  assemble.mjs                         monta _site/: site/* e web/{index.html, scripts, styles, vendor} em _site/escritorio/
.github/workflows/pages.yml            roda node site/assemble.mjs e publica _site/ com upload-pages-artifact e deploy-pages
```

**Reaproveitar `web/` sem duplicar.** Nenhum arquivo de `web/` é copiado no repositório: a cópia existe só dentro de `_site/` (no `.gitignore`), feita pelo mesmo `assemble.mjs` no CI e na máquina. É cópia de arquivo, não etapa de build: nada é transformado. A landing embute com `<iframe src="escritorio/?modo=demo">` (na raiz) ou `../escritorio/?modo=demo` (no `en/`). Pré-visualização local: `node site/assemble.mjs` e servir `_site/` com `py -m http.server 8000 --directory _site` (Windows) ou `python3 -m http.server 8000 --directory _site` (macOS).

**O que a refatoração deixa pronto.**

| Costura | Passo |
|---|---|
| `?modo=demo` escolhe o backend de demonstração sem tentar `/api/state`, o executor ou `/cloud/state.js` | 3.10 |
| Dados de exemplo isolados em `infra/demo/` (o 6.6 os atualiza para o campus) | 3.9 |
| Nenhum caminho absoluto de arquivo estático no web (funciona sob `/<repositório>/escritorio/`) | 3.15 |
| Tokens do design system num arquivo só (`web/styles/tokens.css`), reaproveitado pela landing | já existe |

Sobre cair no demo quando `/api/state` não responde: funciona no Pages (a requisição vai para a raiz do domínio e dá 404), mas o parâmetro explícito é mais previsível, evita uma requisição com erro no console e não depende do que o domínio responde em `/api/state`.

**Inglês.** A interface do escritório inteira está em português: textos em `view/`, catálogos em `data/` (pensamentos, conversas, demonstração) e as frases de ação geradas pelo collector. Duas opções (D10): a landing em inglês embute a demonstração em português, com um aviso; ou o escritório ganha idiomas, com catálogos por idioma em `data/` e textos de `view/` saindo para catálogos, o que exige antes a fase 5 (o web hoje interpreta as frases em português do collector). Recomendo a primeira agora e a segunda como fase própria, se houver demanda.

**Passos.**

| Passo | Agent | Arquivos | Verificação |
|---|---|---|---|
| 8.1 `site/` (PT e EN) e `assemble.mjs`; a landing cita `npx orquestra-office` (fase 7) | `fullstack-feature` (HTML, CSS e Node puros) | `site/**`, `.gitignore` | `node site/assemble.mjs`; servir `_site/`; a demonstração do campus roda dentro do iframe; DevTools sem requisição fora de `_site/` |
| 8.2 Workflow do Pages | `devops-cicd` | `.github/workflows/pages.yml` | execução no GitHub (exige o repositório no GitHub, D5) |
| 8.3 Revisão | `productivity-code-reviewer` e `security-appsec` (iframe, CSP por meta tag) | nenhum | relatório |

## 12. Decisões do usuário

| Id | Pergunta | Recomendação |
|---|---|---|
| D1 | Apagar os seis arquivos mortos do web (`view/room-scene.js`, `art/characters.js`, `art/iso.js`, `art/props.js`, `art/sprites.js`, `art/templates.js`)? | Apagar. Ninguém os importa e quatro nem carregariam. |
| D2 | O que fazer com `state-sync*.js` (4), `handoff-*.py` (2), `rename-skills-0740.py`, `claude-manifest-0400.txt`? | Mover para fora do projeto. São de outro projeto e nada os referencia. |
| D3 | Manter a aba "time na nuvem"? Hoje ela não aparece, porque o `state.js` está no formato arquivado. Removê-la toca: `collector/src/http/server.js:22,59-67`, `collector/src/main.js:11`, `collector/Dockerfile:5-6`, `compose.yaml:12`, `web/scripts/app/data-source.js:1,6,9,25-26,35-36,50-60,75,93-96`, `web/scripts/data/cloud-team.js`, `web/scripts/view/office-view.js:59-65,81,85`, `web/scripts/view/agent-rules.js:3`, `web/scripts/app/main.js:170`, `README.md:41`, `state.js` | Remover, se o time na nuvem acabou mesmo. Tira também a montagem do projeto inteiro (com o `.env`) dentro do container e evita um projeto especial no campus e no pacote npm. |
| D4 | `index.html` e `nginx.conf` da raiz (página antiga, fora do compose)? | Remover junto com D2 ou D3. A raiz fica livre para o `package.json` da fase 7. |
| D5 | `git init` ou zip por fase? | `git init`, com `.gitignore` criado antes do primeiro commit. A fase 8 exige o repositório no GitHub. |
| D6 | Fazer a fase 5 (contrato estruturado)? | Sim, antes da fase 6. O feed do campus e uma futura versão em inglês dependem dela; até lá os testes de contrato seguram. |
| D7 | Extrair o passo de caminhada para `domain/behavior/walk-step.js` (3.16)? | Sim, se a fase 6 ficar confirmada: caminhadas pelo corredor ficam longas e vale testar o avanço sem navegador. |
| D8 | Fase 6: nomes únicos no prédio (alguns agentes mudam de nome na primeira vez)? Um tema de campus fixo na v1 ou vários com seletor "Campus"? De onde vem o rótulo da conta? | Nomes únicos no prédio; um tema de campus na v1, catálogo pronto para mais; rótulo da conta a confirmar na documentação da linha de status, com o `CLAUDE_CONFIG_DIR` como plano B. |
| D9 | Fase 7: o coletor da CLI roda em primeiro plano (fecha com Ctrl+C) ou em segundo plano (com `stop` e `status`)? Onde fica a pasta estável (`~/.orquestra-office` em todos os sistemas, ou `%LOCALAPPDATA%` no Windows)? O nome `orquestra-office` está livre no npm? | Primeiro plano na primeira versão (sem PID, sem processo órfão); `~/.orquestra-office`; conferir o nome com `npm view orquestra-office` antes de publicar. |
| D10 | Fase 8: a landing em inglês embute a demonstração em português ou o escritório ganha idiomas (depende da fase 5)? | Demonstração em português com aviso agora; idiomas como fase própria. |

### Respostas do usuário (18/11/2026)

| Id | Decisão |
|---|---|
| D1 | Apagar os seis arquivos mortos (passo 3.2). |
| D2 e D4 | Movidos para `../orquestra-office-arquivos-locais`, fora do repositório, sem apagar. |
| D3 | Remover a aba "time na nuvem" e a montagem da raiz no container (passo 0.4). |
| D5 | Feito: repositório git com o commit da linha de base e a licença MIT, em branch de trabalho (o hook do pacote bloqueia commit direto na `main`). |
| D6 | Fazer a fase 5, antes da fase 6. |
| D7 | Fazer: extrair o passo de caminhada para `domain/behavior/walk-step.js`. |
| Ordem | Arquitetura (fases 0 a 5) → campus (6) → `npx` (7) → landing (8). |
| Campus v1 | Todos os itens: salas comuns e área externa, zoom e pan, painel lateral com árvore e feed, "meu dia" e várias contas, mantendo os 7 temas. |
| D8, D9, D10 | Ficam para o início das fases 6, 7 e 8. |

Decidido nesta etapa, por ser barato de desfazer: manter o nome `view/` no web (convenção do projeto) e criar `domain/`, `infra/` ao lado; manter fábricas `createX` e nomes sem sufixo de camada; landing em `site/` publicada por Actions; no campus, sala de projeto com o tema dela e áreas comuns e externas com o tema do campus.

## 13. O que está bom e deve ser mantido

- Zero dependência e zero build. Módulos ES servidos direto, bibliotecas vendorizadas com licença e versão no README.
- Fábricas `createX({ deps })` com injeção já usadas em quase tudo; `startProcess` do runner é uma porta de verdade, com processo falso nos testes.
- `now` injetado onde o tempo importa (`pending-decisions`, `session`, `session-registry`, `normalizeClaudeEvent`, regras de comportamento). `null` como "movimento reduzido" congela o comportamento de forma testável.
- Privacidade por desenho, com teste: o evento normalizado nunca leva prompt nem argumento de comando; o histórico com texto fica só na memória; `meters` não sai na API.
- Segurança com teste: lista de hosts contra DNS rebinding, mesma origem nos POSTs, política de origem no runner, limite de corpo, travessia de pasta bloqueada nos arquivos estáticos, `nosniff`.
- Gravação atômica com arquivo temporário e `rename`, com espera para juntar gravações.
- Regras de comportamento dos bonecos já puras, determinísticas (sorteio semeado pela chave do agente) e cobertas por testes com nomes de comportamento; `assignPlaces` já ordena por chave, o que vale também para o prédio inteiro.
- Os 7 temas são dados puros num catálogo só, sem lógica: atravessam o campus sem mudança.
- Catálogos de texto separados da lógica (`thoughts.js`, `conversations.js`, `first-names.js`, `terminal-tools.js`).
- Comentários que explicam porquês reais (`request-guard.js:5,11`, `session-history.js:4`, `office-session-start.mjs:17,27,46`, `agent-names.js:10`, `room-places.js:44,92`).
- Interface só com tokens do design system (`var(--...)`); uma única cor crua em `office.css:80`.
- Instaladores idempotentes, com backup e sem apagar hooks do usuário.
- A página já cai sozinha no modo prévia quando não há coletor, o que torna a landing da fase 8 quase de graça.

## 14. Riscos

- **Sem git:** um passo errado não volta sozinho. A fase 0 é obrigatória.
- **Import quebrado passa no `node --check`:** só o `architecture.test.js` do web pega; ele precisa existir antes do 3.2.
- **Código só de navegador (`app/`, `three/`) sem teste automático:** risco de regressão visual. Mitigação: mover sem mudar comportamento, um contexto por passo, roteiro do V-Browser a cada passo, capturas da fase 0 (inclusive dos 7 temas) para comparar.
- **Caminhos gravados no `settings.json` do usuário:** renomear `hooks/office-session-start.mjs` ou `hooks/office-statusline.mjs` quebra as sessões e deixa entradas órfãs, porque o instalador reconhece os próprios hooks pelo nome do arquivo. Na fase 7, instalar a partir do cache do `npx` teria o mesmo efeito quando o cache fosse limpo; por isso a cópia para a pasta estável.
- **Imagem Docker:** qualquer import de `collector/src` para fora de `src/` quebra só no container. A regra do 1.1 pega isso nos testes. O `OFFICE_HOST=0.0.0.0` no `Dockerfile` é obrigatório depois do 1.7; sem ele, o container fica inacessível.
- **Contratos em texto (C15)** seguem frágeis até a fase 5; os testes de contrato da fase 3 avisam quando divergirem.
- **Testes do web importando o collector** acoplam as duas suítes de propósito: mover um arquivo do collector exige ajustar `web/test/contracts.test.js`.
- **Mudança de porta no runner (A5):** `startProcess` passa de `onEvent` para `onChange`; quem tiver código próprio usando o runner (não há no projeto) precisa acompanhar.
- **Versão do Node:** os testes do web e o `node --check` em `.js` sem `package.json` dependem da detecção automática de ESM do Node 22. Um `package.json` com `"type": "module"` na raiz (fase 7) elimina essa dependência.
- **`compose.yaml:12` monta a raiz inteira (incluindo `.env`) em `/site`:** o coletor só lê `state.js` por caminho fixo, mas a montagem é maior que o necessário. D3 resolve; se a aba ficar, montar só o arquivo (`./state.js:/site/state.js:ro`).
- **Fase 6, desempenho:** dezenas de salas, cada uma com o próprio tema e muitas malhas, numa cena só podem pesar no WebGL atual (cada móvel é uma malha). O 6.1 precisa medir antes de desenhar.
- **Fase 6, temas:** salas de projeto com alturas de parede e paletas diferentes lado a lado podem destoar; o tema do campus precisa ser neutro e o 6.4 inclui a verificação dos 7 temas juntos.
- **Fase 6, nomes únicos no prédio:** trocar a atribuição muda o nome de agentes já conhecidos pelo usuário.
- **Fase 6, contrato do collector:** tempo por status e uso por conta mudam o estado público; a página e o collector precisam ser atualizados juntos (no Docker, o `web/` montado e a imagem reconstruída).
- **Fase 7, coletor da CLI e Docker na mesma porta:** a CLI precisa checar se já há um coletor em 8420 antes de subir outro (`office-health.mjs`).

## 15. Pendências adiadas

Achados MINOR das revisões que não bloquearam a fase. Na revisão final da branch decide-se o que entra antes do merge.

| Fase | Onde | Pendência |
|---|---|---|
| 3 | `web/test/support/source-code.js` (`opensRegex`) | Uma barra depois de `)` de `if`/`while`/`for` é lida como divisão, e depois de `++`/`--` como início de regex. Nos dois casos o tokenizador pode esconder o resto da linha. Nenhum arquivo real é afetado. Correção: tratar `++` e `--` como fim de operando e registrar o limite num teste. |
| 3 | `view/terminal/terminal-entries.js`, `app/agent-panel.js`, `app/office-page.js` | O uso de `ownValueOf` nestes três arquivos está certo, mas falta teste com chave herdada (`toString`). |
| 3 | `domain/room/room-routes.js` | A mutação que remove `spine: null` em `routeWithin` sobrevive. |
| 3 | `view/office/status-display.js` | Repete `Object.hasOwn(...) ?` inline; pode usar `ownValueOf`. |
| 3 | `three/scene/name-tags.js`, `three/scene/camera-framing.js` | Etiquetas, placas e enquadramento usam coordenadas locais da sala. Com origem diferente de zero (Sede), passam a usar a posição no mundo. Entra na fase 6. |
| 3 | `domain/office/decision-body.js` | `answers[question.question] = answer` perde a resposta de uma pergunta com o texto `__proto__`. Correção: `Object.fromEntries`. |
| 3 | `web/test/architecture.test.js` (`exportsIn`) | Lê o texto bruto, então um `// export const x` conta como export. |
| 4 | hooks e coletor | Autenticação entre hooks e coletor (quem responde em `127.0.0.1:8420` decide permissões) e pareamento no modo LAN. Pedem ADR aprovado pelo usuário antes da fase 7. |
