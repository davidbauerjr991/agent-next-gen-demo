import type { AiDisplayLocation } from "@/settings/settings-schema";
import type { DetailPanelContent } from "./workspace/workspace-types";

/** Where the interior slide-over (an AI row's or Copilot's panel) mounts.
 *  "panel": in the docked right panel — AI display "panel", and a thread's
 *  Session Details (a panel thread's under "main"). "referenceSlot": in the
 *  reference column's slot beside the action area (P-CANVAS), below the
 *  record header, pushing the action area when dragged. */
export type SlideOverPlacement = { mode: "panel" | "referenceSlot" };

/** One placement rule for every mode. `content` is this render's selection
 *  (the last one while closing), so a placement never lags its content. */
export function slideOverPlacement({
  displayLocation,
  content,
}: {
  displayLocation: AiDisplayLocation;
  content: DetailPanelContent | null;
}): SlideOverPlacement {
  return { mode: displayLocation === "panel" || content?.kind === "session" ? "panel" : "referenceSlot" };
}
