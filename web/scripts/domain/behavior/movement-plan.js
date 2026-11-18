const SAME_STOP = 0.01;

const KEEP = Object.freeze({ kind: "keep" });

const isSameStop = (a, b) => Boolean(a && b) && Math.abs(a.x - b.x) < SAME_STOP && Math.abs(a.z - b.z) < SAME_STOP;

function keepsCourse(person, stop, isUrgent) {
  if (!isSameStop(person.stop, stop)) return false;
  return !isUrgent || !person.isWalking || person.isHurrying;
}

// Coming in through the door only makes sense in a room the viewer has seen before; on the first look everyone is already in place.
function startingPoint(person, room) {
  if (person.lastSeen) return person.lastSeen;
  return room.hasVisited ? room.door : null;
}

// Desks move when an island shifts: whoever sits at one sits down at the new one, whether the person was kept or drawn again.
function staysSeated(person, stop) {
  if (!stop.isDesk) return false;
  if (person.position) return Boolean(person.isSeated && person.stop?.isDesk);
  return Boolean(person.lastSeen?.wasAtDesk);
}

export function planMovement({ person, place, room, isMotionReduced }) {
  const { stop, isUrgent } = place;
  if (keepsCourse(person, stop, isUrgent)) return KEEP;
  const from = person.position ?? startingPoint(person, room);
  if (!from || isMotionReduced || staysSeated(person, stop) || isSameStop(from, stop)) return { kind: "place", stop };
  const origin = isSameStop(from, person.stop) ? person.stop : { x: from.x, z: from.z };
  return { kind: "walk", from, path: room.routeFor(origin, stop), isUrgent };
}
