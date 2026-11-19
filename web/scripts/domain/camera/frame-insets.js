export const PANEL_GAP = 16;
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
