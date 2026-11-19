export const PANEL_GAP = 16;
export const ALERT_WIDTH = 560;
const MIN_ALERT_WIDTH = 420;
const MIN_FREE_SHARE = 0.4;

// Panels are screen rectangles grouped by the edge they hang from. A direction whose panels would squeeze the map below a
// share of the screen is ignored, and the map runs under them instead of shrinking to a stamp.
export function insetsAroundPanels(viewport, { left = [], right = [], top = [], bottom = [] }, gap = PANEL_GAP) {
  const insets = {
    left: Math.max(gap, ...left.map((rect) => rect.right + gap)),
    right: Math.max(gap, ...right.map((rect) => viewport.width - rect.left + gap)),
    top: Math.max(gap, ...top.map((rect) => rect.bottom + gap)),
    bottom: Math.max(gap, ...bottom.map((rect) => viewport.height - rect.top + gap)),
  };
  const fitsAcross = viewport.width - insets.left - insets.right >= viewport.width * MIN_FREE_SHARE;
  const fitsDown = viewport.height - insets.top - insets.bottom >= viewport.height * MIN_FREE_SHARE;
  return {
    left: fitsAcross ? insets.left : gap,
    right: fitsAcross ? insets.right : gap,
    top: fitsDown ? insets.top : gap,
    bottom: fitsDown ? insets.bottom : gap,
  };
}

// The request alert sits in the top row between the brand and the accounts: centered on the screen when it fits, slid or narrowed
// to fit the gap otherwise, and lowered under the row when the gap is too tight to read a command.
export function alertPlacement({ viewportWidth, left = null, right = null }, gap = PANEL_GAP) {
  const from = (left?.right ?? 0) + gap;
  const to = (right?.left ?? viewportWidth) - gap;
  const width = Math.min(ALERT_WIDTH, to - from);
  if (width < MIN_ALERT_WIDTH) return { isLowered: true, left: null, width: null };
  const centered = (viewportWidth - width) / 2;
  return { isLowered: false, left: Math.min(Math.max(centered, from), to - width), width };
}
