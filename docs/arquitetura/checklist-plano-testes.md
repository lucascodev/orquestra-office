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
- **Plano:** o alerta do topo mostra o plano do próprio pedido de permissão (markdown num perfil restrito), com "Aprovar plano" (só clique, sem atalho, para ninguém aprovar sem ler) e "Continuar planejando" (N, negar com o texto do campo como mensagem). A aba Plano mostra a versão mais recente, o estado e a hora, e busca o texto quando abre.
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
  highestTaskNumber, // só com TaskCreate: maior id numérico já visto, contando os apagados, para numerar sem reaproveitar
} | null;

agent.plan = {
  version,         // 1, 2, ... a cada novo ExitPlanMode com texto diferente
  state: "proposed" | "approved" | "revised", // revised = esta versão chegou sem a anterior ter sido aprovada
  proposedAt,
  decidedAt,       // null enquanto proposto
  length,          // tamanho do texto; o texto não vai no estado
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

O pedido pendente de `ExitPlanMode`, montado a partir do `PermissionRequest` assinado, leva `plan` (até 20 000 caracteres, com segredos mascarados), `planLength` e `isPlanTruncated`. É esse texto que o alerta mostra, nunca o do `PreToolUse`, que chega pela via de atividade. O texto da versão mais recente fica só em memória e sai por `GET /api/agents/plan?key=<agentKey>`, com pareamento, devolvendo `{ text, version, state, proposedAt, decidedAt }` ou `{ plan: null }`.

Os ids de framework são um enum fixo, exportado como `FRAMEWORK_IDS` em `collector/src/work/domain/values/frameworks.js`: os do leitor de saída (`TEST_FRAMEWORK`) mais os que só o comando nomeia (`COMMAND_FRAMEWORK`). O de `node --test` é `node-test`, e uma saída com vários frameworks dá `mixed`.

## 3. Como o coletor reconhece

Tudo no domínio, em funções puras com testes de tabela:

- **Comando de teste** (`testCommandOf(command)` → `{ framework } | null`): jest, vitest, mocha, ava, `node --test`, `bun test`, `deno test`, `playwright test`, `cypress run`, `npm|pnpm|yarn|bun test` e `run test*`, `nx test`, `turbo test`; pytest, `python -m pytest|unittest`, tox, nox, `uv run pytest`, `poetry run pytest`; `go test`; `cargo test`, `cargo nextest`; `dotnet test`; `mvn test|verify`, `gradle test`, `./gradlew test`; rspec, `rails test`, `rake test`; phpunit, pest, `artisan test`; `mix test`; `flutter test`, `dart test`; `swift test`, `xcodebuild test`. Considera `cd x &&`, variáveis de ambiente no início, `npx`/`pnpm exec`/`bunx` e cadeias com `&&`/`;`.
- **Resumo da saída** (`parseTestOutput(output)` em `collector/src/work/domain/test-output.js` → `{ framework, passed, failed, skipped, failures } | null`): jest, vitest, pytest, node:test e TAP, go, cargo, dotnet, maven, gradle, mocha, rspec, phpunit, mix, playwright. Falhas com nome, arquivo:linha e mensagem em jest, vitest, pytest, node:test, TAP, go, cargo e rspec; nos outros, só os números. Lê as primeiras e as últimas 64 KB, linha a linha (2 KB por linha), com regex lineares e teste adversarial de 1 MB. Só lê a saída de comando reconhecido como teste ou de `npm|pnpm|yarn|bun run <script>` e `make`; um `cat` de log não vira rodada.
- **Resultado:** `isOk` vem do resumo (`failed === 0`) quando houver; sem resumo, do sucesso do PostToolUse (PostToolUseFailure, `interrupted` ou código de saída diferente de zero = falhou).
- **Arquivo de teste** (`isTestFile(path)`): `*.test.*`, `*.spec.*`, `__tests__/`, `*.cy.*`, `test_*.py`, `*_test.py`, `tests/`, `test/`, `spec/`, `*_test.go`, `*Test.java`, `*Tests.java`, `*Test.kt`, `*Tests.cs`, `*Test.cs`, `*_spec.rb`, `*Test.php`, `*_test.exs`, `*_test.dart`, `*Tests.swift`, `*.feature`.
- **Checklist:** `TodoWrite` substitui a lista inteira (`todos[].content`, `status`, `activeForm`). `TaskCreate` acrescenta um item (`subject`, `activeForm`); o id vem da resposta no PostToolUse (procure o número em `tool_response`, texto ou objeto). `TaskUpdate` muda `status` (`deleted` remove) e `subject` pelo `taskId`.
- **Plano:** PreToolUse de `ExitPlanMode` com `tool_input.plan` cria a versão; o mesmo texto não cria versão nova. A versão que chega sem a anterior ter sido aprovada fica `revised`. PostToolUse de `ExitPlanMode` marca `approved` (e cria a versão, se o PreToolUse ainda não chegou).

## 4. Privacidade

A saída dos testes nunca é guardada inteira: só os números, até 10 falhas com nome, local e mensagem cortados em 300 caracteres, e o comando cortado em 200, a partir do programa (sem `cd …` nem `X=…` no começo). Todo texto livre (comando, falhas, plano e checklist) passa por `redactSecrets`, que mascara tokens, chaves (Stripe, GitHub, Google, AWS, blocos PEM de chave privada), JWT, credenciais em URL e em `Basic`, `password=`/`token=`, chaves JSON como `"password": "…"`, variáveis de ambiente com PASS, SECRET, TOKEN ou KEY no nome e flags como `--password valor`, com regex de tempo linear, e perde caracteres de controle e de bidi.

O arquivo de estado em disco não guarda texto livre: sai a checklist, as falhas, o texto do plano e os comandos de teste (`lastRun.command`, `runsToday[].label` e a rodada em curso, gravada como `running: null`). Eles ficam em memória, como o histórico do terminal, e somem quando o coletor reinicia. O arquivo é gravado só para o dono (`0o600`), como o de aparelhos pareados.

A página mostra o plano com um renderizador próprio, sem HTML cru, imagens, estilos nem elementos de formulário, e só com links `http`, `https` e `mailto`. As decisões só leem botões e o campo de dentro da barra de decisão. A CSP ganhou `img-src 'self' data: blob:`, `object-src 'none'`, `base-uri 'none'` e `form-action 'self'`.

## 5. Divisão do trabalho

Quatro frentes em worktrees próprias, juntadas por merge:

1. **Coletor, núcleo:** reconhecimento de comando e arquivo de teste, checklist, plano, store, rota do plano, persistência e redação.
2. **Coletor, leitura da saída:** `parseTestOutput` e os 15 leitores, com fixtures reais.
3. **Página, ficha:** abas, plano no alerta e na ficha, celular e modo demo.
4. **Página, mapa:** etiqueta em cima do boneco, legenda, ficha da ilha, linha do tempo e frases das ações.

Uma revisão de segurança do desenho rodou em paralelo e seus achados entraram nas quatro frentes antes do merge.
