const NEXT_TAB_KEY = "ArrowRight";
const PREVIOUS_TAB_KEY = "ArrowLeft";
const FIRST_TAB_KEY = "Home";
const LAST_TAB_KEY = "End";

export function tabIndexForKey(key, currentIndex, tabCount) {
  if (key === NEXT_TAB_KEY) return (currentIndex + 1) % tabCount;
  if (key === PREVIOUS_TAB_KEY) return (currentIndex - 1 + tabCount) % tabCount;
  if (key === FIRST_TAB_KEY) return 0;
  if (key === LAST_TAB_KEY) return tabCount - 1;
  return null;
}
