const QUESTION_REQUEST = Object.freeze({ kind: "question", toolName: "AskUserQuestion", summary: "Tem uma pergunta para você", detail: "" });
const ANSWER_SEPARATOR = " · ";

export function createHoldQuestion({ holdRequest, activity }) {
  return async function holdQuestion({ actor, questions, onAbort }) {
    if (questions.length === 0) return null;
    const answer = await holdRequest(actor, { ...QUESTION_REQUEST, questions }, onAbort);
    if (!answer) return null;
    activity.note(actor, "você respondeu pelo escritório", `você respondeu: ${Object.values(answer.answers).join(ANSWER_SEPARATOR)}`);
    return answer;
  };
}
