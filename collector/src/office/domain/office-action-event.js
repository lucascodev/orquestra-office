export function officeActionEvent(actor, { actionId, subject = null }, at) {
  return { ...actor, at, kind: "activity", status: "working", actionId, subject };
}
