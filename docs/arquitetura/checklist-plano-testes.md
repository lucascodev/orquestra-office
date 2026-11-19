# Checklist, plano e testes na Sede (desenho técnico)

Desenho aprovado pelo usuário em 19/11/2026, no canvas de design (página "Checklist, plano e testes" e quadro "Sede · com checklist, plano e testes").

## 1. O que o usuário vê

- **Ficha do agente com abas:** Agora (o que já existe), Tarefas, Plano e Testes. A aba Tarefas mostra a contagem (4/7). A aba Testes ganha um ponto vermelho quando a última rodada falhou e ela não está aberta.
- **Etiqueta em cima do boneco**, por prioridade:
  1. testes rodando: `⚗ testando 0:12`, com o tempo correndo;
  2. última rodada falhou: `✕ 2 falharam`, até a próxima rodada;
  3. última rodada passou: `✓ 250 passaram`, por 1 minuto depois de terminar;
  4. escrevendo teste: `✎ escrevendo teste`, enquanto o último arquivo tocado for de teste e tiver menos de 1 minuto;
  5. checklist com itens abertos: `☰ 4/7`;
  6. só o nome, como hoje.
- **Plano:** o alerta do topo mostra o plano inteiro (markdown seguro), com "Aprovar plano" (A, permitir) e "Continuar planejando" (N, negar com o texto do campo como mensagem). A aba Plano mostra a versão mais recente, o estado e a hora.
- **Linha do tempo:** "rodou os testes: 2 falharam, 248 passaram", "rodou os testes: 250 passaram", "plano aprovado".
- **Ficha da ilha:** por agente, `☰ 4/7` e o resultado da última rodada.
- **Legenda:** ☰ checklist, ⚗ testando, ✎ escrevendo teste, ✓/✕ resultado.
- O Codex só manda o fim do turno: nada disso aparece para ele.

## 2. Contrato do coletor (estado público, por agente)

Campos novos no registro do agente, todos opcionais (ausentes em estado salvo antigo e em agentes do Codex):

```js
agent.checklist = {
  items: [{ id, text, status: "pending" | "in_progress" | "completed", activeText }], // até 50 itens, texto até 200
  updatedAt,
} | null;

agent.plan = {
  text,            // markdown, até 20 000 caracteres
  version,         // 1, 2, ... a cada novo ExitPlanMode
  state: "proposed" | "approved" | "revised", // revised = veio uma versão nova sem aprovar a anterior
  proposedAt,
  decidedAt,       // null enquanto proposto
} | null;

agent.tests = {
  running: { command, framework, startedAt } | null,  // command até 200, framework ou null
  lastRun: {
    command, framework, startedAt, finishedAt, durationMs,
    isOk,                       // boolean: passou (código de saída e/ou resumo)
    passed, failed, skipped,    // número ou null quando o resumo não é conhecido
    failures: [{ name, location, message }], // até 10; cada campo até 300 ou null
  } | null,
  runsToday: [{ finishedAt, framework, label, isOk, passed, failed, skipped }], // até 20, mais recente primeiro; zera ao virar o dia
  files: [{ path, action: "read" | "created" | "edited", at, failed }], // até 30, relativo à raiz do projeto; failed = número de falhas da última rodada nesse arquivo ou null
  lastTestFileAt,  // última vez que criou ou editou um arquivo de teste, ou null
} | null;
```

Ações novas em `AGENT_ACTION` (o catálogo de frases fica na página, em `web/scripts/data/text/pt-br/agent-actions.js`):

| id | quando | subject |
|---|---|---|
| `running-tests` | PreToolUse de Bash/PowerShell reconhecido como teste | framework ou primeira palavra |
| `writing-tests` | PreToolUse de Edit/Write num arquivo de teste | nome do arquivo |
| `tests-passed` | PostToolUse de um teste, `isOk` | número que passou ou null |
| `tests-failed` | PostToolUse (ou PostToolUseFailure) de um teste, não `isOk` | número que falhou ou null |
| `plan-approved` | PostToolUse de ExitPlanMode | null |

As entradas `tests-passed`, `tests-failed` e `plan-approved` vão para `agent.log`, de onde a linha do tempo lê.

## 3. Como o coletor reconhece

Tudo no domínio, em funções puras com testes de tabela:

- **Comando de teste** (`testCommandOf(command)` → `{ framework } | null`): jest, vitest, mocha, ava, `node --test`, `bun test`, `deno test`, `playwright test`, `cypress run`, `npm|pnpm|yarn|bun test` e `run test*`, `nx test`, `turbo test`; pytest, `python -m pytest|unittest`, tox, nox, `uv run pytest`, `poetry run pytest`; `go test`; `cargo test`, `cargo nextest`; `dotnet test`; `mvn test|verify`, `gradle test`, `./gradlew test`; rspec, `rails test`, `rake test`; phpunit, pest, `artisan test`; `mix test`; `flutter test`, `dart test`; `swift test`, `xcodebuild test`. Considera `cd x &&`, variáveis de ambiente no início, `npx`/`pnpm exec`/`bunx` e cadeias com `&&`/`;`.
- **Resumo da saída** (`testSummaryOf(output)` → `{ framework, passed, failed, skipped, failures } | null`): jest, vitest, pytest, node:test e TAP, go, cargo, dotnet, maven e surefire, gradle, mocha, rspec, phpunit, mix, playwright. Falhas com nome, arquivo:linha e mensagem pelo menos em jest, vitest, pytest, node:test, go, cargo e rspec. Lê também a saída de um comando que não parecia teste: se tiver resumo conhecido, vira rodada (cobre `npm run check`).
- **Resultado:** `isOk` vem do resumo (`failed === 0`) quando houver; sem resumo, do sucesso do PostToolUse (PostToolUseFailure, `interrupted` ou código de saída diferente de zero = falhou).
- **Arquivo de teste** (`isTestFile(path)`): `*.test.*`, `*.spec.*`, `__tests__/`, `*.cy.*`, `test_*.py`, `*_test.py`, `tests/`, `test/`, `spec/`, `*_test.go`, `*Test.java`, `*Tests.java`, `*Test.kt`, `*Tests.cs`, `*Test.cs`, `*_spec.rb`, `*Test.php`, `*_test.exs`, `*_test.dart`, `*Tests.swift`, `*.feature`.
- **Checklist:** `TodoWrite` substitui a lista inteira (`todos[].content`, `status`, `activeForm`). `TaskCreate` acrescenta um item (`subject`, `activeForm`); o id vem da resposta no PostToolUse (procure o número em `tool_response`, texto ou objeto). `TaskUpdate` muda `status` (`deleted` remove) e `subject` pelo `taskId`.
- **Plano:** PreToolUse de `ExitPlanMode` com `tool_input.plan` cria a versão (a anterior, se ainda proposta, vira `revised`). PostToolUse de `ExitPlanMode` marca `approved`.

## 4. Privacidade

A saída dos testes nunca é guardada inteira: só os números, até 10 falhas com nome, local e mensagem cortados em 300 caracteres, e o comando cortado em 200. O plano é texto que o próprio agente escreveu para o usuário aprovar e fica até 20 000 caracteres.

## 5. Divisão do trabalho

1. **Coletor** (worktree própria): domínio de reconhecimento, gravação no store, ações novas, testes.
2. **Página** (worktree própria, em paralelo, usando este contrato e o modo demo): abas da ficha, etiquetas, alerta do plano, linha do tempo, ficha da ilha, legenda e dados do modo demo.
3. **Integração:** merge das duas, testes dos quatro pacotes, revisão de código e de segurança, rebuild do container.
