// What a nav card reads from the page clock besides its timer text (P-LAYOUT-F2 8): the tiers its colours come from —
// an offered card's answer SLA, a reply's awaiting tier, a hold's tier — per thread. The card subscribes to this key
// (`useClockValue`), so it re-renders when a tier changes, not every second; the timers themselves are self-ticking
// nodes (`ElapsedSince`). Every tier the card shows is one of these (a row's own, or the card's: the worst or earliest
// of its threads'), so a change it shows always changes the key.
import { getHoldSeverity } from "@nicecxone/lyra-ui";
import type { Interaction } from "@/components/agent-next-gen-interaction-dashboard";
import { getAwaitingSeverity } from "@/components/agent-next-gen-shared-utils";
import { answerSeverity } from "./answer-sla";

type Sla = Parameters<typeof answerSeverity>[1];

/** The card's colour tiers at `tick`, as one string: it changes only when a tier does. */
export function cardTimeTiers(card: Pick<Interaction, "offered" | "threads">, tick: number, sla: Sla): string {
  return card.threads
    .map((c) => {
      const answer = card.offered ? answerSeverity(tick - c.startTick, sla) : "";
      const awaiting = c.awaitingResponse ? getAwaitingSeverity(tick - (c.lastCustomerMessageTick ?? c.startTick)) : "";
      const hold = c.heldSinceTick !== undefined ? getHoldSeverity(tick - c.heldSinceTick) : "";
      return `${answer}/${awaiting}/${hold}`;
    })
    .join("|");
}
