// Day arithmetic and the time labels Home's rows, cards and kind cells show (P-HOME-1).

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Local midnight of the day `at` falls on. */
export function startOfDay(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const UNIT_MS: Record<string, number> = { m: 60_000, h: 60 * 60_000, d: DAY_MS };

/** How long ago a Contact History entry's "8m ago" / "2h ago" / "1d ago" (or "Just now") is, for merging it in time
 *  order with timestamped rows; 0 for anything else. */
export function agoMs(label: string): number {
  const match = /^(\d+)\s*([mhd]) ago$/.exec(label.trim());
  return match ? Number(match[1]) * UNIT_MS[match[2]!]! : 0;
}

/** "11:00 AM" today; "Tue 11:30 AM" within a week; a date beyond. */
export function feedTimeLabel(at: number, now: number): string {
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(at);
  if (startOfDay(at) === startOfDay(now)) return time;
  const day = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(at);
  return Math.abs(at - now) < 7 * DAY_MS ? `${day} ${time}` : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(at);
}
