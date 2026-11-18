import { decisionAnswerOf, INVALID_ANSWER } from "../domain/decision-answer.js";
import { OUTCOME } from "./outcome.js";

export function createDecidePendingRequest({ decisions }) {
  return function decidePendingRequest(id, body) {
    const request = decisions.get(id);
    if (!request) return OUTCOME.NOT_FOUND;
    const answer = decisionAnswerOf(request, body ?? {});
    if (answer === INVALID_ANSWER) return OUTCOME.INVALID;
    decisions.settle(id, answer);
    return OUTCOME.DONE;
  };
}
