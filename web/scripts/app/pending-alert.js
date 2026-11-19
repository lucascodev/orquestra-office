import { crossesWarning, newArrivals, pendingInFocus, requesterOf } from "../domain/office/pending-queue.js";
import { requestIntentText } from "../domain/office/request-intent-text.js";
import { arrivalsText, arrivalText, countdownText, renderAlertBody, renderAlertHead, warningText } from "../view/hud/pending-alert-view.js";
import { submitDecision } from "./decision-form.js";
import { listenForDecisionKeys } from "./keyboard-shortcuts.js";

const COUNTDOWN_TICK_MS = 1_000;
// A request that just took the place of the one decided ignores A and N for a moment, so a doubled key press does not decide it too.
const SHORTCUT_GRACE_MS = 700;
const NEXT_REQUEST = "Próximo pedido:";

// The most urgent request floats over the map; the head (who, 1 of N, time left) and the body (command or question) are redrawn
// apart, so the counter can change without moving the focus. A question is answered in the drawer of the agent who asks.
export function createPendingAlert({ element, announce, control, clockNow, onLeave, onOpenAgent }) {
  const head = element.querySelector('[data-part="head"]');
  const body = element.querySelector('[data-part="body"]');
  let pending = [];
  let projects = {};
  let shownId = null;
  let bodyId = null;
  let headHtml = "";
  let knownIds = null;
  let lastRemaining = null;
  let shortcutsFrom = 0;

  const isFocusInside = () => element.contains(document.activeElement);
  const describe = (request) => ({ requester: requesterOf(projects, request.agentKey), intent: requestIntentText(request) });
  const focusNow = () => pendingInFocus(pending, { shownId, now: clockNow() });

  function showCountdown(remainingMs, { requester }) {
    const countdown = head.querySelector("[data-countdown]");
    if (countdown) countdown.textContent = countdownText(remainingMs);
    if (crossesWarning(lastRemaining, remainingMs)) announce(warningText(requester));
    lastRemaining = remainingMs;
  }

  function showHead(focus, about) {
    const html = renderAlertHead({ ...about, position: focus.position, total: focus.total, previousId: focus.previousId, nextId: focus.nextId });
    if (html === headHtml) return;
    const focusedStep = head.contains(document.activeElement) ? document.activeElement.dataset.step : null;
    headHtml = html;
    head.innerHTML = html;
    if (!focusedStep) return;
    const stepButton = head.querySelector(`[data-step="${focusedStep}"]:not(:disabled)`) ?? head.querySelector("[data-step]:not(:disabled)");
    (stepButton ?? element).focus();
  }

  function showBody(request) {
    if (request.id === bodyId) return;
    const hadFocus = body.contains(document.activeElement);
    bodyId = request.id;
    lastRemaining = null;
    body.innerHTML = renderAlertBody(request);
    shortcutsFrom = Date.now() + SHORTCUT_GRACE_MS;
    if (hadFocus) element.focus();
  }

  function hide() {
    const hadFocus = isFocusInside();
    element.hidden = true;
    shownId = null;
    bodyId = null;
    headHtml = "";
    head.innerHTML = "";
    body.innerHTML = "";
    if (hadFocus) onLeave();
  }

  function render() {
    const focus = focusNow();
    if (!focus) {
      hide();
      return;
    }
    const about = describe(focus.request);
    if (shownId && focus.request.id !== shownId && isFocusInside()) announce(`${NEXT_REQUEST} ${arrivalText(about.requester, about.intent)}`);
    shownId = focus.request.id;
    element.hidden = false;
    showHead(focus, about);
    showBody(focus.request);
    showCountdown(focus.remainingMs, about);
  }

  function update(next) {
    pending = next.pending;
    projects = next.projects;
    const arrivals = knownIds ? newArrivals(knownIds, pending) : [];
    knownIds = new Set(pending.map((request) => request.id));
    if (arrivals.length > 0) announce(arrivalsText(arrivals.map(describe)));
    render();
  }

  function tick() {
    const focus = shownId ? focusNow() : null;
    if (focus) showCountdown(focus.remainingMs, describe(focus.request));
  }

  function decideByKey(action) {
    if (Date.now() < shortcutsFrom) return;
    const button = body.querySelector(`[data-decide="${action}"]`);
    if (button && !button.disabled) button.click();
  }

  function step(direction) {
    const focus = focusNow();
    shownId = (direction === "next" ? focus?.nextId : focus?.previousId) ?? shownId;
    render();
  }

  element.addEventListener("click", (event) => {
    const stepButton = event.target.closest("[data-step]");
    if (stepButton) return step(stepButton.dataset.step);
    const openAgent = event.target.closest("[data-open-agent]");
    if (openAgent) return onOpenAgent(openAgent.dataset.openAgent, openAgent);
    const decide = event.target.closest("[data-decide]");
    if (decide) return submitDecision(control, decide.closest("[data-pending]"), decide.dataset.decide);
    return undefined;
  });
  listenForDecisionKeys(element, decideByKey);
  setInterval(tick, COUNTDOWN_TICK_MS);

  return { update };
}
