export function officeActionEvent(actor, { actionId, subject = null, action }, at) {
  return { ...actor, at, kind: "activity", status: "working", actionId, subject, action };
}
