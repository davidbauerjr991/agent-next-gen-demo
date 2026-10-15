import type { NavCard } from "@/adapters/legacy/nav-card-view-model";

/** Whether a card's record-header session controls show: Outcome, Add
 *  Participant, Transfer, the status chip and the "+" (add channel). A
 *  ringing offer has no session yet, so they're hidden (hide, don't
 *  disable) until it's accepted. Shared by both pages. */
export function showsSessionControls(card: Pick<NavCard, "offered">): boolean {
  return !card.offered;
}
