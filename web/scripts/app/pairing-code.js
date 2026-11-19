import { pairingCodeOf } from "../domain/office/pairing-fragment.js";

// The pairing code is taken out of the address before anything else, so it never lingers in the history or a bookmark.
export function takePairingCode({ location = window.location, history = window.history } = {}) {
  const code = pairingCodeOf(location.hash);
  if (code) history.replaceState(null, "", `${location.pathname}${location.search}`);
  return code;
}

// A link pasted into a tab already on the office changes only the fragment, which loads nothing; a reload redeems the code.
export function reloadOnPairingLink({ target = window, location = window.location } = {}) {
  target.addEventListener("hashchange", () => {
    if (pairingCodeOf(location.hash)) location.reload();
  });
}
