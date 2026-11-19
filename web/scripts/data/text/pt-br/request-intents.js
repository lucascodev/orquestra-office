const USE_TOOL = { withSubject: "quer usar {subject}", withoutSubject: "quer usar uma ferramenta" };

export const QUESTION_INTENT = "tem uma pergunta";
export const TOOL_INTENT = USE_TOOL;

export const REQUEST_INTENTS = {
  "run-command": "quer rodar um comando",
  "write-file": { withSubject: "quer escrever {subject}", withoutSubject: "quer escrever um arquivo" },
  "edit-file": { withSubject: "quer editar {subject}", withoutSubject: "quer editar um arquivo" },
  "read-file": { withSubject: "quer ler {subject}", withoutSubject: "quer ler um arquivo" },
  "open-page": "quer abrir uma página",
  "search-web": "quer pesquisar na web",
  delegate: { withSubject: "quer delegar para {subject}", withoutSubject: "quer delegar uma tarefa" },
  "use-tool": USE_TOOL,
  "ask-question": QUESTION_INTENT,
};
