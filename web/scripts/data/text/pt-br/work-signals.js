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
};
