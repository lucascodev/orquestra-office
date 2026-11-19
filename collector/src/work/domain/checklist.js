import { cleanLineOf } from "./values/clean-text.js";
import { workIdOf } from "./values/work-id.js";

const ITEM_LIMIT = 50;
const TEXT_LIMIT = 200;
const CHECKLIST_STATUSES = new Set(["pending", "in_progress", "completed"]);
const NEW_ITEM_STATUS = "pending";
const DELETED = "deleted";

const textOf = (value) => cleanLineOf(value, TEXT_LIMIT);
const activeTextOf = (value) => textOf(value) || null;
const statusOr = (status, fallback) => (CHECKLIST_STATUSES.has(status) ? status : fallback);
const numberOf = (id) => (/^\d+$/.test(id) ? Number(id) : null);

function itemOf({ id, text, status, activeText }) {
  const shown = textOf(text);
  return shown ? { id, text: shown, status: statusOr(status, NEW_ITEM_STATUS), activeText: activeTextOf(activeText) } : null;
}

// TodoWrite sends the whole list every time, so it replaces whatever the checklist had.
export function checklistFromTodos(todos, at) {
  if (!Array.isArray(todos)) return null;
  const items = todos
    .slice(0, ITEM_LIMIT)
    .map((todo, index) => itemOf({ id: workIdOf(todo?.id) ?? String(index + 1), text: todo?.content, status: todo?.status, activeText: todo?.activeForm }))
    .filter(Boolean);
  return { items, updatedAt: at };
}

function nextIdOf(items) {
  const numbers = items.map((item) => numberOf(item.id)).filter((number) => number !== null);
  return String(Math.max(0, ...numbers) + 1);
}

// Tasks created in one message reach the office in any order; numbered ids put them back in the order they were made.
function inIdOrder(items, item) {
  const number = numberOf(item.id);
  const after = number === null ? -1 : items.findIndex((other) => numberOf(other.id) !== null && numberOf(other.id) > number);
  return after === -1 ? [...items, item] : [...items.slice(0, after), item, ...items.slice(after)];
}

export function withTaskCreated(checklist, task, at) {
  const items = checklist?.items ?? [];
  const item = itemOf({ ...task, id: workIdOf(task.id) ?? nextIdOf(items), status: NEW_ITEM_STATUS });
  if (!item) return checklist ?? null;
  const others = items.filter((other) => other.id !== item.id);
  return { items: inIdOrder(others, item).slice(-ITEM_LIMIT), updatedAt: at };
}

function updatedItem(item, { status, text, activeText }) {
  return {
    ...item,
    status: statusOr(status, item.status),
    text: textOf(text) || item.text,
    activeText: activeText === undefined ? item.activeText : activeTextOf(activeText),
  };
}

export function withTaskUpdated(checklist, update, at) {
  const id = workIdOf(update.id);
  if (!checklist || !checklist.items.some((item) => item.id === id)) return checklist ?? null;
  const items = update.status === DELETED
    ? checklist.items.filter((item) => item.id !== id)
    : checklist.items.map((item) => (item.id === id ? updatedItem(item, update) : item));
  return { items, updatedAt: at };
}
