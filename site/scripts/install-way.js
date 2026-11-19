const WAY_SEPARATOR = /\s+/;

export const isShownForWay = (partWays, selectedWay) => partWays.trim().split(WAY_SEPARATOR).includes(selectedWay);
