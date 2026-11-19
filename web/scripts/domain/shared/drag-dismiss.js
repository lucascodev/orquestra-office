const SHARE_OF_HEIGHT = 0.25;
const MAX_DISTANCE_PX = 120;

// A sheet dragged down a quarter of its height closes; a tall one needs no more than a thumb's comfortable swipe.
export function isDismissedByDrag({ distance, sheetHeight }) {
  return distance >= Math.min(MAX_DISTANCE_PX, sheetHeight * SHARE_OF_HEIGHT);
}
