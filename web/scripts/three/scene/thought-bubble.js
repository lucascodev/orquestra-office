export function createThoughtBubble() {
  const element = document.createElement("span");
  element.className = "thought";
  element.setAttribute("aria-hidden", "true");
  let shownText = "";
  return {
    element,
    show(text, left, top, { isSpeech = false } = {}) {
      if (text !== shownText) {
        element.textContent = text;
        shownText = text;
      }
      element.style.left = left;
      element.style.top = top;
      element.classList.toggle("is-speech", isSpeech);
      element.classList.add("is-visible");
    },
    hide() {
      element.classList.remove("is-visible");
    },
  };
}
