export const ISLAND_SEATS = 6;
export const ISLAND_COLUMNS = 4;
export const FREE_ISLANDS = 2;
export const ISLAND_POD = { seatWidth: 1.2, sideMargin: 0, depth: 1.5, minWidth: 3.6 };
const MIN_ROWS = 2;
const FIRST_X = 1;
const STEP_X = 5;
const FIRST_Z = 9.8;
const STEP_Z = 4.6;
const DEPTH_WITH_ONE_ROW = 13.4;

export const rowCountFor = (occupiedIslands) => Math.max(MIN_ROWS, Math.ceil((occupiedIslands + FREE_ISLANDS) / ISLAND_COLUMNS));

export const depthFor = (rows) => DEPTH_WITH_ONE_ROW + STEP_Z * (rows - 1);

export function islandSlot(index) {
  const column = index % ISLAND_COLUMNS;
  const row = Math.floor(index / ISLAND_COLUMNS);
  return { index, column, row, x: FIRST_X + STEP_X * column, z: FIRST_Z + STEP_Z * row };
}

// Places past the free islands on the last row become a corner to chill out in; places left on earlier rows stay bare floor.
export function convivenceSlots(rows, occupiedIslands, cornerCount) {
  const firstUnused = occupiedIslands + FREE_ISLANDS;
  const lastRowStart = (rows - 1) * ISLAND_COLUMNS;
  return Array.from({ length: ISLAND_COLUMNS }, (_, column) => lastRowStart + column)
    .filter((index) => index >= firstUnused)
    .slice(0, cornerCount)
    .map(islandSlot);
}
