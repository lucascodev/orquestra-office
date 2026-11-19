import { isScreenLit } from "../../domain/office/agent-status.js";
import { hashOf, rng } from "../../domain/shared/seeded-random.js";
import { group } from "../kit.js";
import { bin, desk, station, vacantStation } from "./furniture.js";
import { rug } from "./parts.js";

const BIN_OFFSET_X = 0.32;

const islandSeed = (island) => `island|${island.projectKey ?? "free"}|${island.index}`;

function seatAt(parent, island, seat) {
  const { desk: top, theme } = island;
  const edgeZ = seat.direction === 1 ? top.z : top.z + top.d;
  if (seat.agent) station(parent, seat.cx, edgeZ, seat.direction, theme, isScreenLit(seat.agent), rng(hashOf(seat.agent.key)));
  else vacantStation(parent, seat.cx, edgeZ, seat.direction, theme);
}

// The island of the plan: two rows of three desks facing each other across a low divider in the theme's divider color.
export function buildIsland(parent, island) {
  const { desk: top, theme } = island;
  const piece = group(parent);
  piece.userData.projectKey = island.projectKey;
  rug(piece, island.rug.x, island.rug.z, island.rug.w, island.rug.d, theme.rug);
  desk(piece, top.x, top.z, top.w, top.d, { ...theme, partition: theme.divider }, rng(hashOf(islandSeed(island))));
  bin(piece, top.x - BIN_OFFSET_X, top.z + top.d / 2);
  for (const seat of island.seats) seatAt(piece, island, seat);
  return piece;
}
