const FRAMED_ROOMS = new Set(["meeting", "pantry", "games", "lounge", "reception"]);
const ROOM_HEIGHT = 2.4;
const ISLAND_HEIGHT = 1.2;
// The flag on top of the pole and the cap of the sign must fit when the whole headquarters is framed.
const FLAG_ALLOWANCE = 0.2;

const contains = ({ x, z, w, d }, point) => point.x >= x && point.x <= x + w && point.z >= z && point.z <= z + d;
const boundsOf = ({ x, z, w, d }, maxY) => ({ minX: x, maxX: x + w, minZ: z, maxZ: z + d, minY: 0, maxY });

export const wholeHeadquartersBounds = (layout) => ({ ...layout.bounds, minY: 0, maxY: layout.yard.flagpole.height + FLAG_ALLOWANCE });

export function boundsToFrameAt(layout, point) {
  const island = layout.islands.find((candidate) => contains(candidate.rug, point));
  if (island) return boundsOf(island.rug, ISLAND_HEIGHT);
  const room = layout.areas.find((area) => FRAMED_ROOMS.has(area.id) && contains(area, point));
  return room ? boundsOf(room, ROOM_HEIGHT) : wholeHeadquartersBounds(layout);
}
