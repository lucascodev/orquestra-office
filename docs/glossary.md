# Glossary

The product terms in English and Brazilian Portuguese. The README, the community files and the landing page use these names, so the same thing has the same name everywhere.

> **Português.** Este glossário fixa o nome de cada termo do produto em inglês e em português. Ao escrever em qualquer uma das duas línguas, use os nomes da tabela.

## Rules

- **Orquestra Office** is the product name and is never translated.
- **Sede** is a proper noun, like the name of a building. In English, write "the Sede (HQ)" the first time it appears on a page or in a section, and "the Sede" after that. Use "HQ" alone only where space is tight, such as alt text or a badge.
- The office interface is in Portuguese only. When English text names a button or label, write the English name and, if the reader needs to find it on screen, the Portuguese label in parentheses: "click Allow (Permitir)".
- Code identifiers, commands and query parameters stay as they are in both languages: `?modo=demo`, `collector/`, `runner/`.

## Places

| English | Português | Notes |
|---|---|---|
| office | escritório | The whole app: the page plus the collector behind it. "Live office" is the one showing real sessions, as opposed to the demo. |
| Sede (HQ) | Sede | The single page of the office: one building with every project and the common areas. |
| island | ilha | One cluster of desks per project folder, where that project's agents sit. |
| room | sala | Any place on the map: an island or a common area. |
| common areas | áreas comuns | The rooms that belong to no project. |
| meeting room | Sala de reuniões | Common area. |
| pantry | Copa | Common area. |
| game room | Sala de jogos | Common area. |
| lounge | Lounge | Common area. |
| island theme | tema da ilha | The look of an island: Lab (Laboratório), Café, Library (Biblioteca), Garage (Garagem), Space station (Estação espacial), Garden (Jardim), Arcade (Fliperama). |

## People and states

| English | Português | Notes |
|---|---|---|
| agent | agente | A Claude Code or Codex session shown in the office. |
| main agent | agente principal | The session itself, as opposed to its subagents. |
| subagent | subagente | A helper agent started by a main agent. |
| character | boneco | The pixel figure that represents an agent on the map. Not "avatar" or "sprite". |
| session | sessão | One Claude Code or Codex session. |
| working | trabalhando | Status. Sits at the desk. |
| reading or researching | lendo ou pesquisando | Status. Sits at the desk. |
| needs you | precisa de você | Status. A permission request or a question is waiting. |
| waiting for your reply | terminou e espera sua resposta | Status. The turn ended. |
| stopped with an error | parou com um erro | Status. |
| on break | em pausa | Status. |
| idle | livre | Status. No task. |
| thought bubble | pensamento | The balloon above a character with what it is doing. |
| conversation | conversa | Characters talking to each other in the common areas. |

## Interface

| English | Português | Notes |
|---|---|---|
| drawer | gaveta | The side panel on the right. It holds one sheet at a time. |
| agent sheet | ficha do agente | The agent's details, live terminal and message box, shown in the drawer. |
| Now, Tasks, Plan and Tests tabs | abas Agora, Tarefas, Plano e Testes | The four tabs of the agent sheet. |
| tag | etiqueta | The label over a character with its name, title and status color. |
| sign | sinal | The mark on the tag of an agent at work: ⚗ testing, ✓ or ✕ test result, ✎ writing a test, ☰ checklist. |
| checklist | checklist | The agent's own task list, in the Tasks (Tarefas) tab and as ☰ 4/7 on the tag. |
| plan | plano | What the agent proposes before acting, approved with Approve plan (Aprovar plano) or sent back with Keep planning (Continuar planejando). Not the same as plan usage. |
| test run | rodada de testes | One run of a test command: its counts and up to 10 failures. |
| timeline | linha do tempo | The list of the day's events in the Today panel, such as test runs and approved plans. |
| island sheet | ficha da ilha | Who works on the island, its day, its theme and closing the room, shown in the drawer. |
| bottom sheet | folha de baixo | The panel that slides up on phones, with the Rooms, Today, Accounts and Legend tabs. |
| live terminal | terminal ao vivo | The terminal of a session opened by the runner, which accepts messages and can be interrupted. |
| read-only terminal | terminal somente leitura | The history of a session that was not opened by the runner. |
| permission alert | alerta de permissão | The alert at the top of the screen with Allow (Permitir) and Deny (Negar). It also shows an agent's questions. |
| request | pedido | A permission request or a question from an agent. The header button is Requests (Pedidos). |
| decide in the terminal | decidir no terminal | Send the request back to the session's own terminal. |
| search | busca | Opened with `Ctrl K` (or `Cmd K`). Finds agents, rooms and actions. Not "command palette" in docs. |
| legend | legenda | What each color means. |
| Today panel | painel Hoje | Hours worked, time waiting for you and cost for the day. |
| accounts | contas | Claude accounts and their plan usage. |
| plan usage | uso do plano | The 5-hour and weekly limits. |
| minimap | minimapa | |
| follow with the camera | seguir com a câmera | |
| queued message | mensagem na fila | A message waiting for the session's next turn. |
| new session | nova sessão | Opens a session through the runner. |

## System

| English | Português | Notes |
|---|---|---|
| collector | coletor | The server on port 8420 that receives hook events and serves the page. |
| runner | executor | The local process on `127.0.0.1:8421` that opens and drives sessions from the office. |
| hooks | hooks | Not translated. The Claude Code hooks that report activity to the collector. |
| Codex notify hook | notify do Codex | The Codex `notify` command that reports turns to the collector. |
| installer | instalador | The scripts that write the hooks into `settings.json` and `config.toml`. |
| pairing | pareamento | Linking a browser or device to the collector so it can see and decide requests. |
| pair a device | parear aparelho | |
| paired device | aparelho pareado | |
| revoke | revogar | Removing a paired device. |
| demo / demo mode | demonstração / modo demo | The page with sample data, opened with `?modo=demo`. It makes no API requests. |
| landing page | landing | The project site on GitHub Pages, in `site/`. |
