import { CHECKLIST_STATUS, CHECKLIST_TEXT } from "../../data/text/pt-br/work-sheet.js";
import { fillPhrase } from "../../domain/text/fill-phrase.js";
import { esc } from "../shared/escape-html.js";
import { ago } from "../shared/format.js";

const MARKS = { completed: "✓", in_progress: "⋯", pending: "○" };

function itemOf(item) {
  const isCurrent = item.status === "in_progress";
  const text = isCurrent
    ? `<span class="work-todo-text"><b>${esc(item.text)}</b>${item.activeText ? `<span class="work-todo-active">${esc(item.activeText)}</span>` : ""}</span>`
    : `<span class="work-todo-text">${esc(item.text)}</span>`;
  return `<li class="work-todo" data-status="${item.status}"><span class="work-todo-mark" aria-hidden="true">${MARKS[item.status]}</span><span class="sr-only">${CHECKLIST_STATUS[item.status]}: </span>${text}</li>`;
}

// The Tarefas tab: how far the list got, one segment per item, and the items with the one in progress highlighted.
export function renderChecklistTab(progress) {
  if (!progress) return `<p class="work-empty">${CHECKLIST_TEXT.empty}</p>`;
  const updated = progress.updatedAt ? `<span class="work-muted">${esc(fillPhrase(CHECKLIST_TEXT.updated, { ago: ago(progress.updatedAt) }))}</span>` : "";
  const segments = progress.items.map((item) => `<span data-status="${item.status}"></span>`).join("");
  return `<div class="work-stack">
    <div class="work-progress-head"><b>${fillPhrase(CHECKLIST_TEXT.done, progress)}</b>${updated}</div>
    <div class="work-progress" style="--steps:${progress.total}" aria-hidden="true">${segments}</div>
    <ol class="work-todos">${progress.items.map(itemOf).join("")}</ol>
    <p class="work-note">${CHECKLIST_TEXT.note}</p>
  </div>`;
}
