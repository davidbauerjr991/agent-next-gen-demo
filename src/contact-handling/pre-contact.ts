import type { NavCard } from "@/adapters/legacy/nav-card-view-model";

// Pre-contact summary (P0.5d.1): the context routing (IVR/ACD) hands over with
// an inbound call, on the domain `Interaction.preContactSummary`. Both pages
// show it as the card's Autosummary — for a known customer and, unlike the
// directory-based summary, for an unknown caller too. P2.4's handoff snapshot
// will be seeded from the same data.

/** The card's pre-contact summary lines, if a contact on it carried one. */
export function preContactSummaryOf(card: Pick<NavCard, "threads"> | null | undefined): string[] | undefined {
  return card?.threads.find((t) => t.preContactSummary && t.preContactSummary.length > 0)?.preContactSummary;
}

/** The overview with its Autosummary lines (and the Real-Time Summary, which
 *  is those lines joined) replaced by the pre-contact summary, when there is
 *  one. */
export function withPreContactSummary<T extends { snapshot?: string[]; realTimeSummary?: string }>(
  overview: T,
  summary: string[] | undefined,
): T {
  return summary ? { ...overview, snapshot: summary, realTimeSummary: summary.join(" ") } : overview;
}
