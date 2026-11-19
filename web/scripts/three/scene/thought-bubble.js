const COMPACT_SPEECH = "…";

export function createThoughtBubble() {
  const element = document.createElement("span");
  element.className = "thought";
  element.setAttribute("aria-hidden", "true");
  let shownText = "";
  return {
    element,
    show(text, left, top, { isSpeech = false, isCompact = false } = {}) {
      const nextText = isCompact ? COMPACT_SPEECH : text;
      if (nextText !== shownText) {
        element.textContent = nextText;
        shownText = nextText;
      }
      element.style.left = left;
      element.style.top = top;
      element.classList.toggle("is-speech", isSpeech);
      element.classList.toggle("is-compact", isCompact);
      element.classList.add("is-visible");
    },
    hide() {
      element.classList.remove("is-visible");
    },
  };
}
