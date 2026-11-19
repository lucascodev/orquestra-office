import { ownValueOf } from "../shared/own-value.js";

const NO_OUTBOX = {};

// Messages sent in the middle of a turn wait in the collector's outbox until the agent's turn ends.
export const queuedCountOf = (outbox, agentKey) => ownValueOf(outbox ?? NO_OUTBOX, agentKey) ?? 0;

export const queuedText = (count) => (count > 0 ? `${count} na fila` : "");
