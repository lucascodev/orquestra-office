export const WORK_SIGNALS = {
  tag: {
    testing: "testando {clock}",
    failed: { one: "1 falhou", other: "{count} falharam", unknown: "testes falharam" },
    passed: { one: "1 passou", other: "{count} passaram", unknown: "testes passaram" },
    writing: "escrevendo teste",
    checklist: "{done}/{total}",
  },
  legend: {
    checklistSample: "4/7",
    checklist: "checklist do agente",
    testing: "rodando testes",
    writing: "escrevendo",
    results: "resultado dos testes",
  },
  island: {
    checklist: "{done}/{total}",
    checklistSpoken: "{done} de {total} tarefas feitas",
    failedSpoken: { one: "na última rodada, 1 teste falhou", other: "na última rodada, {count} testes falharam", unknown: "a última rodada de testes falhou" },
    passedSpoken: { one: "na última rodada, 1 teste passou", other: "na última rodada, {count} testes passaram", unknown: "a última rodada de testes passou" },
    missing: "—",
  },
  event: {
    testsRun: "rodou os testes: {result}",
    failed: { one: "1 falhou", other: "{count} falharam", unknown: "houve falhas" },
    passed: { one: "1 passou", other: "{count} passaram", unknown: "todos passaram" },
    resultSeparator: ", ",
    planApproved: "teve o plano aprovado",
    where: "em {project}",
    open: "Ver atividade",
    openSpoken: "Ver a atividade de {name}",
  },
};
