import { AGENT_ACTION } from "../../office/domain/agent-actions.js";
import { TOOL_SUMMARY } from "../../shared/claude/tool-summary-ids.js";
import { ENTRY_TEXT } from "../../shared/terminal/entry-text-ids.js";

const QUESTION_REQUEST = Object.freeze({ kind: "question", toolName: "AskUserQuestion", summaryId: TOOL_SUMMARY.ASK_QUESTION, subject: null, summary: "Tem uma pergunta para você", detail: "" });
const ANSWER_SEPARATOR = " · ";
const ANSWERED = Object.freeze({ actionId: AGENT_ACTION.QUESTION_ANSWERED, action: "você respondeu pelo escritório" });

export function createHoldQuestion({ holdRequest, activity }) {
  return async function holdQuestion({ actor, questions, onAbort }) {
    if (questions.length === 0) return null;
    const answer = await holdRequest(actor, { ...QUESTION_REQUEST, questions }, onAbort);
    if (!answer) return null;
    const answers = Object.values(answer.answers);
    activity.note(actor, ANSWERED, { textId: ENTRY_TEXT.QUESTION_ANSWERED, answers, text: `você respondeu: ${answers.join(ANSWER_SEPARATOR)}` });
    return answer;
  };
}
