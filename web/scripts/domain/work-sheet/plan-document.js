import { isRecord } from "../shared/is-record.js";
import { planStatus } from "./plan-status.js";

// The plan the sheet fetches when its tab opens: the collector answers { text, version, state, proposedAt, decidedAt }, or
// { plan: null } when there is none. Anything else, such as an error page or a damaged body, counts as no plan.
export function planDocument(response) {
  if (!isRecord(response) || typeof response.text !== "string" || response.text === "") return null;
  return { ...planStatus(response), text: response.text };
}
