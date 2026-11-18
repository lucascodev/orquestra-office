const ANSWER_LIMIT = 2_000;
const DENY_MESSAGE_LIMIT = 1_000;

function permissionAnswer(body) {
  if (body.behavior === "allow") return { behavior: "allow" };
  if (body.behavior === "deny") return { behavior: "deny", message: typeof body.message === "string" ? body.message.slice(0, DENY_MESSAGE_LIMIT) : "" };
  return undefined;
}

function questionAnswer(request, body) {
  const given = body.answers && typeof body.answers === "object" ? body.answers : {};
  const answers = {};
  for (const { question } of request.questions) {
    const value = typeof given[question] === "string" ? given[question].trim().slice(0, ANSWER_LIMIT) : "";
    if (!value) return undefined;
    answers[question] = value;
  }
  return { answers };
}

function answerFor(request, body) {
  if (body.behavior === "terminal") return null;
  return request.kind === "question" ? questionAnswer(request, body) : permissionAnswer(body);
}

export function createOfficeApi({ store, decisions, outbox, history }) {
  function decide(id, body) {
    const request = decisions.get(id);
    if (!request) return 404;
    const answer = answerFor(request, body ?? {});
    if (answer === undefined) return 400;
    decisions.settle(id, answer);
    return 200;
  }

  function sendMessage(body) {
    const agent = store.findAgent(String(body?.key ?? ""));
    const canReceive = agent && agent.kind === "main" && agent.source === "claude" && !agent.endedAt;
    if (!canReceive) return 404;
    if (!outbox.queue(agent.key, body.text)) return 400;
    history.add(agent.key, { at: Date.now(), kind: "message", text: String(body.text).trim(), detail: "" });
    return 200;
  }

  return { decide, sendMessage, historyOf: (agentKey) => history.of(agentKey) };
}
