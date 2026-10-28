// Contact History's date range (P-HOME-1m): lyra's DateRangeFilterChip as-is,
// its own ranges (Today / Yesterday / Last 7 days / Custom), mapped onto the
// entries by when each happened (its "8m ago", from now). Contact History's
// card and the Activity feed's History view read it the same way.
// Types only from lyra here: the options themselves (a lyra value) are CONTACT_HISTORY_RANGE_OPTIONS, UI-side.
import type { DateRange, DateRangeFilterValue } from "@nicecxone/lyra-ui";
import { DAY_MS, agoMs, startOfDay } from "./home/time";

/** The window a range covers, [from, to) in epoch ms. Custom: the picked days, whole (none picked: the week). */
export function contactHistoryWindow(range: DateRangeFilterValue, now: number, custom?: DateRange): { from: number; to: number } {
  const today = startOfDay(now);
  switch (range) {
    case "today":
      return { from: today, to: Infinity };
    case "yesterday":
      return { from: today - DAY_MS, to: today };
    case "custom":
      if (custom?.from) return { from: startOfDay(custom.from.getTime()), to: startOfDay((custom.to ?? custom.from).getTime()) + DAY_MS };
      return { from: now - 7 * DAY_MS, to: Infinity };
    // Last 7 days (the shared option set offers no other range).
    default:
      return { from: now - 7 * DAY_MS, to: Infinity };
  }
}

/** When an entry happened: `now` less its "8m ago". */
export const contactHistoryEntryAt = (entry: { timeAgo: string }, now: number) => now - agoMs(entry.timeAgo);

/** The entries in `range`, in their own order. */
export function contactHistoryInRange<E extends { timeAgo: string }>(entries: readonly E[], range: DateRangeFilterValue, now: number, custom?: DateRange): E[] {
  const { from, to } = contactHistoryWindow(range, now, custom);
  return entries.filter((entry) => {
    const at = contactHistoryEntryAt(entry, now);
    return at >= from && at < to;
  });
}
