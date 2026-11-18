const SLOT = /\{(\w+)\}/g;

const hasSubject = (slots) => slots.subject !== null && slots.subject !== undefined;

export function fillPhrase(phrase, slots = {}) {
  const template = typeof phrase === "string" ? phrase : hasSubject(slots) ? phrase.withSubject : phrase.withoutSubject;
  return template.replace(SLOT, (slot, name) => String(slots[name] ?? ""));
}
