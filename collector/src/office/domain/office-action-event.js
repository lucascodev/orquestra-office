export function officeActionEvent(actor, action, at) {
  return { ...actor, at, kind: "activity", status: "working", action };
}
