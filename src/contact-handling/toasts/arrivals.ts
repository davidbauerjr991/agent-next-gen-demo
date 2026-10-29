// "A new assignment arrived" (P-HOME-1n): the one predicate the incoming toast and anything else asking it calls. An
// arrival is a rail card the agent hasn't seen yet that holds a contact the provider routed to them — offered,
// auto-accepted, or delivered by a script. Cards the agent started (a dial, New Outbound, a redial), reopened from
// history, or that were already there (seeded, restored) never are.
import type { Interaction as ProviderInteraction } from "@/domain";

/** The routing burst after the agent first goes Available (the sim routes the day's starting cards then): cards that
 *  arrive within it are the day's start, not arrivals, so they never toast; anything after does. */
export const ARRIVAL_GRACE_MS = 2_000;

/** Whether `now` is still inside the grace after the agent first went Available (`firstAvailableAt`; undefined: not
 *  Available yet, so everything is the baseline). */
export const inArrivalGrace = (firstAvailableAt: number | undefined, now: number): boolean =>
  firstAvailableAt === undefined || now - firstAvailableAt < ARRIVAL_GRACE_MS;

/** The provider contact's `origin` is the only signal: `routed` arrives; `agent-initiated` and `reopened` don't. */
export const isRoutedContact = (interaction: Pick<ProviderInteraction, "origin">): boolean => interaction.origin === "routed";

interface CardLike {
  id: string;
  threads: readonly { providerInteractionId?: string }[];
}

/** The cards in `cards` that are arrivals: not in `seen`, and holding a contact in `routed` (provider ids). */
export function newArrivals<C extends CardLike>(seen: ReadonlySet<string>, cards: readonly C[], routed: ReadonlySet<string>): C[] {
  return cards.filter((card) => !seen.has(card.id) && card.threads.some((th) => !!th.providerInteractionId && routed.has(th.providerInteractionId)));
}

/** A schedule item is an arrival when it wasn't in the day already listed (`seen`) and is waiting on the agent:
 *  scheduled, or offered (Needs a decision). An item never becomes a rail card until it's opened, so its arrival
 *  is decided from the schedule, not the card list. */
export function isScheduleArrival(seen: ReadonlySet<string>, item: { id: string; state: string }): boolean {
  return !seen.has(item.id) && (item.state === "scheduled" || item.state === "offered");
}
