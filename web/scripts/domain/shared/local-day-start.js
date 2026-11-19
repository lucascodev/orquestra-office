// The viewer's midnight of the day that holds the given moment. The collector turns the day at UTC midnight, so anything the
// page calls "today" is cut here, in the viewer's own time zone.
export const localDayStart = (ms) => new Date(ms).setHours(0, 0, 0, 0);
