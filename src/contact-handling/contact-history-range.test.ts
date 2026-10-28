// Contact History's date range (P-HOME-1m): lyra's DateRangeFilterChip ranges
// mapped onto the entries by when each happened.
import { describe, expect, it } from "vitest";
import { contactHistoryInRange, contactHistoryWindow } from "./contact-history-range";

const NOW = new Date(2026, 9, 24, 10, 30).getTime();
const entries = ["Just now", "8m ago", "5h ago", "1d ago", "2d ago", "6d ago", "9d ago"].map((timeAgo) => ({ timeAgo }));
const ages = (range: Parameters<typeof contactHistoryInRange>[1], custom?: Parameters<typeof contactHistoryInRange>[3]) =>
  contactHistoryInRange(entries, range, NOW, custom).map((e) => e.timeAgo);

describe("contactHistoryInRange", () => {
  it("Today is since midnight; Yesterday the day before alone; Last 7 days the week", () => {
    expect(ages("today")).toEqual(["Just now", "8m ago", "5h ago"]);
    expect(ages("yesterday")).toEqual(["1d ago"]);
    expect(ages("last7")).toEqual(["Just now", "8m ago", "5h ago", "1d ago", "2d ago", "6d ago"]);
  });

  it("Custom is the picked days, whole (one day picked: that day); none picked: the week", () => {
    expect(ages("custom", { from: new Date(2026, 9, 22), to: new Date(2026, 9, 23) })).toEqual(["1d ago", "2d ago"]);
    expect(ages("custom", { from: new Date(2026, 9, 22) })).toEqual(["2d ago"]);
    expect(ages("custom")).toEqual(ages("last7"));
    expect(contactHistoryWindow("custom", NOW, { from: new Date(2026, 9, 22) })).toEqual({
      from: new Date(2026, 9, 22).getTime(),
      to: new Date(2026, 9, 23).getTime(),
    });
  });
});
