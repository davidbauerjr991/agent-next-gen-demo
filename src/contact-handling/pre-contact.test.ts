import { describe, expect, it } from "vitest";
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";
import { preContactSummaryOf, withPreContactSummary } from "./pre-contact";

// P0.5d.1: an inbound call's pre-contact summary replaces the card's
// Autosummary lines and the Real-Time Summary built from them.
describe("pre-contact summary", () => {
  const summary = ["Inbound call from +15551234567, no prior history."];
  const card = (threads: NavCard["threads"]): Pick<NavCard, "threads"> => ({ threads });

  it("reads the summary from whichever thread on the card carries one", () => {
    expect(preContactSummaryOf(card([{ id: "sms", type: "sms", startTick: 0 }]))).toBeUndefined();
    expect(
      preContactSummaryOf(
        card([
          { id: "sms", type: "sms", startTick: 0 },
          { id: "voice", type: "voice", startTick: 0, preContactSummary: summary },
        ]),
      ),
    ).toEqual(summary);
    expect(preContactSummaryOf(undefined)).toBeUndefined();
  });

  it("replaces the snapshot and the real-time summary together, and leaves the rest", () => {
    const overview = { snapshot: ["Directory line."], realTimeSummary: "Directory line.", nextBestAction: "Greet." };
    expect(withPreContactSummary(overview, summary)).toEqual({
      snapshot: summary,
      realTimeSummary: summary[0],
      nextBestAction: "Greet.",
    });
    expect(withPreContactSummary(overview, undefined)).toBe(overview);
  });
});
