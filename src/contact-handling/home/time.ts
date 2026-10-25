// Day arithmetic and the time labels Home's rows, cards and kind cells show (P-HOME-1).

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Local midnight of the day `at` falls on. */
export function startOfDay(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "11:00 AM" today; "Tue 11:30 AM" within a week; a date beyond. */
export function feedTimeLabel(at: number, now: number): string {
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(at);
  if (startOfDay(at) === startOfDay(now)) return time;
  const day = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(at);
  return Math.abs(at - now) < 7 * DAY_MS ? `${day} ${time}` : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(at);
}
