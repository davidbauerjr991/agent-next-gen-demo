// What opens after an assignment closes (P-LAYOUT-F1 A4): the top active assignment in the list, in the list's own
// order (so it honours the agent's sort, Custom included), else Home. Under every placement. One function the close
// path calls, so it can become a setting later. Kind cards (callbacks, meetings, app items) aren't picked yet: their
// behaviour here isn't designed (PROGRESS Known gaps).
import type { AssignmentEntry } from "./useAssignmentCards";

/** The card to open after `closedId` closes: the first remaining conversation in `entries` (the list's order) that's
 *  active — not an offer still ringing or waiting for Accept — or `null` (Home). */
export function nextAfterClose(entries: readonly AssignmentEntry[], closedId: string): string | null {
  for (const entry of entries) {
    if (entry.type !== "conversation" || entry.key === closedId) continue;
    if (entry.interaction.offered) continue;
    return entry.key;
  }
  return null;
}
