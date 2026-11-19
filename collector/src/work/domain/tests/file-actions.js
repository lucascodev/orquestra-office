export const FILE_ACTION = Object.freeze({ READ: "read", CREATED: "created", EDITED: "edited" });

// A file the agent created and then edited is still a new file; one it edited and then read was still changed.
const STRENGTH = { [FILE_ACTION.READ]: 1, [FILE_ACTION.EDITED]: 2, [FILE_ACTION.CREATED]: 3 };

export function strongestAction(previous, current) {
  return (STRENGTH[previous] ?? 0) > STRENGTH[current] ? previous : current;
}

export const isWriting = (action) => action === FILE_ACTION.CREATED || action === FILE_ACTION.EDITED;
