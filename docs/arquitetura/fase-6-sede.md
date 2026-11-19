# Fase 6: a Sede da Orquestra (desenho técnico)

Data: 2026-11-18. Estado: desenho para revisão do usuário. Substitui o desenho da seção 11.1 do `plano-de-refatoracao.md` (o "campus" com uma sala por projeto) pelo desenho aprovado: um escritório térreo aberto, com uma ilha por projeto. Este documento é o passo 6.1 do plano.

Fonte da verdade da interface e da planta: a maquete `Sede.dc.html` aprovada pelo usuário (cena isométrica gerada em JS, função `buildHeadquarters`). As coordenadas da seção 4 saíram do script dela.

Pré-requisitos para começar a implementar: fases 3 (até a revisão 3.17), 4 (hooks com `hooks/lib/`) e 5 (campos estruturados) concluídas, e as perguntas da seção 16 respondidas.

## 1. Resumo

- **O que muda em relação ao plano 11.1.** Não existe mais "sala do projeto". Cada projeto vira uma ilha de 6 lugares numa área de trabalho aberta, com tapete, divisória, mesas, cadeiras e monitores nas cores do tema dele. Reunião, copa, sala de jogos e lounge são áreas comuns de todos os projetos. A recepção tem a porta para o quintal. Os 7 temas continuam valendo, agora aplicados à ilha.
- **Domínio.** A sala de hoje (`domain/room/`) não vira o prédio. Reaproveito as peças que não dependem da forma da sala (times, ilhas de 6, assentos, pontos de mesa, plano de movimento, passo de caminhada) e crio `domain/headquarters/` (planta, ilhas, catálogo de pontos), `domain/navigation/` (grafo de caminhada) e `domain/camera/`. A escolha de lugar passa a rodar uma vez para o prédio inteiro, com vagas identificadas e preferência para quem já está na vaga.
- **Collector.** Entram: linha do tempo do dia em fatias de 1 hora (tempo trabalhando, tempo com alguém precisando de você, marcas de pedido e custo), contas com uso de 5 h e da semana, nome de cada agente atribuído e gravado pelo próprio coletor, feed de atividade em memória por um endpoint novo e o relógio do servidor no estado. A fila de pedidos com prazo já existe.
- **Contas (D8).** Nenhum campo da linha de status nem dos hooks identifica a conta. Plano B: a conta é a pasta de configuração (`CLAUDE_CONFIG_DIR`). O instalador grava no comando da linha de status e do `SessionStart` um id (hash da pasta) e o nome que o usuário dá à conta. Ler a variável em tempo de execução não serve, porque o Claude Code a remove dos subprocessos quando `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` está ligado.
- **Nomes (D8).** O coletor dá o nome quando o agente aparece, único no prédio, e nunca mais troca. Na migração, só o agente que começou depois, em cada par de nomes repetidos entre projetos, ganha nome novo.
- **3D.** Uma cena só, com câmera ortográfica no ângulo da maquete, pan, zoom, enquadrar, seguir e minimapa. Os móveis estáticos viram `InstancedMesh` por lote (uma chamada de desenho por material), cada ilha é um lote reconstruído sozinho, e os bonecos ficam num conjunto por chave, sem recriar todo mundo quando alguém chega.
- **Interface.** Mapa em tela cheia e peças flutuantes em `view/hud/` (HTML) e `app/` (controladores). As abas por projeto somem: a lista de salas é o atalho de câmera. O modo demonstração ganha cenas (`?modo=demo` mostra a história da maquete).
- **Plano.** 33 passos depois deste desenho (6.2 a 6.34), um agent escrevendo por vez, teste primeiro em todo passo de domínio. A Sede fica atrás de `?vista=sede` até o passo de troca.

## 2. Contexto e requisitos

### 2.1 Funcionais

| Requisito | Origem |
|---|---|
| Mapa único: fundo com reunião, copa, jogos e lounge; corredor; área de trabalho com ilhas de 6; recepção com a porta; quintal com gramado, caminho, estacionamento, mastro, árvores, bancos e letreiro "ORQUESTRA" | maquete |
| Uma ilha por projeto com tapete e divisória do tema; cadeiras vazias à vista; ilhas livres para projetos novos | maquete |
| Cápsula com a marca, "ao vivo" e busca `Ctrl K` (agente, sala ou ação) | maquete |
| Alerta no topo: quem precisa de você, comando, Permitir e Negar (A e N), "1 de N", tempo até voltar ao terminal | maquete |
| Anéis de uso de 5 h e da semana por conta; botão "Nova sessão" | maquete |
| Lista de salas com contagem por status; clique leva a câmera | maquete |
| Legenda das cores | maquete |
| Linha do tempo de hoje: trabalho por hora, marcas de espera, hora atual, último evento, "Ver atividade" | maquete |
| Câmera: zoom, enquadrar, minimapa | maquete |
| Ficha do agente em gaveta arrastável: status por extenso, seguir com a câmera, interromper, terminal ao vivo, mensagem | maquete |
| Trabalhando fica sentado na ilha; ocioso circula pelas áreas comuns compartilhadas; conversas (delegação sentada, entrega na mesa, papo no tempo livre, inclusive entre projetos); pensamentos; temperamento; gestos; entrada pela porta da recepção | README e pedido |
| Os 7 temas e o seletor "Escritório" por projeto continuam | plano, D8 |
| `?modo=demo` continua funcionando sem rede, porque vai para a landing | fase 8 |

### 2.2 Não funcionais

| Item | Meta |
|---|---|
| Volume | até 12 projetos com ilha e 60 agentes presentes ao mesmo tempo (sessões e subagentes); 25 a 30 vagas de tempo livre |
| Desempenho | 12 quadros por segundo estáveis (o loop já limita a 12) com 60 bonecos numa GPU integrada; tempo de render abaixo de 40 ms por quadro; menos de 1 500 chamadas de desenho com a Sede inteira na tela |
| Latência | pedido segurado aparece no alerta em até 0,5 s (hoje o empurrão do SSE espera 200 ms) |
| Tamanho do quadro SSE | os acréscimos desta fase somam menos de 3 KB por quadro; o feed não vai no quadro |
| Privacidade | só o necessário vai para o disco (seção 6.4) |
| Acessibilidade | tudo que o mapa faz tem caminho por teclado e leitor de tela (seção 10.3); movimento reduzido respeitado |
| Restrições | JS ESM, sem build, sem dependências npm, sem TypeScript; Clean Architecture com as regras de import da seção 6.3 do plano |
| Infraestrutura | nada muda: coletor no Docker ou pela CLI da fase 7, página estática; custo mensal zero |

### 2.3 Estado do código lido para este desenho

A refatoração das fases 1 a 3 está quase pronta e outro agent está nos passos 3.10 a 3.16 do web. Caminhos que existiam no momento da leitura e que este desenho usa:

- Web, domínio: `web/scripts/domain/room/{desk-islands, room-zones, room-layout, room-spots, room-routes, room-dimensions, wall-plan}.js`; `domain/behavior/{room-places, movement-plan, walk-step, agent-reactions, free-time-clock, agent-temperament, seated-fidgets, agent-thoughts}.js`; `domain/conversations/{conversations, conversation-tracker}.js`; `domain/office/{agent-names, agent-status, project-order, live-sessions, can-receive-messages, decision-body}.js`; `domain/shared/seeded-random.js`.
- Web, 3D: `web/scripts/three/kit.js`; `three/scene/{renderer, camera-framing, name-tags, thought-bubble}.js`; `three/furniture/{room, commons, decor, furniture, office-walls, parts}.js`; `three/people/{people, looks, poses, reactions, emotes}.js`.
- Web, borda: `web/scripts/app/{main, office-page, data-source, agent-panel, terminal-pane, panel-resizer, new-session-dialog, decision-form}.js`; `view/office/{tabs-view, team-view, room-view, usage-view, agent-badges, status-display}.js`; `view/sheet/{pending-request-view, agent-sheet-view}.js`; `infra/{office-api, runner-client, local-preferences}.js`; `infra/backends/{live-backend, demo-backend}.js`; `infra/demo/{demo-world, demo-terminal}.js`; `data/{themes, first-names, thoughts, conversation-lines, terminal-tools}.js`.
- Web, testes: `web/test/{architecture, contracts, room-rules, office-rules, agent-behavior, agent-conversations, movement-plan, walk-step, views, backends, terminal-format}.test.js`. O `architecture.test.js` ainda só confere imports e exports; as regras de camada entram no 3.15.
- Collector: `collector/src/composition.js`; `office/domain/{office-store, office-state, daily-stats, agent-expiry, agent-key, templates, dictionary}.js`; `office/application/{public-office-view, record-activity}.js`; `office/infra/office-state-file.js`; `claude/{claude-event, statusline-reading}.js`; `codex/codex-event.js`; `control/domain/pending-decisions.js`; `http/{office-api-routes, hook-routes, event-stream}.js`.
- Hooks: `hooks/{install-claude-hooks, office-statusline, office-session-start}.mjs`. A pasta `hooks/lib/` ainda não existe; ela vem da fase 4 e é pré-requisito do passo 6.6.

Se algum caminho do web mudar até o fim da fase 3, vale o destino da tabela 9.3 do plano.

## 3. O que muda em relação ao plano 11.1

| Plano 11.1 (campus) | Desenho aprovado (Sede) | Consequência |
|---|---|---|
| Cada projeto é uma sala com o tema inteiro (paredes, itens de parede, cantos, objetos de chão) | Cada projeto é uma ilha; o tema pinta tapete, divisória, mesas, cadeiras, monitores e teclados | `buildRoom` e `room-zones.js` não entram na Sede; saem no passo de limpeza |
| Atividades de tempo livre da sala do projeto ficam só para a equipe (campo "público" por ponto) | Todas as atividades estão em áreas comuns | Sem campo de público; a disputa por vaga é do prédio inteiro |
| Estante, arquivo, copiadora e janela por tema | A planta aprovada não tem estante, arquivo nem copiadora; a janela fica na copa | As atividades `books`, `filing` e `copier` deixam de existir (pergunta P4) |
| Tema do campus com seletor "Campus" opcional | Uma paleta fixa da Sede | `data/headquarters-palette.js`, sem seletor (D8 respondida) |
| Painel lateral com árvore projetos → agentes e feed embaixo | Peças flutuantes: lista de salas, linha do tempo, gaveta do agente, busca | `project-tree.js` não existe; a busca `Ctrl K` cobre o caminho até cada agente |
| "Meu dia" soma esperando você (`needs_you` e `waiting`) e trabalhando | "Esperando você" conta só `needs_you` (pergunta P3) | O Codex fica em `waiting` depois de todo turno e inflaria o número |
| Chegada pela recepção e pela calçada | Chegada pelo caminho do quintal até a porta da recepção | Ponto de chegada a 3 unidades da porta, como a "Iara · chegando" da maquete |

## 4. Planta da Sede

### 4.1 Eixos e unidades

As coordenadas da maquete `(x, y)` viram `(x, z)` no three.js, no mesmo sistema de hoje: origem no canto de trás à esquerda do prédio, `x` para a direita, `z` para a frente (em direção ao quintal), `y` para cima, 1 unidade igual a 1 unidade do kit atual (a altura do quadril em pé é 0,91). `D` é a profundidade do prédio: 18 com 2 fileiras de ilhas.

### 4.2 Casca e áreas

| Elemento | Posição | Altura | Observação |
|---|---|---|---|
| Prédio | x 0..26, z 0..D | | `D = 13,4 + 4,6 × (fileiras − 1)` |
| Parede do fundo (z = 0) e da esquerda (x = 0) | inteiras | 2,4 | são as paredes do lado oposto à câmera |
| Fachada da área de trabalho (z = D, x 0..20) | 4 vãos de 5 | mureta 0,5 e vidro de 0,5 a 2,0 (opacidade 0,28) | |
| Fachada da recepção (z = D, x 20..26) | mureta em 20..21,5 e 24..26 | 0,5 | porta principal em x 21,5..24 |
| Lado direito (x = 26) | inteiro | 0,5 | sem porta |
| Reuniões | x 0..7, z 0..6 | | piso `#c9cfdc` |
| Copa | x 7..14, z 0..6 | | piso `#ebe4d6` |
| Sala de jogos | x 14..20, z 0..6 | | piso `#3a3f5c` |
| Lounge | x 20..26, z 0..6 | | piso `#c4a882` |
| Divisórias entre as salas do fundo | x = 7, 14, 20; z 0..6 | 1,0 | |
| Frente das salas do fundo (z ≈ 5,9) | trechos 0..3; 4,2..7; 7..10; 11,2..14; 14..16,4; 17,8..20; 20..22,4; 23,8..26 | 1,0 | portas: reuniões 3..4,2; copa 10..11,2; jogos 16,4..17,8; lounge 22,4..23,8 |
| Corredor | x 0..26, z 6..8 | | piso `#e3ddd0` |
| Mureta entre corredor e área de trabalho (z = 8) | trechos 0..3,4; 5,2..9,4; 11,2..15,4; 17,2..20; 20..22,4; 23,6..26 | 0,5 | passagens: 3,4..5,2; 9,4..11,2; 15,4..17,2 (trabalho) e 22,4..23,6 (recepção) |
| Área de trabalho | x 0..20, z 8..D | | piso `#ddd6c8` |
| Recepção | x 20..26, z 8..D | | piso `#d9d4c7` |
| Divisória entre trabalho e recepção (x = 20) | z 8..11 e 13..D | 1,0 | passagem em z 11..13 |

### 4.3 Ilhas

| Item | Valor |
|---|---|
| Grade | 4 colunas: `x = 1 + 5c` (c = 0..3); fileiras: `z = 9,8 + 4,6r` |
| Ilha | 3,6 × 1,5: duas mesas de 0,7 de fundo e divisória de 0,1 no meio, com 1,15 de altura e os monitores |
| Tapete | de `(x − 0,5, z − 1,1)`, 4,6 × 3,7, cor `theme.rug` |
| Lugares | 3 por lado, 1,2 de largura; lado de trás em `z − 0,55` virado para a frente, lado da frente em `z + 1,65` virado para trás |
| Placa | rótulo flutuante "nome-do-projeto · Tema" no meio da ilha, a 2,5 de altura; ilha livre mostra "ilha livre · 6 lugares" |
| Vagas livres | sempre 2 ilhas livres depois da última ilha ocupada |
| Fileiras | `max(2, ceil((ilhas ocupadas + 2) / 4))` |
| Canto de convivência | os lugares de ilha que sobram na última fileira recebem bebedouro (1,2 × 0,8, altura 1,1) e plantas (0,9 × 0,9, alturas 1,1 e 1,3), como em x 12..14,6 e 16..19,6 da maquete; sem lugar sobrando, o bebedouro vai para a recepção em (25, D − 3) |

### 4.4 Móveis fixos das áreas comuns

| Área | Móvel | Posição (x, z) e tamanho |
|---|---|---|
| Reuniões | mesa | x 1,4..5,4, z 2,0..3,8, altura 0,75 |
| Reuniões | 6 cadeiras | x 1,8; 3,2; 4,6 em z 1,4 (viradas para a frente) e em z 4,0 (viradas para trás) |
| Reuniões | quadro branco na parede do fundo | x 1,6..5,2, de 1,0 a 2,1 de altura |
| Copa | balcão com café | x 7,4..12,8, z 0,3..1,1, altura 1,0 |
| Copa | geladeira | x 13..13,8, z 0,3..1,1, altura 1,9 |
| Copa | 2 mesas altas | 1 × 1 em (9, 3) e (11,4, 3,4), altura 0,7 |
| Copa | janela na parede do fundo | x 8..10, de 1,4 a 2,0 |
| Jogos | mesa de pingue-pongue com rede | x 15..18, z 2..3,6, altura 0,75 |
| Jogos | fliperama | x 19..19,8, z 0,4..1,2, altura 1,8 |
| Jogos | puff | (14,6, 4,6), 0,9 × 0,9, altura 0,4 |
| Lounge | sofá de 3 lugares | x 21..24, z 1..2, altura 0,5 |
| Lounge | mesa de centro | x 21,4..23, z 3,2..4,2, altura 0,4 |
| Lounge | planta | (24,8, 0,4) |
| Recepção | balcão | x 21,4..24,4, z 11,6..12,5, altura 1,0 |
| Recepção | placa "ORQUESTRA" na mureta do corredor | x 21,4..24,8, z 8,2, de 1,1 a 1,9, cor de destaque |
| Recepção | banco de espera | x 21..23,6, z D − 2,8..D − 2, altura 0,45 |
| Recepção | planta | (25, 9) |
| Recepção | figurante "recepção" atrás do balcão | (22,8, 11,1), sem ficha e sem clique |

### 4.5 Quintal (relativo à fachada, `z = D`)

| Elemento | Posição |
|---|---|
| Gramado | x −2..28, z −2..D + 9 |
| Caminho | x 21,5..23,9, z D..D + 9 |
| Estacionamento | x 1..10, z D + 3,4..D + 8, com 3 faixas de 2 em x 3; 5,2; 7,4 |
| Carros | (1,6, D + 4) e (4, D + 4,2), 1,6 × 1, altura 0,7 |
| Letreiro monumento | base x 10,2..21,2, z D + 3,4..D + 4,8, altura 0,15; bloco x 10,4..21, z D + 3,6..D + 4,6, altura 1,0, escuro, com "ORQUESTRA" na face da frente |
| Mastro | (24,6, D + 3,2), altura 4,2, bandeira de 1,3 na cor de destaque |
| Árvores | (−1,4, D + 1), (−1,2, D + 6), (10,6, D + 7,2), (20, D + 7), (26,4, D + 1), (26,6, D + 5,8), (27, 3), (27, 9), (27, 14) |
| Bancos | (14, D + 6,4) e (17, D + 6,4), 1,4 × 0,4 |
| Ponto de chegada | (22,7, D + 3), no caminho |

Limites do mapa para a câmera: x −2..28, z −2..D + 9.

## 5. Modelo e domínio

### 5.1 Da sala para a Sede

A sala de hoje é uma composição: `room-layout.js` junta as ilhas (`desk-islands.js`) e as zonas (`room-zones.js`: porta, parede do fundo, reunião, lounge, divisórias, corredores), e `room-spots.js` tira dela o catálogo de pontos. A Sede repete esse formato com outra composição:

```text
headquarters-layout = planta fixa (data) + ilhas por projeto (domínio) + quintal (data, relativo à fachada)
headquarters-spots  = mesas (por agente) + vagas de tempo livre (por móvel fixo e por canto de convivência) + chegada e saída
headquarters-routes = grafo de caminhada da planta + faixas da área de trabalho, que dependem do número de fileiras
```

O formato que sai dessas três funções é o mesmo que o renderer e as regras de comportamento já consomem: pontos `{ x, z, facing, isSeat, isDesk, hipY, approach? }`, um `routeFor(from, to)` e um mapa de lugares. Por isso `movement-plan.js`, `walk-step.js`, as reações e as conversas mudam pouco.

### 5.2 O que se reaproveita

| Arquivo | Na Sede | Mudança |
|---|---|---|
| `domain/room/desk-islands.js` | `teamsOf` (sessão e seus subagentes, em ordem de início), `islandsOf` (times em grupos de até 6) e `podAt` (geometria dos assentos) | Exportar as três, com largura do assento e capacidade como parâmetro. `deskRows`, `rowsOf` e `vacantPods` continuam só para a sala antiga e saem na limpeza |
| `domain/room/room-spots.js` | `seatStop`, `besideDeskStop` e o ajudante de ponto em pé | Exportar o ajudante (`standingStop`); `WALL_SPOTS`, `meetingStops` e `loungeStops` não servem (dependem das zonas da sala) |
| `domain/room/room-dimensions.js` | âncoras de quadril, cadeira e sofá | Ganha as âncoras novas: sofá de 3 lugares, cadeiras da mesa grande de reunião, puff, mesa alta |
| `domain/room/room-routes.js` | a convenção `approach` (o ponto escondido atrás de um obstáculo lista o próprio caminho de entrada, percorrido ao contrário na saída) | O resto (faixas e duas espinhas) não comporta várias salas; o grafo de caminhada substitui. Sai na limpeza |
| `domain/room/room-zones.js`, `room-layout.js`, `wall-plan.js` | não entram | Saem na limpeza, com `three/furniture/room.js` |
| `domain/behavior/movement-plan.js` | igual: recebe `routeFor` e a porta | Uma regra nova (seção 5.8) |
| `domain/behavior/walk-step.js` | igual | Nenhuma |
| `domain/behavior/room-places.js` | a mesma escolha | Passa a receber o catálogo e os lugares anteriores (seção 5.7) |
| `domain/behavior/agent-reactions.js` | `FREE_TIME`, `busyReactionOf`, `freeTimePreferences`, `isWindingDown`, `isHandingOver` | `FREE_TIME` ganha `pingpong`, `arcade` e `puff`; `books`, `filing` e `copier` saem na limpeza |
| `domain/behavior/{free-time-clock, agent-temperament, seated-fidgets, agent-thoughts}.js` | iguais | Nenhuma |
| `domain/conversations/conversations.js` | delegação, entrega e papo | `socialCircles` passa a exigir a mesma área (seção 5.8) |
| `domain/conversations/conversation-tracker.js` | igual | Repassa o `areaId` de cada pessoa |
| `domain/office/agent-names.js` | só como reserva para agentes sem `name` (demonstração e estado antigo) | Roda sobre o prédio inteiro |

### 5.3 Módulos novos

```text
web/scripts/
  data/
    headquarters-areas.js        salas comuns, corredor e recepção: limites, paredes, portas, móveis, vagas e trechos de caminhada fixos
    headquarters-yard.js         quintal relativo à fachada: gramado, caminho, estacionamento, carros, mastro, árvores, bancos, letreiro
    headquarters-palette.js      cores do prédio e do quintal, e um tema neutro no formato de THEMES para os móveis das áreas comuns
    sign-glyphs.js               letras 5x7 do letreiro
  domain/
    headquarters/
      island-grid.js             posição de cada lugar de ilha, número de fileiras, profundidade D, cantos de convivência
      project-islands.js         que ilhas cada projeto ocupa e quem senta onde (usa desk-islands)
      headquarters-layout.js     compõe planta, ilhas e quintal em { size, bounds, areas, islands, walls, doors, decor, yard }
      headquarters-spots.js      catálogo: mesas por agente, vagas de tempo livre com id e areaId, chegada e saída
      area-of-point.js           em que área está um ponto (lista de salas, conversas, pensamentos)
      minimap-shapes.js          retângulos do minimapa e a pegada da câmera no chão
    navigation/
      walk-graph.js              grafo genérico: nós, arestas, menor caminho, encaixe de ponto solto na aresta mais próxima
      headquarters-routes.js     monta o grafo da Sede e devolve routeFor(from, to)
    camera/
      viewpoint.js               enquadrar limites com margens da interface, zoom no cursor, pan, limites do mapa, interpolação
    site/
      sign-letters.js            texto → células de pixel do letreiro
    office/
      pending-queue.js           pedidos por prazo, posição "1 de N", tempo restante com o relógio do servidor
      day-timeline.js            horas locais de hoje a partir das fatias do coletor; totais; marcas; hora atual
      account-usage.js           contas em ordem, inicial, nível alto (80 %), leitura vencida
      area-census.js             contagem por status por ilha e por área comum
      headquarters-search.js     busca Ctrl K: agentes, salas, ações e a atividade atual de cada agente
      activity-feed.js           frase de cada evento do feed (fase 5)
```

Nomes de arquivo em inglês, como o resto do código: `headquarters` é a Sede.

### 5.4 Ilhas por projeto

Regras de `project-islands.js` e `island-grid.js`, todas puras e testadas:

1. **Ordem estável.** Projetos em ordem de `createdAt` e depois de chave. Não uso `sortedProjects`, porque ele reordena por "precisa de você" e por atualização, e as ilhas pulariam de lugar o tempo todo.
2. **Ilhas por projeto.** `max(1, ceil(agentes presentes / 6))`, contando sessões e subagentes, inclusive quem está saindo (hoje quem sai também guarda a mesa até o coletor esquecer o agente). As ilhas de um projeto ficam em lugares seguidos da grade, em ordem de leitura.
3. **Quem senta onde.** `teamsOf` e `islandsOf` de hoje: a sessão e os subagentes dela juntos, em ordem de início, 6 por ilha; assento `i` na coluna `floor(i / 2)`, alternando os lados, como `podAt` já faz.
4. **Papéis de `.claude/agents`.** Ocupam só as cadeiras vazias das ilhas do projeto, como placa de mesa reservada. Hoje cada grupo de 6 papéis cria uma ilha a mais; na Sede isso faria um projeto com 40 papéis ocupar 7 ilhas. Papel que não cabe não aparece. É barato de reverter (uma regra pura).
5. **Toda sala aberta tem ilha.** O mesmo conjunto das abas de hoje: um projeto some quando o usuário fecha a sala ou depois de 30 dias parado (`isRoomAbandoned`). Pergunta P2.
6. **Fechar um projeto** desloca as ilhas seguintes um lugar. Quem estava sentado aparece sentado na mesa nova, sem levantar (regra da seção 5.8).
7. **Tema.** A ilha leva o `themeById(project.template)` inteiro; o 3D lê `rug`, `divider` (a divisória, como na maquete), `desk`, `leg`, `cabinet`, `chair`, `screen`, `keyboard`, `items` e `accent`; a lista de salas usa `floor` com `divider` na amostra. O catálogo `data/themes.js` não muda e o teste de contrato dos 7 ids continua.

### 5.5 Catálogo de pontos e vagas

`headquarters-spots.js` devolve `{ desks: Map<agentKey, stop>, freeTime: Map<activityId, Spot[]>, exit, arrival }`. Cada vaga tem `id` estável (por exemplo `pantry:coffee:2`), `areaId`, `activityId`, o ponto e o acesso ao grafo.

| Atividade (`id`) | Área | Vagas | Reação |
|---|---|---|---|
| `coffee` | copa: balcão (3) e mesas altas (4) | 7 | `coffee` |
| `window` | copa: janela sobre o balcão | 1 | `gazing` |
| `water` | bebedouro do canto de convivência (ou da recepção) | 1 | `water` |
| `board` | reuniões: quadro | 1 | `drawing` |
| `meeting` | reuniões: cadeiras | 6 | `meeting` |
| `pingpong` | jogos: uma em cada ponta da mesa | 2 | `playing` (nova) |
| `arcade` | jogos: fliperama | 1 | `gaming` (nova) |
| `puff` | jogos: puff | 1 | `resting` (o cochilo de hoje; pose própria é opcional) |
| `sofa` | lounge: sofá | 3 | `resting` |
| `plant` | plantas do canto de convivência, do lounge e da recepção | 3 a 4 | `watering` |

Total de 26 a 27 vagas. Com mais gente livre que vagas, quem sobra alonga na própria mesa, como hoje (`AT_DESK_WITH_NOTHING_TO_DO`). `FIRST_FREE_ACTIVITY` continua: pausa e espera vão primeiro ao café, livre vai primeiro ao sofá.

### 5.6 Rotas pelo corredor

`walk-graph.js` é genérico e puro: nós `{ id, x, z }`, arestas entre nós (cada aresta é um trecho reto livre), menor caminho por Dijkstra (até uns 120 nós, sem custo que importe) e encaixe de um ponto solto na aresta mais próxima, que é o que `nearestLaneZ` faz hoje para quem foi pego no meio do caminho.

`headquarters-routes.js` monta o grafo:

| Trecho | Como |
|---|---|
| Corredor | faixa em z = 7, de x 0,6 a 25,4, com nó em cada porta e passagem |
| Salas do fundo | nó na porta do lado de dentro (z 5,2) ligado ao corredor; faixa interna em z 5,2 de parede a parede da sala; vagas atrás de móveis com `approach` |
| Área de trabalho | duas faixas por fileira, em `z − 1,15` e `z + 2,65`; espinhas verticais em x 0,5; 5,3; 10,3; 15,3, de z 8,6 a D − 0,6; ligações às passagens do corredor (x 4,3; 10,3; 16,3) |
| Recepção | passagem do corredor (x 23) até z 9,5; faixa em z 14 de x 20,8 a 25,4; ligação com a área de trabalho pela passagem de x = 20 (z 12) contornando o balcão por x 20,8; porta principal (22,75, D − 0,6) → (22,75, D + 0,6) → chegada |

A rota completa é a de hoje com o grafo no meio:

```text
approach de origem ao contrário → acesso da origem → menor caminho no grafo → acesso do destino → approach do destino → destino
```

Os trechos fixos ficam como dado em `data/headquarters-areas.js`; os da área de trabalho são calculados pelo número de fileiras. O teste principal confere, para 1 a 12 projetos, que nenhuma aresta atravessa parede, divisória, ilha ou móvel e que todo ponto do catálogo é alcançável a partir da chegada.

### 5.7 Escolha de atividade com vários projetos e sem dois na mesma vaga

`assignPlaces` passa a receber um objeto: `assignPlaces({ agents, now, spots, freeSince, previous })`. A sala antiga continua chamando com `roomSpots(layout)` até a limpeza, sem mudar resultado.

```js
export function assignPlaces({ agents, now, spots, freeSince, previous }) {
  const places = new Map();
  const taken = new Set();
  const byKey = [...agents].sort((a, b) => a.key.localeCompare(b.key));
  const wishes = new Map();
  for (const agent of byKey) {
    const fixed = fixedPlaceOf(agent, now, spots, freeSince);
    if (fixed) places.set(agent.key, fixed);
    else wishes.set(agent.key, freeTimePreferences(agent, now, freeSince.get(agent.key) ?? agent.updatedAt));
  }
  for (const [key, wish] of wishes) {
    const kept = keptSpot(previous.get(key), wish, spots);
    if (kept) claim(places, taken, key, kept);
  }
  for (const [key, wish] of wishes) {
    if (places.has(key)) continue;
    const spot = firstFreeSpot(wish, spots, taken);
    places.set(key, spot ? freeTimePlace(spot) : stretchingAtDesk(spots.desks.get(key)));
    if (spot) taken.add(spot.id);
  }
  return withHandoffs(places, agents, now, spots);
}
```

- **Um passo para o prédio inteiro.** Todos os agentes de todos os projetos disputam o mesmo catálogo. A ordem pessoal de atividades de cada um (sorteada pela chave) não muda, então ninguém anda em sincronia com o vizinho, e agentes de projetos diferentes se encontram na copa.
- **Vaga com id e conjunto de ocupadas.** Uma vaga só vai para uma pessoa por passo; o teste com 30 agentes querendo café confere que nenhum id se repete.
- **Quem já está fica.** Antes da distribuição, quem está numa vaga (ou andando até ela) da atividade que continua sendo a primeira escolha disponível dele mantém a vaga. Hoje, com a ordem por chave, alguém com chave menor que fica livre tira o outro do lugar; no prédio isso aconteceria muito mais. Lugares anteriores vêm do próprio renderer (o mapa do passo anterior).
- **Ordem por chave como desempate.** Continua determinística: com os mesmos dados, o mesmo resultado em qualquer aparelho.
- **Ocupado, terminando o turno, saindo, entregando.** Iguais a hoje: mesa, mesa, saída (`exit`), ao lado da mesa do agente principal.

### 5.8 Comportamentos que continuam

| Comportamento | Como fica na Sede | Onde |
|---|---|---|
| Trabalhando fica sentado na ilha | `fixedPlaceOf` devolve a mesa | `room-places.js` |
| Ocioso circula pelas áreas comuns | catálogo do prédio, troca de atividade a cada 30 a 55 s pelo temperamento | `room-places.js`, `agent-reactions.js` |
| Volta apressada quando chega trabalho | rota pelo corredor com `isUrgent`; o ritmo apressado continua igual | `movement-plan.js`, `walk-step.js` |
| Mesas mudam de lugar e quem estava sentado não levanta | regra nova no plano: pessoa sentada numa mesa cuja mesa mudou recebe `{ kind: "place" }`. Hoje isso só funciona porque a sala é recriada e a pessoa nasce sem posição; com o conjunto de bonecos persistente, a regra precisa ser explícita | `movement-plan.js` |
| Entrada pela porta da recepção | `arrival` no caminho do quintal; quem chega numa Sede já vista anda da chegada até a mesa | `movement-plan.js` (`room.door` = chegada) |
| Saída | anda até a porta principal e some ao chegar | `exit` |
| Delegação sentada | mesma ilha, os dois na mesa | `conversations.js` |
| Entrega em mãos | subagente vai para o lado da mesa do principal na mesma ilha | `room-places.js` |
| Papo no tempo livre, inclusive entre projetos | círculo por distância (2) e mesma `areaId`; sem isso, duas pessoas encostadas na divisória entre copa e jogos conversariam através dela | `conversations.js` |
| Pensamentos (no máximo 3) | os 3 mais recentes entre os bonecos visíveis na câmera | renderer |
| Temperamento, gestos na mesa, piscar | iguais | `three/people/` |
| Movimento reduzido | todo mundo aparece no lugar; câmera pula sem animação | renderer, `viewpoint.js` |

## 6. Dados novos do collector

### 6.1 O que já existe no estado publicado

| Dado | Onde | Serve para |
|---|---|---|
| Fila de pedidos com prazo | `pending[]` com `id`, `agentKey`, `kind`, `toolName`, `summary`, `detail` (o comando), `questions`, `createdAt`, `expiresAt` (`control/domain/pending-decisions.js`) | alerta, "1 de N", tempo até voltar ao terminal; só memória |
| Atividade recente | `agent.log` (20 últimas por agente) e `agent.action` | último evento da linha do tempo, status por extenso na ficha |
| Números do dia por projeto | `project.stats` (pedidos, ferramentas, turnos, tokens, custo), com o dia em UTC | ficha da ilha |
| Uso do plano | `usage.rateLimits` de uma conta só | substituído por `accounts` |
| Tema | `project.template` | ilha |
| Papéis | `project.team` | placas de mesa reservada |

### 6.2 O que entra no collector

| Dado | Domínio novo | Público | Disco | Por quê |
|---|---|---|---|---|
| Linha do tempo do dia | `office/domain/status-timeline.js` | sim | sim | não existe tempo por status; só contadores |
| Contas | `office/domain/accounts.js`; `claude/statusline-reading.js` e `claude/claude-event.js` leem `office.account` | sim | sim (id opaco, rótulo dado pelo usuário, porcentagens) | uso por conta |
| Conta de cada sessão | `agent.accountId` na sessão; subagente herda | sim | sim | "conta P" na ficha |
| Nome do agente | `office/domain/agent-names.js`, `first-names.js`, `name-hash.js` | sim | sim | seção 8 |
| Feed de atividade | `office/domain/activity-log.js` (anel de 500), alimentado por `office/application/record-activity.js`; rota `GET /api/activity` | por endpoint, fora do quadro SSE | não | `agent.log` some quando o agente expira (subagente 15 min depois de terminar) |
| Relógio do servidor | `generatedAt` em `office/application/public-office-view.js` | sim | não | contagem regressiva certa no celular com relógio diferente |

**Linha do tempo.** Fatias de 1 hora com chave em milissegundos do início da hora (UTC). O navegador junta as fatias da data local de hoje, então funciona em qualquer fuso de hora cheia; em fuso de meia hora as barras ficam deslocadas até 45 min (risco anotado). Funções puras e imutáveis:

```js
export const SLOT_MS = 3_600_000;
export function emptyTimeline() { return { slots: [], open: { since: null, working: 0, needsYou: 0 } }; }
export function countsOf(agents) { /* working: working|reviewing; needsYou: needs_you; encerrados não contam */ }
export function advanceTimeline(timeline, now, counts) { /* fecha [open.since, now) nas fatias, partindo nas viradas de hora */ }
export function markNeedsYou(timeline, at) { /* +1 na marca da fatia */ }
export function addCost(timeline, at, costUsd) { /* custo da fatia */ }
export function pruneTimeline(timeline, now) { /* mantém 48 h */ }
```

Fatia: `{ start, workingMs, workingAgentMs, needsYouMs, needsYouAgentMs, needsYouCount, costUsd }`. `workingMs` é tempo de relógio com pelo menos um agente trabalhando (o "trabalhando 2 h 16" da maquete); `workingAgentMs` soma o tempo de cada agente e dá a altura da barra (média de agentes trabalhando na hora). O store chama `advanceTimeline` no fim de `apply`, `sweep` e `closeProject` com a contagem recalculada sobre todos os agentes (n pequeno, sem rastrear transições), `markNeedsYou` quando um evento leva um agente para `needs_you` e `addCost` em `recordUsage` com o mesmo crescimento que já vai para `stats.costUsd`. O intervalo aberto não dispara gravação nem quadro: o navegador fecha `open` com o relógio do servidor na hora de desenhar. O custo "hoje" da linha do tempo passa a ser do dia local do usuário, e não do dia UTC de `stats`.

**Contas.** `accounts: { [id]: { id, label, rateLimits, updatedAt } }`. `recordUsage` grava a leitura na conta da leitura (ou na conta `default`, rótulo "Claude", quando o hook ainda não manda conta). A conta sem leitura há 8 dias sai no `sweep`. Durante a transição, `usage` continua publicado com a leitura mais recente, para a página antiga; ele sai no passo de troca.

**Feed.** Entrada: `{ at, agentKey, projectKey, name, label, kind, text }` e, com a fase 5, os campos estruturados que ela definir para a ação (`activity`, `subject`). O nome vai gravado na entrada, então o feed continua certo depois que o agente expira e o nome é reaproveitado.

### 6.3 Contrato

Acréscimos ao estado público e o endpoint novo, em OpenAPI 3.1. O estado inteiro continua chegando por `GET /api/state` e pelo SSE `GET /api/stream`.

```yaml
openapi: 3.1.0
info: { title: Orquestra Office collector, version: "fase-6" }
paths:
  /api/activity:
    get:
      summary: Feed de atividade, do mais novo para o mais antigo
      parameters:
        - { name: limit, in: query, schema: { type: integer, minimum: 1, maximum: 200, default: 100 } }
        - { name: before, in: query, description: "at do evento mais antigo da página anterior (epoch ms)", schema: { type: integer } }
      responses:
        "200": { content: { application/json: { schema: { $ref: "#/components/schemas/ActivityPage" } } } }
        "400": { description: limit ou before inválido }
        "403": { description: pedido vindo de outro site (mesma guarda de /api/state) }
components:
  schemas:
    OfficeStateAdditions:
      type: object
      required: [accounts, timeline, generatedAt]
      properties:
        generatedAt: { type: integer, description: relógio do coletor (epoch ms) }
        accounts: { type: object, additionalProperties: { $ref: "#/components/schemas/Account" } }
        timeline: { $ref: "#/components/schemas/Timeline" }
        usage: { deprecated: true, description: só até o passo de troca }
    AgentAdditions:
      type: object
      properties:
        name: { type: string, maxLength: 24 }
        accountId: { type: [string, "null"] }
    Account:
      type: object
      required: [id, label, rateLimits, updatedAt]
      properties:
        id: { type: string, pattern: "^([0-9a-f]{12}|default)$" }
        label: { type: string, maxLength: 24 }
        rateLimits:
          type: [object, "null"]
          properties:
            fiveHour: { $ref: "#/components/schemas/RateWindow" }
            sevenDay: { $ref: "#/components/schemas/RateWindow" }
        updatedAt: { type: integer }
    RateWindow:
      type: [object, "null"]
      properties:
        usedPercentage: { type: number, minimum: 0, maximum: 100 }
        resetsAt: { type: integer }
    Timeline:
      type: object
      required: [slotMs, slots, open]
      properties:
        slotMs: { const: 3600000 }
        slots: { type: array, maxItems: 48, items: { $ref: "#/components/schemas/TimelineSlot" } }
        open:
          type: object
          properties:
            since: { type: [integer, "null"] }
            working: { type: integer }
            needsYou: { type: integer }
    TimelineSlot:
      type: object
      required: [start, workingMs, workingAgentMs, needsYouMs, needsYouAgentMs, needsYouCount, costUsd]
      properties:
        start: { type: integer }
        workingMs: { type: integer }
        workingAgentMs: { type: integer }
        needsYouMs: { type: integer }
        needsYouAgentMs: { type: integer }
        needsYouCount: { type: integer }
        costUsd: { type: number }
    ActivityPage:
      type: object
      required: [entries, nextBefore]
      properties:
        entries: { type: array, items: { $ref: "#/components/schemas/ActivityEntry" } }
        nextBefore: { type: [integer, "null"] }
    ActivityEntry:
      type: object
      required: [at, agentKey, projectKey, name, label, kind, text]
      properties:
        at: { type: integer }
        agentKey: { type: string }
        projectKey: { type: string }
        name: { type: string }
        label: { type: string }
        kind: { enum: [main, subagent] }
        text: { type: string, maxLength: 120 }
```

Entrada dos hooks, acrescentada ao corpo que a linha de status e o `SessionStart` já mandam: `office.account = { id, label }`. O coletor aceita só `id` no formato do contrato e `label` com letras, números, espaço, ponto, hífen e sublinhado, até 24 caracteres; fora disso, a leitura vai para `default`.

O teste de contrato do web (`web/test/contracts.test.js`) ganha: forma de `accounts`, `timeline` e `generatedAt`; mesma lista de nomes e mesmo hash nos dois lados; `ActivityEntry` montada pelo `record-activity` vira frase em `activity-feed.js`.

### 6.4 Privacidade

| Dado | Disco | Por quê está ok |
|---|---|---|
| Linha do tempo | sim | totais de tempo e custo, sem texto, como `stats` hoje |
| Conta | sim | id é hash da pasta de configuração (não grava o caminho, que costuma ter o nome do usuário do sistema); rótulo é o que o usuário escolheu |
| Nome do agente | sim | sai da lista de primeiros nomes; não identifica ninguém |
| Feed | não | o mesmo texto de `agent.log` (que já vai para o disco), mas o anel fica só na memória e some ao reiniciar |
| Pedido pendente com o comando | não | inalterado |

O README, em "O que fica guardado", ganha a linha do tempo, o nome de cada conta e o nome dos agentes.

## 7. Contas (D8)

### 7.1 O que a documentação oficial diz

- **Linha de status.** A página lista todos os campos do JSON recebido no stdin: `model`, `cwd`, `workspace` (pastas e repositório), `cost`, `context_window`, `exceeds_200k_tokens`, `fast_mode`, `effort`, `thinking`, `rate_limits` (`five_hour`, `seven_day`, `spend_limit`), `prompt_cache`, `session_id`, `session_name`, `prompt_id`, `transcript_path`, `version`, `output_style`, `vim`, `agent`, `pr`, `worktree`. Nenhum identifica conta, organização ou usuário. `rate_limits` só aparece para assinantes Pro, Max e Ultra (ou atrás de um gateway com limite de gasto) e depois da primeira resposta da sessão. Fonte: [Customize your status line](https://code.claude.com/docs/en/statusline).
- **Hooks.** Os campos comuns de entrada são `session_id`, `prompt_id`, `transcript_path`, `cwd`, `scratchpad_dir`, `permission_mode`, `effort`, `hook_event_name`, mais `agent_id` e `agent_type` em subagentes. Nenhum identifica a conta. O hook herda o ambiente do processo pai. Fonte: [Hooks reference](https://code.claude.com/docs/en/hooks).
- **`CLAUDE_CONFIG_DIR`.** "Override the configuration directory (default: `~/.claude`). All settings, session history, and plugins are stored under this path. [...] Useful for running multiple accounts side by side: for example, `alias claude-work='CLAUDE_CONFIG_DIR=~/.claude-work claude'`." Fonte: [Environment variables](https://code.claude.com/docs/en/env-vars).
- **A armadilha.** Na mesma página, a tabela do que o `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` faz diz que `CLAUDE_CONFIG_DIR` é removida do ambiente dos subprocessos, "such as Bash commands, hooks, and stdio MCP servers". Fonte: [Environment variables, "What the subprocess environment scrub removes"](https://code.claude.com/docs/en/env-vars).

Conclusão: não há campo de conta. A conta só pode ser inferida pela pasta de configuração, e ler a variável no hook falha para quem liga a limpeza do ambiente.

### 7.2 Plano B recomendado: conta gravada no comando na instalação

Cada pasta de configuração tem o próprio `settings.json`, e o instalador já grava nele o comando da linha de status e o do `SessionStart`. Então o instalador sabe a pasta (a mesma resolução de hoje: `CLAUDE_CONFIG_DIR` ou `~/.claude`) e grava a conta nos dois comandos:

```text
node "<hooks>/office-statusline.mjs" --account 3fa9c2e1b7d4 --account-name "Trabalho"
node "<hooks>/office-session-start.mjs" --account 3fa9c2e1b7d4 --account-name "Trabalho"
```

- **Id.** Os 12 primeiros caracteres hexadecimais do SHA-256 do caminho absoluto da pasta (no Windows, em minúsculas). Estável, opaco e sem o caminho.
- **Rótulo.** `--account-name` na instalação. Sem ele: "Principal" para `~/.claude` e o nome da pasta sem o ponto inicial para as outras (`.claude-work` vira `claude-work`). Para renomear, roda o instalador de novo naquela pasta.
- **Hooks.** A linha de status passa a ler o JSON, acrescentar `office.account` e mandar ao coletor (hoje repassa o texto cru); a linha impressa no terminal ganha o rótulo na frente. O `SessionStart` acrescenta `office.account` ao lado de `repoRoot` e `team`. Os hooks HTTP não mudam: a conta da sessão fica marcada no primeiro `SessionStart` ou na primeira leitura da linha de status.
- **Sessões abertas pelo executor** herdam a pasta de configuração do processo do executor e, com ela, os hooks daquela pasta: a conta vem certa sem mudança no runner.
- **Uso no README.** `node hooks/install-claude-hooks.mjs --account-name Pessoal` e, para a segunda conta, no PowerShell `$env:CLAUDE_CONFIG_DIR = "$HOME\.claude-work"; node hooks/install-claude-hooks.mjs --account-name Trabalho`, no Git Bash ou macOS `CLAUDE_CONFIG_DIR="$HOME/.claude-work" node hooks/install-claude-hooks.mjs --account-name Trabalho`.

Alternativas descartadas:

| Opção | Por que não |
|---|---|
| Ler `CLAUDE_CONFIG_DIR` no hook em tempo de execução | some com a limpeza do ambiente; o caminho bruto iria para o coletor |
| Ler `oauthAccount` do arquivo de configuração do Claude Code | não documentado, pode mudar sem aviso, e traz e-mail e organização (dado pessoal que o projeto não precisa) |
| Agrupar por igualdade das porcentagens de `rate_limits` | duas contas com o mesmo uso se fundem; uma conta muda de "identidade" a cada leitura |
| Rótulo editável pela página | exige rota de escrita nova e não resolve o id; fica para depois se o usuário pedir |

O Codex não informa uso e não entra em contas.

## 8. Nomes únicos na Sede inteira (D8)

Hoje cada sala chama `withAgentNames` sozinha: ordena por chave, tenta o nome `hash(chave) % 64` e, se estiver tomado, o seguinte. No prédio, só aplicar a mesma função a todos os agentes gera dois problemas: quem já está na tela muda de nome quando surge alguém com chave menor e o mesmo nome preferido (com 64 nomes e 20 agentes a colisão é quase certa), e cada aparelho calcula sozinho.

| Opção | Troca de nomes | Mesmo nome no PC e no celular | Feed depois que o agente sai | Custo |
|---|---|---|---|---|
| A. A função de hoje sobre o prédio inteiro, no navegador | a cada chegada que colide, ao vivo | sim | não (o nome depende de quem está presente) | mínimo |
| B. Nomes guardados no navegador, uma vez dados não mudam | só na primeira vez | não | só no aparelho que viu | baixo |
| C. O coletor dá o nome quando o agente aparece e grava (recomendada) | só na migração, uma vez | sim | sim (o nome vai na entrada do feed) | médio |

**Regra recomendada (C).**

1. **Agente novo:** `nameFor(key, nomesEmUso)` com o mesmo hash FNV-1a e a mesma lista de 64 nomes de hoje: o nome preferido, ou o seguinte livre no prédio inteiro. Com mais de 64 agentes presentes, o nome menos usado ganha número (`Ana 2`). O nome nunca muda enquanto o agente existir; quando ele expira, o nome volta a ficar livre.
2. **Migração do estado gravado** (agentes sem `name`): primeiro, por projeto, o algoritmo de hoje, o que reproduz o que o usuário vê agora; depois, percorrendo todos os agentes por `startedAt` e chave, cada um mantém esse nome se ele ainda estiver livre no prédio; se não, recebe `nameFor`. Em cada grupo de `k` agentes com o mesmo nome, só `k − 1` trocam, que é o mínimo possível, e quem trabalha há mais tempo fica com o nome.
3. **No web,** `agent-names.js` continua como reserva para agente sem `name` (estado antigo, demonstração), rodando sobre o prédio inteiro.
4. **Contrato:** a lista de nomes passa a existir em `collector/src/office/domain/first-names.js` e em `web/scripts/data/first-names.js`; o teste de contrato confere que as duas e o hash são iguais e que a migração bate com `withAgentNames` por projeto. É o mesmo arranjo de `TEMPLATE_IDS` e `THEMES`.

## 9. Renderização

### 9.1 Da sala para a Sede no `three/`

| Hoje (`three/scene/renderer.js`) | Sede |
|---|---|
| Uma sala; `rebuild` recria a sala e todos os bonecos quando a assinatura muda | Uma cena com três tipos de peça: casca e áreas comuns (montadas uma vez), uma peça por ilha (reconstruída sozinha quando a assinatura da ilha muda: projeto, tema, ocupantes, monitores acesos, papéis, posição) e um conjunto de bonecos por chave (criado quando o agente aparece, retirado quando ele some) |
| `lastSeen` evita teleporte ao recriar a sala | Bonecos persistem; `lastSeen` fica só para quem é criado de novo |
| `frameRoom` ajusta a câmera à sala | `camera-rig.js` com o estado de `viewpoint.js` |
| Etiquetas de todos | Etiquetas cortadas fora da tela; compactas no zoom distante |
| `assignPlaces` sobre `room.layout` | `assignPlaces` sobre `headquarters-spots`, com lugares anteriores |

Arquivos do `three/`:

```text
three/
  kit.js                         + vidro (transparente) e material branco para cor por instância
  scene/headquarters-renderer.js loop, ilhas por assinatura, conjunto de bonecos, lugares, rotas, conversas, pensamentos
  scene/camera-rig.js            câmera ortográfica no ângulo da maquete; aplica o viewpoint; sol e sombra cobrindo o mapa
  scene/camera-input.js          roda, arraste, pinça, teclado; clique e arraste separados por 4 px
  scene/static-batch.js          troca as malhas estáticas de um grupo por InstancedMesh por geometria e material
  scene/area-labels.js           rótulos das áreas e das ilhas (DOM, como as etiquetas)
  scene/frame-meter.js           ?medir=1: chamadas de desenho, triângulos e tempo de quadro (só desenvolvimento)
  scene/name-tags.js             + corte fora da tela e modo compacto
  furniture/headquarters-shell.js pisos por área, paredes, divisórias, muretas, vidro, portas
  furniture/common-rooms.js      reuniões, copa, jogos, lounge e recepção
  furniture/island.js            uma ilha com o tema do projeto (tapete, desk, station, vacantStation, placas)
  furniture/yard.js              gramado, caminho, estacionamento, carros, mastro, árvores, bancos
  furniture/monument-sign.js     base, bloco e letras do letreiro
```

`three/scene/renderer.js`, `camera-framing.js` e `furniture/room.js` continuam servindo a página antiga até o passo de troca.

### 9.2 Câmera

- **Ângulo.** O da maquete: isométrico verdadeiro, girado 45° em torno do eixo vertical e inclinado cerca de 35°, olhando da frente e da direita. As paredes inteiras (fundo e esquerda) ficam do lado oposto à câmera e as muretas baixas (frente e direita) do lado dela, como na maquete. A sala de hoje usa câmera de frente a 58°; os móveis atuais funcionam nos dois ângulos (itens de parede viram para a frente, assentos para a mesa). Os dois ângulos são duas constantes em `camera-rig.js`. Pergunta P1.
- **Zoom.** `OrthographicCamera.zoom`, do "enquadrar a Sede" até cerca de 4 vezes (uma ilha ocupando um terço da tela). Roda e pinça no trackpad aproximam no ponto do cursor.
- **Pan.** Arrastar no mapa vazio, um dedo no toque, setas com o mapa em foco. Limitado aos limites do mapa com margem.
- **Enquadrar.** Encaixa os limites pedidos (Sede inteira, uma ilha, uma área) descontando as margens da interface: coluna da esquerda, faixa de baixo e a gaveta quando aberta. É uma função pura (`frameBounds(bounds, viewport, insets)`) testada sem navegador.
- **Ir até a sala.** Interpolação de 350 ms; com movimento reduzido, pulo direto.
- **Seguir agente.** A cada quadro o alvo da câmera vai para o quadril do boneco; mexer na câmera desliga o seguir. O botão da ficha mostra o estado (`aria-pressed`).
- **Clique.** Raio na cena: boneco abre a ficha do agente; ilha (tapete ou mesa) abre a ficha da ilha. O raio pega primeiro os bonecos; as peças de ilha guardam `projectKey` em `userData`.
- **Minimapa.** Canvas 2D de 132 × 84, desenhado a partir de `minimap-shapes.js` (planta vista de cima, ilhas com a cor do tapete, contorno de aviso na ilha com alguém precisando de você) e da pegada da câmera no chão (os quatro cantos da tela projetados no plano `y = 0`, que no ângulo isométrico formam um losango). Clicar ou arrastar no minimapa centraliza a câmera.

### 9.3 Desempenho

Estimativa pelo código atual (cada `box` é uma malha com a geometria e o material compartilhados):

| Parte | Malhas | Com 12 ilhas e 60 bonecos |
|---|---|---|
| Estação de trabalho (teclado, monitor, cadeira, objetos) | cerca de 18 | 6 por ilha |
| Mesa da ilha (tampo, pés, gaveteiro, divisória, bilhetes) | cerca de 19 | por ilha |
| Ilha inteira | cerca de 130 | 1 560 |
| Boneco (tronco, braços, cabeça, olhos, pernas, objetos, balão) | cerca de 26 | 1 560 |
| Casca, áreas comuns e quintal | cerca de 500 | 500 |
| Total | | cerca de 3 600 malhas; com a passada de sombra, perto de 7 000 chamadas de desenho por quadro |

Isso não cabe em 83 ms por quadro numa GPU integrada. As medidas, na ordem:

1. **Lote estático (`static-batch.js`).** Depois de montar uma peça com as funções de hoje, as malhas de caixa e cilindro sem textura viram um `InstancedMesh` por geometria e por tipo de material (Lambert ou brilho), com a matriz e a cor de cada instância. Pisos e paredes com textura continuam malhas soltas (poucas). Cada ilha vira 3 ou 4 chamadas; casca, áreas comuns e quintal, umas 20. O código dos móveis não muda.
2. **Corte por peça.** O `InstancedMesh` de cada ilha tem esfera envolvente própria (`computeBoundingSphere` depois de preencher as matrizes), então o three.js deixa de desenhar ilhas fora da tela quando há zoom. Bonecos já são cortados por malha.
3. **Nível de detalhe dos bonecos.** No zoom distante: sem olhos nem objetos na mão, sem sombra projetada pelos bonecos, pensamentos escondidos e etiquetas compactas (bolinha de status e nome curto).
4. **Sombra.** Mapa de 2 048 cobrindo os limites do mapa uma vez, `BasicShadowMap` como hoje.
5. **Resolução.** Continua `ART_PIXEL = 2` e `setPixelRatio(1)`: a cena é desenhada na metade da resolução da tela, o que também dá o serrilhado de pixel art nas bordas giradas.
6. **Medir antes de desenhar a arte.** O passo 6.9 aplica o lote estático na sala de hoje e anota os números com `?medir=1`; o 6.26 mede uma cena de estresse da demonstração (12 ilhas, 60 agentes). Meta da seção 2.2. Se não fechar, o próximo recurso é juntar os bonecos distantes num `InstancedMesh` de corpo simples (uma caixa por boneco).

O quadro SSE leva hoje 20 entradas de `log` por agente (perto de 1,2 KB por agente, 70 KB com 60 agentes). Esta fase não aumenta isso de forma relevante; cortar o `log` público para as 3 últimas entradas, já que o feed tem endpoint próprio, fica como melhoria opcional do passo de troca.

### 9.4 Os 7 temas nas ilhas

`furniture/island.js` monta a ilha com as funções que já existem: `rug` (cor `theme.rug`), `desk` com `{ ...theme, partition: theme.divider }` (a divisória da maquete usa a cor de divisória do tema), `station` com o monitor aceso ou apagado e `vacantStation` para as cadeiras vazias. Ilha livre usa o tema neutro da paleta da Sede. Trocar o tema de um projeto muda a assinatura só da ilha dele, que é reconstruída sem piscar as outras. O 6.11 testa a regra (cada ilha recebe o tema do seu projeto) e o 6.20 confere os 7 temas lado a lado na cena de demonstração `cena=temas`.

### 9.5 Letreiro

Letras em pixel, não texto de fonte do sistema: `data/sign-glyphs.js` guarda letras 5 × 7 (A a Z), `domain/site/sign-letters.js` transforma "ORQUESTRA" em células `{ col, row }` (puro e testado: largura, espaço entre letras, letra desconhecida vira espaço) e `furniture/monument-sign.js` desenha as células como um `InstancedMesh` de cubos na cor de destaque, encostado na face da frente do bloco. Uma chamada de desenho, o mesmo resultado em qualquer sistema e o visual dos outros objetos. Uma textura de canvas com texto foi descartada porque depende da fonte instalada e fica borrada no zoom.

### 9.6 Arte nova

| Peça | Reaproveita | Novo |
|---|---|---|
| Casca | `tiledSlab` (pisos com padrão por área, paredes com textura) | muretas, vidro, batentes de porta |
| Reuniões | `chair` de `furniture.js`, `wallItem("board")` | mesa grande de 6 lugares |
| Copa | `wallItem("copa")` esticado no balcão, `wallItem("window")` | geladeira, mesas altas |
| Jogos | `prop("arcade")` | mesa de pingue-pongue com rede, puff |
| Lounge | `loungeSet` (sofá e mesa de centro), `prop("bigPlant")` | sofá de 3 lugares se o de hoje for de 2 |
| Recepção | `prop("bench")`, `createPerson` com chave de figurante | balcão, placa |
| Quintal | `prop("tree")`, `prop("bench")` | gramado, caminho, asfalto com faixas, carros, mastro e bandeira |
| Bonecos | poses e reações de hoje | `playing` (raquete, balanço), `gaming` (em pé, mãos no painel); falas novas em `data/thoughts.js` |

## 10. Interface

### 10.1 Peças flutuantes

| Peça da maquete | `view/` (HTML em string, sem estado) | `app/` (DOM e eventos) | `domain/` (regra pura) |
|---|---|---|---|
| Cápsula: marca, "ao vivo", busca | `view/hud/connection-view.js` | `app/headquarters-page.js` | |
| Busca `Ctrl K` | `view/hud/search-results-view.js` | `app/command-palette.js` | `office/headquarters-search.js` |
| Alerta "precisa de você" | `view/hud/pending-alert-view.js` | `app/pending-alert.js` (A e N, contagem regressiva, envio por `decision-form.js`) | `office/pending-queue.js` |
| Contas e "Nova sessão" | `view/hud/accounts-view.js` | botão abre `new-session-dialog.js` | `office/account-usage.js` |
| Lista de salas | `view/hud/area-list-view.js` | `app/area-list.js` (câmera vai até a sala) | `office/area-census.js` |
| Ficha da ilha (tema, fechar sala, números do dia) | `view/sheet/island-sheet-view.js` | `app/island-panel.js` | |
| Legenda | `view/hud/legend-view.js` (lê `STATUS` de `status-display.js`) | | |
| Linha do tempo | `view/hud/day-timeline-view.js` | `app/headquarters-page.js` | `office/day-timeline.js` |
| "Ver atividade" | `view/hud/activity-feed-view.js` | `app/activity-panel.js` | `office/activity-feed.js` |
| Câmera e minimapa | `view/hud/camera-controls-view.js` | `app/minimap.js` | `camera/viewpoint.js`, `headquarters/minimap-shapes.js` |
| Ficha do agente em gaveta | `view/sheet/agent-sheet-view.js` (+ seguir, + conta) | `app/agent-panel.js`, `app/panel-resizer.js` | |
| Atalhos | | `app/keyboard-shortcuts.js` | |

Esqueleto: um `<template id="headquarters-shell">` em `web/index.html` com as regiões fixas (cápsula, alerta, contas, lista, legenda, linha do tempo, câmera, gaveta, região de anúncios). Estilo em `web/styles/headquarters.css`, só com tokens; a maquete usa cores cruas (`rgb(17 17 20 / 0.92)`, `rgb(29 26 18 / 0.95)`), que viram tokens novos em `tokens.css` (`--bg-floating`, `--warning-surface`).

A "Fechar sala" e o seletor "Escritório" saem do cabeçalho da sala (que não existe mais) e vão para a ficha da ilha, aberta pela lista de salas, pelo rótulo da ilha ou pelo clique na ilha. A ficha da ilha usa a mesma gaveta da ficha do agente e mostra os números do dia por projeto que hoje ficam em `room-view.js`.

### 10.2 O que se reaproveita

| Arquivo | Na Sede |
|---|---|
| `app/terminal-pane.js` | igual, dentro da gaveta |
| `app/panel-resizer.js` | igual; o alvo passa a ser a gaveta (`--panel-width`) |
| `app/agent-panel.js` | abrir, atualizar e fechar continuam; não esconde mais a lista "Quem está aqui" (ela some) e devolve o foco a quem abriu a ficha |
| `app/decision-form.js` | igual; o alerta chama `submitDecision` |
| `app/new-session-dialog.js` | igual; a pasta sugerida é o projeto da ilha em foco |
| `view/sheet/pending-request-view.js` | `renderPendingCard` continua na gaveta (motivo da recusa, perguntas); `renderPendingStrip` sai com a lista "Quem está aqui" |
| `view/office/usage-view.js` | `resetTime` e a regra de 80 % passam para os anéis; o arquivo sai na troca |
| `view/office/{agent-badges, status-display}.js` | iguais |
| `view/sheet/agent-sheet-view.js` | ganha "Seguir com a câmera" e a conta na identidade |
| `view/office/{tabs-view, team-view, room-view}.js` | saem na troca; `dayStats` de `room-view.js` vai para a ficha da ilha |

### 10.3 Acessibilidade

- **Caminho por teclado até cada agente.** A busca `Ctrl K` (e `Cmd K` no macOS) aberta sem texto lista todos os agentes agrupados por sala, quem precisa de você primeiro, mais as salas e as ações. Enter abre a ficha e leva a câmera. As etiquetas sobre os bonecos continuam botões para o mouse, mas saem da ordem de tabulação (`tabindex="-1"`), porque 60 paradas de Tab no mapa não servem a ninguém.
- **Busca.** `<dialog>` modal com o padrão combobox: campo com `role="combobox"`, `aria-controls` para a lista, `aria-activedescendant`, setas, Enter e Esc; grupos com `role="group"` e rótulo; foco volta para quem abriu.
- **Mapa.** Região com `tabindex="0"`, rótulo "Mapa da Sede" e instrução em texto oculto: setas movem, `+` e `-` aproximam e afastam, `0` enquadra, Esc para de seguir.
- **Alerta.** Região com rótulo. Pedido novo anunciado numa região `aria-live="polite"` ("Vitor, em loja-online, quer rodar um comando"). A contagem regressiva não é anunciada a cada segundo; só um aviso aos 30 s.
- **Atalhos A e N.** Só valem com o foco dentro do alerta. Uma tecla solta aprovando um comando em qualquer lugar da página é um risco de aprovação acidental, e o critério 2.1.4 do WCAG pede que atalho de uma tecla só funcione com foco no componente ou possa ser desligado. A busca tem a ação "Ir para o pedido", que põe o foco no alerta.
- **Gaveta.** Não modal; ao abrir, foco no botão de fechar (como hoje); Esc fecha e devolve o foco a quem abriu (resultado da busca, lista, etiqueta ou mapa).
- **Anéis.** `role="meter"` com rótulo por extenso ("Trabalho, janela de 5 horas, 12 por cento").
- **Linha do tempo.** Barras com `aria-hidden`; resumo em texto ("trabalhando 2 h 16, esperando você 4 min") e uma tabela oculta de horas.
- **Minimapa.** Canvas com `aria-hidden`; a lista de salas é o caminho equivalente.
- **Status.** Sempre glifo e texto, como no design system; a legenda inclui "bloqueado", que a maquete não mostra.
- **Movimento reduzido.** Câmera pula, ninguém anda, seguir sem suavização.

### 10.4 Telas pequenas

No celular (modo rede local), abaixo de 720 px: cápsula e alerta no topo; lista, legenda, linha do tempo e câmera numa folha de baixo com abas; gaveta em tela cheia; um dedo move e pinça aproxima.

## 11. Migração

### 11.1 Abas por projeto

| Opção | Prós | Contras |
|---|---|---|
| Abas viram atalhos de câmera | familiar | duplica a lista de salas da maquete, que já é exatamente isso, e ocupa a faixa de cima onde a maquete põe o alerta |
| Abas somem (recomendada) | a lista de salas faz o papel: uma linha por ilha com contagem por status, clique leva a câmera, e os contadores "precisa de você" continuam lá e no minimapa | quem usava a aba para "abrir" um projeto passa a usar a lista ou a busca |

Recomendo que sumam. A preferência `office.selected` deixa de existir; a ilha em foco vale só durante a visita.

### 11.2 Transição

Até o passo de troca (6.33), a página antiga continua padrão e a Sede abre com `?vista=sede`: `app/main.js` lê o parâmetro e importa `headquarters-page.js` ou `office-page.js` por import dinâmico. O coletor publica `usage` e `accounts` juntos nesse período. No passo de troca, a Sede vira padrão, o template vira o corpo do `index.html` e o legado sai.

Sai na troca: `view/office/{tabs-view, team-view, room-view, usage-view}.js`, `app/office-page.js`, `three/scene/{renderer, camera-framing}.js`, `three/furniture/room.js`, `domain/room/{room-layout, room-zones, wall-plan, room-routes}.js`, as partes de `desk-islands.js` e `room-spots.js` sem uso, as atividades `books`, `filing` e `copier` (com reações e pensamentos), `usage` no estado público, as partes sem uso de `office.css` e os testes e saídas de referência correspondentes.

### 11.3 Modo demonstração

- `?modo=demo` continua escolhendo o backend de demonstração sem tocar a rede (passo 3.10). Com a Sede padrão, mostra a história da maquete: orquestra-office (Laboratório) com Heitor, Davi, Nina e Caio; loja-online (Café) com Vitor precisando de você para `npx prisma migrate deploy` e Otto; jogo-de-plataforma (Fliperama) com Téo, Luca e Rui; site-institucional (Jardim) com Malu; Sílvia e Lívia na reunião, Rosa e Duda na copa, Tiago e Nara no pingue-pongue, Gabi no sofá, Bia levando um resultado, Iara chegando; contas Pessoal (37 % e 84 %) e Trabalho (12 % e 41 %); linha do tempo do dia; feed. Os nomes vão escritos nos dados de exemplo (`agent.name`), para a landing bater com a maquete.
- Cenas por parâmetro: `?modo=demo&cena=reacoes` (a sala "reações" de hoje, para conferir gestos e falas), `cena=temas` (7 projetos, um por tema, criada no 6.20) e `cena=estresse` (12 ilhas, 60 agentes, criada no 6.26, para medir).
- O backend de demonstração ganha `loadActivity` (lista local); `backends.test.js` confere que os dois backends expõem os mesmos métodos.
- Arquivos: `infra/demo/demo-headquarters.js`, `demo-reactions.js`, `demo-themes.js`, `demo-stress.js` e `demo-day.js` (linha do tempo e feed de exemplo); `demo-world.js` fica só com a simulação (tick, resolver pedido, fila).

## 12. Infraestrutura e custo

Nada muda: o coletor continua no Docker (`compose.yaml`) ou, na fase 7, pela CLI; a página continua estática servida pelo coletor e, na fase 8, no GitHub Pages em modo demonstração. Custo mensal: zero. O `web/` montado no container exige, como hoje, reconstruir a imagem quando o coletor muda e só recarregar a página quando o web muda; collector e web mudam juntos nos passos de contrato.

## 13. Plano de execução

### 13.1 Regras

- Um agent escrevendo por vez, na ordem da tabela. Só revisões rodam em paralelo.
- "Teste primeiro": o agent escreve o teste vermelho, roda, implementa até ficar verde. Vale para todo passo de domínio.
- Comandos de verificação do plano (seção 10.1 de `plano-de-refatoracao.md`): V-C, V-R, V-W, V-H, V-Docker, V-Browser. Este documento acrescenta o V-Sede:
  - Endereços: `http://localhost:8420/?vista=sede` e `http://localhost:8420/?modo=demo&vista=sede` (sem `vista` depois do 6.33).
  - Roteiro: comparar com a maquete (salas, ilhas, quintal, letreiro); os 7 temas lado a lado (`cena=temas`); trabalhando sentado; livres pela copa, jogos, lounge e reunião sem dois na mesma vaga; volta apressada pelo corredor; subagente entra pela recepção, delegação sentada, entrega na mesa, saída pela porta; papo entre projetos na copa; no máximo 3 pensamentos na área visível; gestos e piscar; zoom, pan, enquadrar, minimapa; clique na lista leva a câmera; seguir agente; alerta com A e N (com foco no alerta), "1 de N" e contagem; anéis por conta; linha do tempo e "Ver atividade"; `Ctrl K`; gaveta arrastável e Esc; tudo só pelo teclado; NVDA anunciando pedido novo; movimento reduzido ligado; console sem erro; em `?modo=demo`, nenhuma requisição fora dos arquivos estáticos.
- Dependência da fase 5 marcada na coluna "F5": "sim" quando o passo lê os campos estruturados.

### 13.2 Passos

| Passo | Agent | Arquivos | Verificação | Esperado | Teste primeiro | F5 |
|---|---|---|---|---|---|---|
| 6.1 Este desenho | `fullstack-architect` | `docs/arquitetura/fase-6-sede.md` | revisão do usuário | aprovado, perguntas respondidas | | |
| 6.2 ADRs 0003 a 0005 (seção 14; o 0002 é o da autenticação, fase S) e nota na seção 11.1 do plano apontando para cá | `productivity-docs` | `docs/adr/0003-sede-em-salao-aberto.md`, `0004-nomes-pelo-coletor.md`, `0005-conta-pela-pasta-de-configuracao.md`, `docs/arquitetura/plano-de-refatoracao.md` | leitura | decisões registradas | | |
| 6.3 Nomes pelo coletor e migração | `backend-node-typescript` (JavaScript) | `collector/src/office/domain/{first-names, name-hash, agent-names}.js`, `office-store.js`, `office-state.js`, `collector/test/office-names.test.js`, `web/test/contracts.test.js` | V-C, V-W | agente novo ganha nome único no prédio; estado antigo troca só os repetidos; contrato verde | sim | |
| 6.4 Linha do tempo do dia | `backend-node-typescript` | `office/domain/status-timeline.js`, `office-store.js`, `office-state.js`, `collector/test/status-timeline.test.js`, `office-store.test.js` | V-C | fatias certas com horários injetados, virada de hora, 48 h, marca de pedido, custo; sem gravação extra por tempo passando | sim | |
| 6.5 Contas no coletor | `backend-node-typescript` | `office/domain/accounts.js`, `claude/statusline-reading.js`, `claude/claude-event.js`, `office-store.js`, `office/domain/agent-expiry.js`, testes | V-C | leitura com conta vai para a conta; sem conta vai para `default`; rótulo e id saneados; sessão e subagentes com `accountId`; `usage` continua | sim | |
| 6.6 Hooks com conta (precisa da fase 4 e da fase S: desde o ADR 0002, o `SessionStart` e a linha de status continuam `node "<arquivo>"`, a atividade é `curl` em forma exec com `args` e as decisões são `office-decision.mjs` com `--office-url` e `--secret-file`; o `--account` entra nesses comandos) | `backend-node-typescript` | `hooks/lib/{claude-settings, account-id}.mjs`, `hooks/install-claude-hooks.mjs`, `hooks/office-statusline.mjs`, `hooks/office-session-start.mjs`, `hooks/test/*` | V-H; instalar em duas pastas temporárias (`CLAUDE_CONFIG_DIR`) e conferir os dois `settings.json`; sessão real mostrando o rótulo na linha de status | comandos com `--account` e `--account-name`; reinstalar não duplica; remover limpa | sim | |
| 6.7 Feed de atividade | `backend-node-typescript` | `office/domain/activity-log.js`, `office/application/record-activity.js`, `http/office-api-routes.js`, `composition.js`, testes | V-C | anel de 500 em memória; `limit` e `before`; 403 de outro site; nenhum texto de pedido do usuário no feed | sim | sim |
| 6.8 Visão pública e contrato | `backend-node-typescript` | `office/application/public-office-view.js`, `web/test/contracts.test.js`, `collector/test/server.test.js` | V-C, V-W, V-Docker | `accounts`, `timeline`, `generatedAt` no estado; contrato verde; imagem no ar | sim | |
| 6.9 Lote estático e medição na sala de hoje | `fullstack-feature` | `three/scene/{static-batch, frame-meter}.js`, `three/kit.js`, `three/furniture/room.js`, `three/scene/renderer.js` | V-W, V-Browser (cena idêntica, 7 temas), números de `?medir=1` antes e depois anotados no relatório | chamadas de desenho da sala caem para menos de 10 % | | |
| 6.10 Grafo de caminhada | `fullstack-feature` | `domain/navigation/walk-graph.js`, `web/test/walk-graph.test.js` | V-W | menor caminho, encaixe de ponto solto, sem ponto repetido, grafo desconexo devolve vazio | sim | |
| 6.11 Planta e ilhas | `fullstack-feature` | `data/headquarters-{areas, yard, palette}.js`, `domain/headquarters/{island-grid, project-islands, headquarters-layout}.js`, `domain/room/desk-islands.js` (exportar com parâmetros), `web/test/headquarters-layout.test.js` | V-W | coordenadas da seção 4 com 4 projetos; crescimento por fileira; ordem estável; 2 ilhas livres; projeto com 8 agentes ocupa 2 ilhas; papéis só em cadeiras vazias; 7 temas; `room-rules.test.js` sem mudar asserção | sim | |
| 6.12 Catálogo de pontos | `fullstack-feature` | `domain/headquarters/{headquarters-spots, area-of-point}.js`, `domain/behavior/agent-reactions.js`, `domain/room/{room-spots, room-dimensions}.js`, testes | V-W | vagas da seção 5.5 com id único e área; chegada e saída; atividades novas em `FREE_TIME` | sim | |
| 6.13 Rotas da Sede | `fullstack-feature` | `domain/navigation/headquarters-routes.js`, `web/test/headquarters-routes.test.js` | V-W | para 1 a 12 projetos, nenhuma aresta atravessa parede, divisória, ilha ou móvel; todo ponto alcançável da chegada | sim | |
| 6.14 Escolha de lugar no prédio | `fullstack-feature` | `domain/behavior/room-places.js`, `three/scene/renderer.js` (nova assinatura, mesmo resultado), `web/test/agent-behavior.test.js` | V-W, V-Browser (sala de hoje igual) | 30 agentes sem vaga repetida; quem está fica; ocupado na mesa; entrega ao lado da mesa; testes antigos verdes | sim | |
| 6.15 Movimento e conversa | `fullstack-feature` | `domain/behavior/movement-plan.js`, `domain/conversations/{conversations, conversation-tracker}.js`, testes | V-W | sentado continua sentado quando a mesa muda; papo exige mesma área; projetos diferentes conversam na copa | sim | |
| 6.16 Regras dos painéis | `fullstack-feature` | `domain/office/{pending-queue, day-timeline, account-usage, area-census, headquarters-search}.js`, `domain/office/agent-names.js`, `web/test/hud-rules.test.js` | V-W | ordem por prazo, "1 de N", tempo com relógio do servidor; horas locais, totais, marcas, faixa visível de 8 h a 20 h ampliada pelo uso; nível alto 80 %; contagens; busca por nome, sala, ação e atividade atual | sim | |
| 6.17 Frases do feed | `fullstack-feature` | `domain/office/activity-feed.js`, testes | V-W | "Bia entregou a tarefa para Heitor em orquestra-office" a partir dos campos | sim | sim |
| 6.18 Câmera, minimapa e letreiro puros | `fullstack-feature` | `domain/camera/viewpoint.js`, `domain/headquarters/minimap-shapes.js`, `domain/site/sign-letters.js`, `data/sign-glyphs.js`, testes | V-W | enquadrar com margens; zoom no cursor mantém o ponto; limites; pegada no minimapa; letras certas | sim | |
| 6.19 Revisão do domínio (somente leitura) | `productivity-code-reviewer` | nenhum | relatório | camadas, nomes, testes | | |
| 6.20 Arte estática da Sede | `fullstack-feature` | `three/furniture/{headquarters-shell, common-rooms, island, yard, monument-sign}.js`, `three/scene/camera-rig.js`, `app/main.js` (`?vista=sede`), `infra/demo/demo-themes.js` e o parâmetro `cena` em `infra/backends/demo-backend.js` | V-W, V-Sede (só a cena, sem gente; comparar com a maquete; `cena=temas`) | planta igual à seção 4; 7 temas nas ilhas | | |
| 6.21 Gente na Sede | `fullstack-feature` | `three/scene/{headquarters-renderer, area-labels, name-tags}.js` | V-W, V-Sede (roteiro de comportamento) | comportamentos da seção 5.8 | | |
| 6.22 Câmera interativa | `fullstack-feature` | `three/scene/camera-input.js`, `headquarters-renderer.js`, `camera-rig.js` | V-Sede (mouse, toque, teclado, movimento reduzido) | pan, zoom, enquadrar, seguir | | |
| 6.23 Poses e falas novas | `fullstack-feature` | `three/people/{poses, reactions}.js`, `data/thoughts.js` | V-W (contratos de pensamento), V-Sede | pingue-pongue e fliperama animados | | |
| 6.24 Esqueleto da interface | `fullstack-feature` | `web/index.html` (template), `web/styles/{headquarters, tokens}.css`, `app/headquarters-page.js`, `view/hud/connection-view.js`, `web/test/views.test.js` | V-W, V-Sede | mapa em tela cheia, peças nos lugares da maquete | | |
| 6.25 Alerta | `fullstack-feature` | `view/hud/pending-alert-view.js`, `app/{pending-alert, keyboard-shortcuts}.js`, saídas de referência | V-W, V-Sede (aprovar, negar, pergunta abre a ficha, decidir no terminal pela ficha) | A e N só com foco; contagem; anúncio | | |
| 6.26 Desempenho | `fullstack-feature` | `headquarters-renderer.js`, `name-tags.js`, `people/people.js` (detalhe distante), `infra/demo/demo-stress.js` | `?modo=demo&cena=estresse&vista=sede&medir=1` | metas da seção 2.2 | | |
| 6.27 Contas e lista de salas | `fullstack-feature` | `view/hud/{accounts-view, area-list-view, legend-view}.js`, `view/sheet/island-sheet-view.js`, `app/{area-list, island-panel}.js`, saídas de referência | V-W, V-Sede (trocar o tema de uma ilha, fechar sala, Nova sessão) | anéis por conta; contagem por status; tema e fechar na ficha da ilha | | |
| 6.28 Gaveta do agente | `fullstack-feature` | `app/{agent-panel, panel-resizer}.js`, `view/sheet/agent-sheet-view.js`, saídas de referência | V-W, V-Sede (terminal ao vivo, mensagem, interromper, seguir, arrastar a largura, Esc devolve o foco) | ficha da maquete | | |
| 6.29 Linha do tempo e atividade | `fullstack-feature` | `view/hud/{day-timeline-view, activity-feed-view}.js`, `app/activity-panel.js`, `infra/office-api.js`, `infra/backends/{live-backend, demo-backend}.js`, `web/test/backends.test.js` | V-W, V-Sede | barras, marcas, hora atual, último evento, feed paginado | | sim |
| 6.30 Câmera na interface | `fullstack-feature` | `view/hud/camera-controls-view.js`, `app/minimap.js` | V-Sede | botões e minimapa movem a câmera | | |
| 6.31 Busca `Ctrl K` | `fullstack-feature` | `view/hud/search-results-view.js`, `app/command-palette.js` | V-W, V-Sede (só teclado e NVDA) | agentes, salas e ações; foco devolvido | | |
| 6.32 Demonstração | `fullstack-feature` | `infra/demo/*`, `infra/backends/demo-backend.js`, `web/test/backends.test.js` | V-W, V-Sede em `?modo=demo` com o DevTools sem requisição externa; as quatro cenas | landing pronta para a Sede | | |
| 6.33 Troca e limpeza | `fullstack-feature`, depois `productivity-docs` | lista da seção 11.2; `collector/src/office/application/public-office-view.js` (sem `usage`); `web/test/*`; `README.md` (vida no escritório, atividades, contas, o que fica guardado, instalação com `--account-name`) | V-C, V-W, V-H, V-Docker, V-Sede completo | Sede é a página; nenhum arquivo morto; README atual | | |
| 6.34 Revisões (somente leitura, em paralelo) | `productivity-code-reviewer` (código e acessibilidade com a seção 10.3), `security-appsec` (atalhos de aprovação, endpoint novo, rede local), `security-privacy-lgpd` (o que vai para o disco) | nenhum | relatórios | correções voltam como passos novos | | |

Paralelismo: a revisão 6.19 pode rodar junto com o 6.20, e as três revisões do 6.34 rodam juntas. Uma revisão de segurança e privacidade do bloco do coletor (6.3 a 6.8) pode rodar junto com o 6.9. Todo o resto é sequencial.

## 14. ADRs propostos

Viram arquivos em `docs/adr/` no passo 6.2.

**ADR 0003: Sede em salão aberto, uma ilha por projeto.** Contexto: o desenho aprovado troca o campus de salas por um escritório térreo aberto. Decisão: cada projeto ocupa ilhas de 6 lugares numa grade de 4 colunas que cresce por fileiras; reunião, copa, jogos e lounge são comuns; o tema do projeto pinta a ilha; a Sede usa uma paleta fixa. Substitui a última frase do item 8 do ADR 0001 (sala de projeto com o tema e áreas comuns com tema de campus). Consequências: `room-zones.js`, `room-layout.js`, `wall-plan.js`, `room-routes.js` e `furniture/room.js` saem; atividades ligadas a estante, arquivo e copiadora deixam de existir; o catálogo dos 7 temas não muda. Alternativa descartada: o campus do plano 11.1, que não é o desenho aprovado.

**ADR 0004: Nome do agente dado e gravado pelo coletor.** Contexto: nomes únicos no prédio, estáveis e iguais em todos os aparelhos. Decisão: o coletor dá o nome na criação do agente, único entre os presentes, com o hash e a lista de hoje; migração mantém o nome atual e troca só o repetido de quem começou depois. Consequências: a lista de nomes existe nos dois pacotes, presa por teste de contrato; o feed guarda o nome do momento. Alternativas descartadas: a função de hoje sobre o prédio (renomeia ao vivo) e nomes guardados no navegador (diferem entre aparelhos).

**ADR 0005: Conta identificada pela pasta de configuração, gravada no comando na instalação.** Contexto: nenhum campo da linha de status nem dos hooks identifica a conta, e `CLAUDE_CONFIG_DIR` some dos subprocessos com a limpeza do ambiente. Decisão: o instalador grava `--account <hash da pasta>` e `--account-name <rótulo>` nos comandos da linha de status e do `SessionStart`; os hooks mandam `office.account`. Consequências: cada conta precisa do instalador rodado na pasta dela; quem não reinstala fica na conta `default`; o caminho da pasta nunca sai da máquina do usuário em texto. Alternativas descartadas: variável em tempo de execução, `oauthAccount` não documentado, agrupar por porcentagens.

## 15. Riscos

| Risco | Mitigação |
|---|---|
| Desempenho em GPU integrada e no celular | medição no 6.9 antes da arte e no 6.26 com estresse; lote estático, corte por ilha, detalhe distante; plano seguinte: corpo simples instanciado para bonecos distantes |
| Etiquetas sobrepostas com muitos agentes | modo compacto no zoom distante; corte fora da tela |
| Caminhadas longas comem o tempo livre (ilha até o lounge, cerca de 25 unidades, 17 s) | o ritmo é um parâmetro de `walk-step`; ajustar no 6.21 olhando o V-Sede |
| A maquete é 2D; alturas e o ângulo no 3D podem destoar | comparação lado a lado no 6.20; ângulo em duas constantes (P1) |
| Migração de nomes troca alguns nomes uma vez | só o repetido que começou depois; registrado no ADR 0004 |
| Conta: quem não reinstala os hooks fica em "Claude"; quem tem linha de status própria não tem uso por conta (como hoje) | README e mensagem do instalador |
| Fuso de meia hora desloca as barras até 45 min | anotado; fatia menor se alguém precisar |
| O Codex não informa trabalho, só fim de turno | não entra em "trabalhando"; já descrito no README |
| Aprovação acidental com a tecla A | só com foco no alerta (seção 10.3); revisão no 6.34 |
| Prédio cresce com muitos projetos parados | "Fechar sala" na ficha da ilha; regra de 30 dias; P2 |
| Contrato muda nos dois lados | passos de contrato com teste; `usage` mantido até a troca; imagem reconstruída junto |
| O feed some quando o coletor reinicia | aceito: só memória por privacidade |
| A fase 3 ainda move arquivos do web | caminhos desta leitura na seção 2.3; vale o destino da tabela 9.3 do plano |
| Quadro SSE grande com 60 agentes (logs) | corte opcional do `log` público no 6.33 |

## 16. Perguntas ao usuário (respondidas)

| Id | Pergunta | Recomendação |
|---|---|---|
| P1 | Ângulo da câmera: o da maquete (isométrico, girado 45°) ou o de hoje (de frente, inclinado 58°)? | O da maquete. É o que foi aprovado, cabe melhor em tela larga e as paredes inteiras ficam do lado oposto à câmera. Trocar depois são duas constantes. |
| P2 | Projeto sem ninguém continua com ilha (como as abas hoje, até fechar a sala ou 30 dias) ou a ilha só aparece quando há agente presente? | Continua com ilha. É previsível, mantém o seletor de tema à mão e o usuário fecha pela ficha da ilha. |
| P3 | "Esperando você" conta só pedido de permissão ou pergunta (`needs_you`), ou também sessão parada esperando mensagem (`waiting`)? | Só `needs_you`. O Codex fica em `waiting` depois de todo turno e o Claude Code depois de 60 s parado; somar isso daria horas no fim do dia e o número deixaria de dizer quanto você atrasou os agentes. |
| P4 | Estante, arquivo e copiadora não estão na planta aprovada. As três atividades de tempo livre somem, ou volta algum desses móveis para uma área comum? | Somem. Copa, jogos, lounge e reunião já dão 26 vagas e seis atividades diferentes; o README é atualizado no 6.33. |

Em 18/11/2026 o usuário aceitou as quatro recomendações: P1 câmera da maquete, P2 a ilha fica até fechar a sala, P3 "esperando você" conta só `needs_you`, P4 estante, arquivo e copiadora saem.
