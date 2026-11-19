// What the tick does to the tag of one agent. A new kind of signal redraws the whole tag, since the mark, the colour and the
// label under the name change with it; the same kind with a new text, such as the clock of a running test, touches only the
// text. Kept apart from the scene so it can be checked without a 3D context.
export function refreshSignal(entry, signal, relabel) {
  if (signal.kind !== entry.signal.kind) {
    relabel();
    return;
  }
  if (signal.text === entry.signal.text) return;
  entry.signal = signal;
  entry.tag.signal.text.textContent = signal.text;
}
