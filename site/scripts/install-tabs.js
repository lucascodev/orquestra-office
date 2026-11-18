import { tabIndexForKey } from "./tab-keys.js";

const SELECTED = "aria-selected";

export function setupInstallTabs(section) {
  const tablist = section.querySelector("[data-install-tabs]");
  const tabs = [...tablist.querySelectorAll("[data-install-tab]")];
  const partsByWay = [...section.querySelectorAll("[data-install-way]")];

  function select(chosenTab) {
    for (const tab of tabs) {
      const isChosen = tab === chosenTab;
      tab.setAttribute(SELECTED, String(isChosen));
      tab.tabIndex = isChosen ? 0 : -1;
    }
    const way = chosenTab.dataset.installTab;
    for (const part of partsByWay) part.hidden = part.dataset.installWay !== way;
  }

  function moveWithKeyboard(event) {
    const currentIndex = tabs.indexOf(event.target);
    if (currentIndex < 0) return;
    const nextIndex = tabIndexForKey(event.key, currentIndex, tabs.length);
    if (nextIndex === null) return;
    event.preventDefault();
    select(tabs[nextIndex]);
    tabs[nextIndex].focus();
  }

  for (const tab of tabs) tab.addEventListener("click", () => select(tab));
  tablist.addEventListener("keydown", moveWithKeyboard);
  select(tabs.find((tab) => tab.getAttribute(SELECTED) === "true") ?? tabs[0]);
  tablist.hidden = false;
}
