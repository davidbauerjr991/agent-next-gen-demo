// Assignment sort modes (P-PROFILES 0b). The mode and direction are a setting
// (`assignments.sort`, snapshotted by profiles); the Custom drag order is
// per-browser working state (`./assignment-order-store.ts`). `interactions`
// itself stays in insertion order: only the nav's rendering reorders a copy.
import { t } from "@/i18n";
import { CHANNEL_NAMES } from "./home/channel-names";
import type { AssignmentSortMode, AssignmentSortSettings } from "@/settings";
import { sortAssignments, type Interaction } from "@/components/agent-next-gen-interaction-dashboard";

/** A card's channel for Channel A–Z: its first thread's (the shared channel names, through `t()`). */
function channelName(interaction: Interaction): string {
  const first = [...interaction.threads].sort((a, b) => a.startTick - b.startTick)[0];
  return first ? t((CHANNEL_NAMES as Record<string, string>)[first.type] ?? first.type) : "";
}

const lastUpdated = (i: Interaction) => Math.max(...i.threads.map((c) => c.startTick), -Infinity);

/** `interactions` in `order`; cards not in it (new since the agent last
 *  dragged) go on top, newest first. */
export function applyCustomOrder(interactions: Interaction[], order: readonly string[]): Interaction[] {
  const position = new Map(order.map((id, i) => [id, i]));
  const fresh = interactions.filter((i) => !position.has(i.id)).sort((a, b) => lastUpdated(b) - lastUpdated(a));
  const placed = interactions.filter((i) => position.has(i.id)).sort((a, b) => position.get(a.id)! - position.get(b.id)!);
  return [...fresh, ...placed];
}

/** The nav's order for a sort setting. */
export function sortAssignmentCards(
  interactions: Interaction[],
  sort: AssignmentSortSettings,
  customOrder: readonly string[] = [],
): Interaction[] {
  switch (sort.mode) {
    case "custom":
      return applyCustomOrder(interactions, customOrder);
    case "channel": {
      const sign = sort.direction === "asc" ? 1 : -1;
      // Same channel: last updated first, whichever way the names run.
      return [...interactions].sort(
        (a, b) => sign * channelName(a).localeCompare(channelName(b)) || lastUpdated(b) - lastUpdated(a),
      );
    }
    default:
      return sortAssignments(interactions, sort.mode, sort.direction);
  }
}

/** A mode's natural direction, applied when the agent switches to it:
 *  newest first for the dates, A–Z for channels. */
export const DEFAULT_SORT_DIRECTION: Record<AssignmentSortMode, AssignmentSortSettings["direction"]> = {
  lastUpdated: "desc",
  startDate: "desc",
  channel: "asc",
  custom: "desc",
};
