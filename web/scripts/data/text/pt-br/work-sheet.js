export const WORK_TABS_LABEL = "Seções da ficha";

export const WORK_TAB_NAMES = { now: "Agora", todos: "Tarefas", plan: "Plano", tests: "Testes" };

export const WORK_TAB_HINTS = {
  progress: "{done} de {total} feitas",
  failed: "a última rodada falhou",
};

export const CHECKLIST_TEXT = {
  empty: "O agente ainda não montou uma lista de tarefas nesta sessão.",
  done: "{done} de {total} feitas",
  updated: "atualizada {ago}",
  note: "A lista é a do próprio agente e muda quando ele a atualiza.",
  step: "tarefa {position} de {total}",
};

export const CHECKLIST_STATUS = { completed: "feito", in_progress: "em andamento", pending: "a fazer" };

export const PLAN_TEXT = {
  empty: "Nenhum plano nesta sessão. Ele aparece aqui quando o agente planeja antes de executar.",
  version: "versão {version}",
  label: "Plano, versão {version}",
};

export const PLAN_LOADING = {
  loading: "Buscando o plano…",
  failed: "Não deu para buscar o plano. Ele volta a ser buscado na próxima atualização.",
  missing: "O coletor não tem mais o texto deste plano.",
};

export const PLAN_STATES = {
  proposed: { withSubject: "Esperando sua aprovação desde {subject}", withoutSubject: "Esperando sua aprovação" },
  approved: { withSubject: "Aprovado às {subject}", withoutSubject: "Aprovado" },
  revised: { withSubject: "Trocado por uma versão nova às {subject}", withoutSubject: "Trocado por uma versão nova" },
};

export const TESTS_TEXT = {
  empty: "Nenhum teste rodado nesta sessão ainda.",
  running: "Rodando agora",
  runningLabel: "Testes rodando agora",
  lastRunLabel: "Última rodada",
  runsToday: { one: "Hoje · 1 rodada", other: "Hoje · {count} rodadas" },
  files: "Arquivos de teste desta sessão · {count}",
  note: "Vale para qualquer framework: jest, vitest, pytest, go, cargo, dotnet, maven, rspec, phpunit e outros. Quando o resumo não é conhecido, mostra só se terminou bem ou com erro.",
};

export const TEST_VERDICTS = {
  failed: { one: "1 falhou", other: "{count} falharam", unknown: "Terminou com erro" },
  passed: { one: "1 passou", other: "{count} passaram", unknown: "Terminou bem" },
};

export const TEST_COUNTS = { passed: "passaram", failed: "falharam", skipped: "pulados" };

export const TEST_RUN_WITHOUT_COUNTS = { failed: "com erro", passed: "ok" };

export const TEST_RUN_FALLBACK_LABEL = "testes";

export const TEST_FILE_ACTIONS = { read: "leu", created: "criou", edited: "editou" };

export const TEST_FILE_RESULTS = { passing: "passou na última rodada", unknown: "sem resultado da última rodada" };
