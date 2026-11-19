const ANSWER_LIMIT = 2_000;
const DENY_MESSAGE_LIMIT = 1_000;

export const INVALID_ANSWER = Symbol("invalid answer");

function permissionAnswer(body) {
  if (body.behavior === "allow") return { behavior: "allow" };
  if (body.behavior === "deny") return { behavior: "deny", message: typeof body.message === "string" ? body.message.slice(0, DENY_MESSAGE_LIMIT) : "" };
  return INVALID_ANSWER;
}

function questionAnswer(request, body) {
  const given = body.answers && typeof body.answers === "object" ? body.answers : {};
  const answers = Object.create(null);
  for (const { question } of request.questions) {
    const value = typeof given[question] === "string" ? given[question].trim().slice(0, ANSWER_LIMIT) : "";
    if (!value) return INVALID_ANSWER;
    answers[question] = value;
  }
  return { answers };
}

// null is the same answer a request gets when nobody decides in time: it goes back to the terminal.
export function decisionAnswerOf(request, body) {
  if (body.behavior === "terminal") return null;
  return request.kind === "question" ? questionAnswer(request, body) : permissionAnswer(body);
}
