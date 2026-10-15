import type { NavCard } from "@/adapters/legacy/nav-card-view-model";

// Voice wrap-up on a card (P0.5d.1). A provider call that ended (by the agent
// or the customer) stays in "wrap-up" until its outcome is saved; the view
// model marks that thread with `wrapUpSinceTick`. Pages render the inline
// wrap-up card for it and the nav row's "Needs outcome" chip from this — no
// prompt, no page switch.

/** The card's voice thread waiting for an outcome, if any. */
export function voiceWrapUpThread(card: Pick<NavCard, "threads"> | null | undefined): NavCard["threads"][number] | undefined {
  return card?.threads.find((t) => t.type === "voice" && t.wrapUpSinceTick !== undefined);
}
