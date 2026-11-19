import { isRecord } from "../shared/is-record.js";

const COMPLETED = "completed";
const IN_PROGRESS = "in_progress";
const PENDING = "pending";
const KNOWN_STATUSES = new Set([COMPLETED, IN_PROGRESS, PENDING]);

const textOf = (value) => (typeof value === "string" ? value : "");

function itemOf(item, index) {
  const id = typeof item.id === "string" || Number.isFinite(item.id) ? String(item.id) : String(index);
  return {
    id,
    text: textOf(item.text),
    activeText: textOf(item.activeText) || null,
    status: KNOWN_STATUSES.has(item.status) ? item.status : PENDING,
  };
}

// The agent's own to-do list, as far as it got: how many are done and which one it is on. A list that never came, came empty
// or came damaged is no list at all, so the sheet and the tab say nothing instead of "0 de 0".
export function checklistProgress(checklist) {
  const items = isRecord(checklist) && Array.isArray(checklist.items) ? checklist.items.filter(isRecord).map(itemOf) : [];
  if (items.length === 0) return null;
  const done = items.filter((item) => item.status === COMPLETED).length;
  const currentIndex = items.findIndex((item) => item.status === IN_PROGRESS);
  return {
    items,
    done,
    total: items.length,
    current: currentIndex === -1 ? null : { ...items[currentIndex], position: currentIndex + 1 },
    hasOpenItems: done < items.length,
    updatedAt: Number.isFinite(checklist.updatedAt) ? checklist.updatedAt : null,
  };
}
