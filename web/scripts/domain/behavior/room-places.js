import {
  AT_DESK_WITH_NOTHING_TO_DO, busyReactionOf, freeTimePreferences, freeTimeReaction, HANDING_OVER, isHandingOver, isWindingDown, JUST_FINISHED,
} from "./agent-reactions.js";
import { besideDeskStop, roomSpots } from "../room/room-spots.js";

const NO_PREVIOUS = new Map();

const byKey = (a, b) => a.key.localeCompare(b.key);
const freeSinceOf = (agent, freeSince) => freeSince.get(agent.key) ?? agent.updatedAt;

function fixedPlaceOf(agent, now, spots, freeSince) {
  const desk = spots.desks.get(agent.key);
  const busy = busyReactionOf(agent);
  if (busy) {
    const isLeaving = busy === "leaving";
    return { stop: isLeaving ? spots.exit : desk, reaction: busy, isUrgent: !isLeaving };
  }
  if (isWindingDown(agent, now, freeSinceOf(agent, freeSince))) return { stop: desk, reaction: JUST_FINISHED, isUrgent: false };
  return null;
}

const freeTimePlace = (spot) => ({ stop: spot, reaction: freeTimeReaction(spot.activityId), isUrgent: false, isFreeTime: true });
const atDeskWithNothingToDo = (desk) => ({ stop: desk, reaction: AT_DESK_WITH_NOTHING_TO_DO, isUrgent: false });
const firstOffered = (wish, spots) => wish.find((activity) => (spots.freeTime.get(activity)?.length ?? 0) > 0);

// Someone on a spot, or on the way to it, keeps it while that activity is still their first choice.
function keptSpot(previousPlace, wish, spots, spotsById) {
  const spot = spotsById.get(previousPlace?.stop?.id);
  return spot && spot.activityId === firstOffered(wish, spots) ? spot : null;
}

function firstFreeSpot(wish, spots, taken, previousPlace) {
  for (const activity of wish) {
    const free = (spots.freeTime.get(activity) ?? []).filter((spot) => !taken.has(spot.id));
    if (free.length > 0) return free.find((spot) => spot.id === previousPlace?.stop?.id) ?? free[0];
  }
  return null;
}

function placeFreeTime(wishes, spots, previous) {
  const spotsById = new Map([...spots.freeTime.values()].flat().map((spot) => [spot.id, spot]));
  const taken = new Set();
  const places = new Map();
  for (const [key, wish] of wishes) {
    const kept = keptSpot(previous.get(key), wish, spots, spotsById);
    if (!kept || taken.has(kept.id)) continue;
    taken.add(kept.id);
    places.set(key, freeTimePlace(kept));
  }
  for (const [key, wish] of wishes) {
    if (places.has(key)) continue;
    const spot = firstFreeSpot(wish, spots, taken, previous.get(key));
    if (spot) taken.add(spot.id);
    places.set(key, spot ? freeTimePlace(spot) : atDeskWithNothingToDo(spots.desks.get(key)));
  }
  return places;
}

function handoffPlace(parentPlace, ownDesk) {
  const parentDesk = parentPlace?.stop;
  if (!parentDesk?.isDesk) return null;
  const side = (ownDesk?.x ?? parentDesk.x) >= parentDesk.x ? 1 : -1;
  return { stop: besideDeskStop(parentDesk, side), reaction: HANDING_OVER, isUrgent: false };
}

// One pass for every agent of every project over the same catalog: a spot goes to one person at a time, ties broken by key.
export function placeAgents({ agents, now, spots, freeSince, previous = NO_PREVIOUS }) {
  const ordered = [...agents].sort(byKey);
  const fixed = new Map();
  const wishes = new Map();
  for (const agent of ordered) {
    const place = fixedPlaceOf(agent, now, spots, freeSince);
    if (place) fixed.set(agent.key, place);
    else wishes.set(agent.key, freeTimePreferences(agent, now, freeSinceOf(agent, freeSince), spots.activities));
  }
  const free = placeFreeTime(wishes, spots, previous);
  const places = new Map(ordered.map((agent) => [agent.key, fixed.get(agent.key) ?? free.get(agent.key)]));
  for (const agent of agents) {
    const handoff = isHandingOver(agent, now) ? handoffPlace(places.get(agent.parentKey), spots.desks.get(agent.key)) : null;
    if (handoff) places.set(agent.key, handoff);
  }
  return places;
}

export function assignPlaces(agents, now, layout, freeSince) {
  return placeAgents({ agents, now, spots: roomSpots(layout), freeSince });
}
