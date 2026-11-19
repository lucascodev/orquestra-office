import { WORK_TAB_HINTS, WORK_TAB_NAMES } from "../../data/text/pt-br/work-sheet.js";
import { fillPhrase } from "../../domain/text/fill-phrase.js";

export const workTabId = (id) => `work-tab-${id}`;
export const workPanelId = (id) => `work-panel-${id}`;

function progressOf(progress) {
  if (!progress) return "";
  const hint = fillPhrase(WORK_TAB_HINTS.progress, progress);
  return `<span class="work-tab-count" aria-hidden="true">${progress.done}/${progress.total}</span><span class="sr-only">, ${hint}</span>`;
}

const alertOf = (hasAlert) => (hasAlert ? `<span class="work-tab-alert" aria-hidden="true"></span><span class="sr-only">, ${WORK_TAB_HINTS.failed}</span>` : "");

function tabOf(tab) {
  return `<button type="button" role="tab" class="work-tab" id="${workTabId(tab.id)}" aria-controls="${workPanelId(tab.id)}" aria-selected="${tab.isSelected}" tabindex="${tab.isSelected ? 0 : -1}" data-work-tab="${tab.id}">${WORK_TAB_NAMES[tab.id]}${progressOf(tab.progress)}${alertOf(tab.hasAlert)}</button>`;
}

export const renderWorkTabs = (tabs) => tabs.map(tabOf).join("");
