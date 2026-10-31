// Showing the assignments list wherever it is (P-LAYOUT-F1 A2). Every path that used to expand the left nav to show
// an arrival (an incoming toast's View, a notification's new card, row 21; a scripted auto-answered contact) calls
// `revealAssignments`, so under the interior panel it opens the panel and leaves the nav as it was. The interior
// panel's defaults (the nav as a rail, the panel open and pinned) apply when the placement becomes the interior panel.
import { useEffect, useRef } from "react";
import type { SlotId } from "@/layout/slots";
import { setAssignmentsWorkingState } from "./assignments-working-state";

/** Show the assignments list: the interior panel opens (as an overlay where it doesn't fit, or unpinned); in the
 *  left nav, the nav expands. */
export function revealAssignments(slot: SlotId, setNavOpen: (open: boolean) => void): void {
  if (slot === "interior-panel") setAssignmentsWorkingState({ panelOpen: true });
  else if (slot === "left-nav") setNavOpen(true);
}

/** The interior panel's defaults: the left nav as a rail, the panel open and pinned. Defaults, not a lock: the agent
 *  can expand the nav or close the panel afterwards. */
export function applyInteriorPanelDefaults(setNavOpen: (open: boolean) => void): void {
  setNavOpen(false);
  setAssignmentsWorkingState({ panelOpen: true, panelPinned: true });
}

/** Applies `applyInteriorPanelDefaults` whenever the assignments move into the interior panel (a Settings change, a
 *  profile applied), and expands the nav again when they move back into it, so the cards are on screen. On load the
 *  nav's initial state already follows the slot (`navStartsOpen`), and the panel's per-browser open / pinned state
 *  is kept, so a reload doesn't reopen a panel the agent closed. */
export function useInteriorPanelDefaults(slot: SlotId, setNavOpen: (open: boolean) => void): void {
  const last = useRef(slot);
  useEffect(() => {
    if (last.current === slot) return;
    last.current = slot;
    if (slot === "interior-panel") applyInteriorPanelDefaults(setNavOpen);
    else setNavOpen(navStartsOpen(slot));
  }, [slot, setNavOpen]);
}

const NAV_UNTOUCHED = () => {};

/** The left nav's initial state: a rail under the interior panel, expanded otherwise. */
export function navStartsOpen(slot: SlotId): boolean {
  return slot !== "interior-panel";
}

/** Under the interior panel, a ringing call opens the panel, where its incoming tile is (the tile follows the
 *  assignments part); the nav stays as it was. Once per call. */
export function useRevealOnIncomingCall(
  slot: SlotId,
  cards: readonly { id: string; offered?: boolean; threads: readonly { type: string }[] }[],
): void {
  const seen = useRef(new Set<string>());
  useEffect(() => {
    for (const card of cards) {
      if (!card.offered || !card.threads.some((t) => t.type === "voice") || seen.current.has(card.id)) continue;
      seen.current.add(card.id);
      // The interior panel only: in the left nav a ringing call leaves the nav as it is (P-LAYOUT-F1 A2).
      if (slot === "interior-panel") revealAssignments(slot, NAV_UNTOUCHED);
    }
  }, [slot, cards]);
}
