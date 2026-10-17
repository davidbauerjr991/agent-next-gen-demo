import type { Interaction as DomainInteraction, InteractionState } from "@/domain";

const BADGE: Partial<Record<InteractionState, string>> = {
  offered: "Ringing",
  connecting: "Active Call",
  active: "Active Call",
  held: "Call On Hold",
  "wrap-up": "Wrap-up",
};

/** Which call state wins when a card has more than one call (a live one first). */
const PRIORITY: InteractionState[] = ["active", "connecting", "held", "offered", "wrap-up"];

/** The record header's call badge (P-AIFIRST (k6) 7), every mode, from the
 *  card's calls' provider state: "Active Call" while live, "Call On Hold"
 *  while held, "Ringing" while offered, "Wrap-up" during wrap-up; none once
 *  ended or without a call. */
export function callBadge(
  card: { threads: readonly { type: string; providerInteractionId?: string }[] } | undefined,
  contacts: readonly DomainInteraction[],
): string | undefined {
  if (!card) return undefined;
  const ids = new Set(card.threads.filter((t) => t.type === "voice" && t.providerInteractionId).map((t) => t.providerInteractionId));
  const states = contacts.filter((c) => ids.has(c.id)).map((c) => c.state);
  const state = PRIORITY.find((s) => states.includes(s));
  return state ? BADGE[state] : undefined;
}
