// One rail card's expanded state under Collapse all / Expand all and the
// accordion rule (P-POLISH 2/3: collapsed, only the active card stays open),
// shared by conversation cards (NavCardItem) and kind cards (KindNavCard,
// P-HOME-1m) so both sit in the same store slice (`navChannelsExpandedById`,
// keyed by card key) and behave alike.
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "./workspace/WorkspaceContext";

/** lyra `InteractionNavItem`'s `channelsExpandedOverride` / `onChannelsExpandedChange` for the card `cardKey`. */
export function useCardCollapse(cardKey: string): {
  channelsExpandedOverride: { expanded: boolean; version: number };
  onChannelsExpandedChange: (expanded: boolean) => void;
} {
  const { activeInteractionId, channelsAllExpanded, channelsExpandedOverrideVersion, channelsExpandedById, setChannelsExpandedById } = useWorkspace();
  // A remounted card (nav collapsed to the rail and back, the placement swap) restores the expanded state the
  // store kept for it: lyra's card starts open and applies an override only when its version changes, so the
  // restore is a version bump after mount, and the card's first report (its default) isn't taken as the agent's.
  const [restoredExpanded] = useState(() => channelsExpandedById[cardKey]);
  const restoring = restoredExpanded !== undefined;
  const [mounted, setMounted] = useState(false);
  const firstReportSkipped = useRef(!restoring);
  useEffect(() => setMounted(true), []);
  // While collapsed (after "Collapse all") only the active card stays open: the version's low bit flips when this
  // card gains or loses the active slot, which re-applies the override. Expanded keeps the plain even version.
  const overrideLow = !channelsAllExpanded && cardKey === activeInteractionId ? 1 : 0;
  const overrideBase = channelsExpandedOverrideVersion * 2 + overrideLow;
  const [baseAtMount] = useState(overrideBase);
  // Until the next bulk click or active-card change, the restored state stands in for the bulk one.
  const expanded = restoring && mounted && overrideBase === baseAtMount ? restoredExpanded : channelsAllExpanded || cardKey === activeInteractionId;
  return {
    channelsExpandedOverride: { expanded, version: overrideBase * 2 + (restoring && mounted ? 1 : 0) },
    // Mirrors the card's own expanded state into the store (the Collapse all label catches up when every card agrees).
    onChannelsExpandedChange: (next) => {
      if (!firstReportSkipped.current) {
        firstReportSkipped.current = true;
        return;
      }
      setChannelsExpandedById((prev) => (prev[cardKey] === next ? prev : { ...prev, [cardKey]: next }));
    },
  };
}
