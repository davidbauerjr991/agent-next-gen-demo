import type { AiDisplayLocation } from "@/settings/settings-schema";
import { PARTS } from "@/layout/parts";
import type { DetailPanelContent } from "./workspace/workspace-types";

/** Where the interior slide-over (an AI row's or Copilot's panel) mounts.
 *  "panel": in the docked right panel — AI display "panel"'s card links and
 *  Copilot results. "referenceSlot": in the reference column's slot beside the
 *  action area (P-CANVAS), below the record header, pushing the action area
 *  when dragged. */
export type SlideOverPlacement = { mode: "panel" | "referenceSlot" };

/** The content kinds that are layout parts with a slot of their own (P-HOME-1n): Contact Details (its Experience
 *  Memory and Artifacts sub-pages included) and Session Details. They go where their part's slot is — the reference
 *  slide-over by default — under every AI display. */
const PART_SLOT: Partial<Record<DetailPanelContent["kind"], keyof typeof PARTS>> = {
  contactDetails: "contactDetails",
  session: "sessionDetails",
};

/** One placement rule for every mode. `content` is this render's selection
 *  (the last one while closing), so a placement never lags its content. */
export function slideOverPlacement({
  displayLocation,
  content,
}: {
  displayLocation: AiDisplayLocation;
  content: DetailPanelContent | null;
}): SlideOverPlacement {
  const part = content ? PART_SLOT[content.kind] : undefined;
  if (part) return { mode: PARTS[part].defaultSlot === "docked-panel" ? "panel" : "referenceSlot" };
  return { mode: displayLocation === "panel" ? "panel" : "referenceSlot" };
}
