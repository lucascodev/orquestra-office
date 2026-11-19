const WIDE_SCREEN = "(min-width: 861px)";

export function setupDemoEmbed(frame, screen = window.matchMedia(WIDE_SCREEN)) {
  const view = frame.querySelector("iframe[data-demo-src]");
  const preview = frame.querySelector("[data-demo-preview]");
  const wideScreenParts = [...frame.querySelectorAll("[data-demo-live]")];

  function showFor(isWide) {
    if (isWide && !view.hasAttribute("src")) view.src = view.dataset.demoSrc;
    preview.hidden = isWide;
    for (const part of wideScreenParts) part.hidden = !isWide;
  }

  screen.addEventListener("change", (event) => showFor(event.matches));
  showFor(screen.matches);
}
