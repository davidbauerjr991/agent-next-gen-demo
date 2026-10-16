import { cn } from "@/lib/utils";

// The record header's panel toggle group: one icon per channel plus Contact
// Details. Every member is a lyra outline `Button`; these are its states, so
// each member looks the same in each state.

/** Active: lyra `ToggleGroup`'s selected item tokens (toggle-group.tsx), on
 *  every member alike. A member is active while its thread is on screen (in
 *  the main column or the panel), or, for Contact Details, while the panel
 *  shows it, so inline and panel modes can have two active members; "main"
 *  has one. Which one the panel shows (`aria-pressed`) is a separate fact. */
export const PANEL_TOGGLE_ACTIVE =
  "bg-lyra-bg-active-subtle border-lyra-border-active text-lyra-fg-active-strong hover:bg-lyra-state-hover-active-subtle active:bg-lyra-state-pressed-active-subtle";

/** A member's state classes. While its hover preview is open, an inactive
 *  member keeps its hover look. */
export function panelToggleClass({ active, previewOpen }: { active: boolean; previewOpen?: boolean }) {
  return cn(active ? PANEL_TOGGLE_ACTIVE : previewOpen && "bg-lyra-state-hover");
}
