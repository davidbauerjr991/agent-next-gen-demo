// The assignments part's slot as its readers outside the containers need it. The interior panel's own state is lyra
// `useSidePanelToggle`'s, in `PanelTogglesProvider` (P-LAYOUT-F1), over the per-browser working state.
import { useSlotFor } from "@/layout/useSlot";

/** The assignments are rows at the top of Home (placement none, or the part moved there): an offer is its row there,
 *  with Accept / Decline: the feed's Needs a decision leaves it out, and the incoming toast's View goes Home. */
export function useAssignmentsAtHomeTop(): boolean {
  return useSlotFor("assignments") === "home-top";
}
