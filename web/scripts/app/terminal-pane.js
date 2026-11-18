import { icon } from "../view/icons.js";
import { renderMarkdown } from "../view/terminal-markdown.js";

const NEAR_BOTTOM_PX = 40;
const COPIED_LABEL_MS = 1_500;
const COPY_LABELS = { idle: "copiar", done: "copiado", failed: "não deu" };

export function createTerminalPane(pane) {
  const body = pane.querySelector("[data-slot='history']");
  const jump = pane.querySelector("[data-jump]");
  const expand = pane.querySelector("[data-expand]");
  const streaming = document.createElement("div");
  streaming.className = "entry reply streaming";
  let streamedText = "";
  let isFollowing = true;
  let pendingFrame = 0;

  const isNearBottom = () => body.scrollHeight - body.scrollTop - body.clientHeight < NEAR_BOTTOM_PX;
  pane.classList.toggle("no-clipboard", !navigator.clipboard);

  function scrollToEnd() {
    body.scrollTop = body.scrollHeight;
    isFollowing = true;
    jump.hidden = true;
  }

  function settle() {
    if (isFollowing) scrollToEnd();
    else jump.hidden = false;
  }

  function paintStreaming() {
    pendingFrame = 0;
    streaming.innerHTML = streamedText ? `<div class="md">${renderMarkdown(streamedText)}</div>` : "";
    settle();
  }

  async function copyFrom(button) {
    const code = button.closest(".code-block")?.querySelector("code");
    if (!code) return;
    const text = code.textContent.replace(/^\$ /, "");
    const outcome = await navigator.clipboard.writeText(text).then(() => "done", () => "failed");
    button.textContent = COPY_LABELS[outcome];
    setTimeout(() => { button.textContent = COPY_LABELS.idle; }, COPIED_LABEL_MS);
  }

  function toggleExpanded() {
    const isExpanded = pane.classList.toggle("is-expanded");
    const label = isExpanded ? "Reduzir terminal" : "Expandir terminal";
    expand.setAttribute("aria-pressed", String(isExpanded));
    expand.setAttribute("aria-label", label);
    expand.title = label;
    expand.innerHTML = icon(isExpanded ? "collapse" : "expand");
    settle();
  }

  body.addEventListener("scroll", () => {
    isFollowing = isNearBottom();
    if (isFollowing) jump.hidden = true;
  });
  jump.addEventListener("click", scrollToEnd);
  expand.addEventListener("click", toggleExpanded);
  pane.addEventListener("click", (event) => {
    const copy = event.target.closest("[data-copy]");
    if (copy) copyFrom(copy);
  });
  pane.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !pane.classList.contains("is-expanded")) return;
    event.stopPropagation();
    toggleExpanded();
  });

  return {
    show(html) {
      body.innerHTML = html;
      settle();
    },
    showLive(html, partial) {
      body.innerHTML = html;
      streamedText = partial;
      paintStreaming();
      body.append(streaming);
    },
    append(html) {
      if (streaming.isConnected) streaming.insertAdjacentHTML("beforebegin", html);
      else body.insertAdjacentHTML("beforeend", html);
      streamedText = "";
      paintStreaming();
    },
    stream(text) {
      streamedText += text;
      if (!pendingFrame) pendingFrame = requestAnimationFrame(paintStreaming);
    },
  };
}
