// Scales in CSS pixels per floor unit. A desk seat is 1.2 units wide, so below these the tags and labels pile on each other.
export const FULL_TAGS_FROM_SCALE = 44;
export const FULL_AREA_LABELS_FROM_SCALE = 34;
const NAMED_FROM_AFAR = new Set(["needs_you"]);

export function tagDetail({ scale, status, isFollowed }) {
  if (isFollowed || scale >= FULL_TAGS_FROM_SCALE) return "full";
  return NAMED_FROM_AFAR.has(status) ? "name" : "dot";
}

export const areaLabelDetail = (scale) => (scale >= FULL_AREA_LABELS_FROM_SCALE ? "full" : "compact");
