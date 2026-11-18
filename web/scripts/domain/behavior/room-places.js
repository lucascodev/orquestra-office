import {
  AT_DESK_WITH_NOTHING_TO_DO, busyReactionOf, freeTimePreferences, freeTimeReaction, HANDING_OVER, isHandingOver, isWindingDown, JUST_FINISHED,
} from "./agent-reactions.js";
import { besideDeskStop, roomSpots } from "../room/room-spots.js";

// Shared spots go out in key order, so the same people keep the same spot between redraws.
export function assignPlaces(agents, now, layout, freeSince) {
  const { desks, freeTime, exit, activities } = roomSpots(layout);
  const places = new Map();
  for (const agent of [...agents].sort((a, b) => a.key.localeCompare(b.key))) {
    const desk = desks.get(agent.key);
    const busy = busyReactionOf(agent);
    if (busy) {
      const isLeaving = busy === "leaving";
      places.set(agent.key, { stop: isLeaving ? exit : desk, reaction: busy, isUrgent: !isLeaving });
      continue;
    }
    const since = freeSince.get(agent.key) ?? agent.updatedAt;
    if (isWindingDown(agent, now, since)) {
      places.set(agent.key, { stop: desk, reaction: JUST_FINISHED, isUrgent: false });
      continue;
    }
    const activity = freeTimePreferences(agent, now, since, activities).find((id) => freeTime[id]?.length > 0);
    places.set(agent.key, activity
      ? { stop: freeTime[activity].shift(), reaction: freeTimeReaction(activity), isUrgent: false, isFreeTime: true }
      : { stop: desk, reaction: AT_DESK_WITH_NOTHING_TO_DO, isUrgent: false });
  }
  for (const agent of agents) {
    const handoff = isHandingOver(agent, now) ? handoffPlace(places.get(agent.parentKey), desks.get(agent.key)) : null;
    if (handoff) places.set(agent.key, handoff);
  }
  return places;
}

function handoffPlace(parentPlace, ownDesk) {
  const parentDesk = parentPlace?.stop;
  if (!parentDesk?.isDesk) return null;
  const side = (ownDesk?.x ?? parentDesk.x) >= parentDesk.x ? 1 : -1;
  return { stop: besideDeskStop(parentDesk, side), reaction: HANDING_OVER, isUrgent: false };
}
