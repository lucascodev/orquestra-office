import { searchHeadquarters } from "../domain/office/headquarters-search.js";
import { movedCursor } from "../domain/office/option-cursor.js";
import { renderSearchResults, resultCountText } from "../view/hud/search-results-view.js";

const OPEN_KEY = "k";
const ENTER = "Enter";
const OPTION = '[role="option"]';
const ACTIVE_CLASS = "is-active";

const isOpenShortcut = (event) => (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === OPEN_KEY;
const choiceOf = (option) => ({ kind: option.dataset.kind, id: option.dataset.id, room: option.dataset.room ?? null });
const keyOf = (option) => `${option.dataset.kind}|${option.dataset.id}`;

// The Ctrl K (Cmd K on a Mac) search as a modal combobox: the field keeps the focus, the arrows move the active option, Enter
// chooses it and Esc closes. Choosing hands the option and whoever opened the search to onChoose; closing without a choice
// gives the focus back to that opener.
export function createCommandPalette({ dialog, entries, onChoose }) {
  const field = dialog.querySelector('[role="combobox"]');
  const listbox = dialog.querySelector('[role="listbox"]');
  const count = dialog.querySelector("[data-search-count]");
  let options = [];
  let activeIndex = -1;
  let opener = null;
  let hasChosen = false;

  function setActive(index) {
    options[activeIndex]?.setAttribute("aria-selected", "false");
    options[activeIndex]?.classList.remove(ACTIVE_CLASS);
    activeIndex = index;
    const active = options[activeIndex];
    if (!active) {
      field.removeAttribute("aria-activedescendant");
      return;
    }
    active.setAttribute("aria-selected", "true");
    active.classList.add(ACTIVE_CLASS);
    field.setAttribute("aria-activedescendant", active.id);
    active.scrollIntoView({ block: "nearest" });
  }

  function render() {
    const activeKey = options[activeIndex] ? keyOf(options[activeIndex]) : null;
    listbox.innerHTML = renderSearchResults(searchHeadquarters({ query: field.value, ...entries() }));
    options = [...listbox.querySelectorAll(OPTION)];
    activeIndex = -1;
    const kept = options.findIndex((option) => keyOf(option) === activeKey);
    setActive(kept >= 0 ? kept : Math.min(0, options.length - 1));
    const countText = resultCountText(options.length);
    if (count.textContent !== countText) count.textContent = countText;
  }

  function open() {
    if (dialog.open) {
      field.select();
      return;
    }
    opener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    hasChosen = false;
    field.value = "";
    count.textContent = "";
    options = [];
    activeIndex = -1;
    render();
    dialog.showModal();
    field.focus();
  }

  function choose(option) {
    if (!option) return;
    hasChosen = true;
    dialog.close();
    onChoose(choiceOf(option), opener);
  }

  field.addEventListener("input", render);
  field.addEventListener("keydown", (event) => {
    if (event.key === ENTER) {
      event.preventDefault();
      choose(options[activeIndex]);
      return;
    }
    const next = movedCursor({ count: options.length, index: activeIndex, key: event.key });
    if (next === null) return;
    event.preventDefault();
    setActive(next);
  });
  listbox.addEventListener("click", (event) => choose(event.target.closest(OPTION)));
  listbox.addEventListener("pointermove", (event) => {
    const option = event.target.closest(OPTION);
    if (option && options[activeIndex] !== option) setActive(options.indexOf(option));
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    if (!hasChosen && opener?.isConnected) opener.focus();
  });
  document.addEventListener("keydown", (event) => {
    if (!isOpenShortcut(event)) return;
    event.preventDefault();
    open();
  });

  return { open, refresh: () => dialog.open && render() };
}
