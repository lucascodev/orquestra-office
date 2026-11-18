const ANSWER_SEPARATOR = ", ";

function answerOf({ picked, other }) {
  return [...picked, other.trim()].filter(Boolean).join(ANSWER_SEPARATOR);
}

function answersOf(questions) {
  const answers = {};
  for (const question of questions) {
    const answer = answerOf(question);
    if (!answer) return null;
    answers[question.question] = answer;
  }
  return answers;
}

export function buildDecision(action, { questions = [], reason = "" } = {}) {
  if (action === "answer") {
    const answers = answersOf(questions);
    return answers && { answers };
  }
  if (action === "deny") return { behavior: "deny", message: reason.trim() };
  return { behavior: action };
}
