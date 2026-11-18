export const YARD_AREA = "yard";

const contains = (area, { x, z }) => x >= area.x && x <= area.x + area.w && z >= area.z && z <= area.z + area.d;

export function areaOfPoint(layout, point) {
  return layout.areas.find((area) => contains(area, point))?.id ?? YARD_AREA;
}
