const WORK_ID = /^[\w-]{1,40}$/;

export function workIdOf(value) {
  const id = Number.isSafeInteger(value) ? String(value) : value;
  return typeof id === "string" && WORK_ID.test(id) ? id : null;
}
