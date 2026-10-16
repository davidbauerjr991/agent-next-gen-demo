import { useSettings } from "@/settings";
import type { AsyncPlacement, ConversationPlacement } from "./omnichannel";

/** The layout flags Settings → AI display resolves (P-AIFIRST), in one place:
 *  - `panelPlacement` (AI display "main", the AI-first profile): every
 *    conversation thread opens in the docked right panel and the main column
 *    is the AI workspace.
 *  - `omnichannel`: the tempo routing; AI display "main" implies it.
 *  - `asyncPlacement` (P-AIFIRST (k)): where a thread that isn't the main
 *    column's goes. "panel" (omnichannel): the docked panel, one thread
 *    that moves. "tabs" (omnichannel off): the header channel icons are
 *    tabs for the main column, and the docked panel holds Contact Details
 *    only, never a thread.
 *  - `aiInPanel`: AI display "panel", the AI feed in Contact Details.
 *  - `aiInMain`: AI display "main". */
export function useConversationPlacement() {
  const [assignments] = useSettings("assignments");
  const [ai] = useSettings("ai");
  const panelPlacement = ai.displayLocation === "main";
  const placement: ConversationPlacement = panelPlacement ? "panel" : "main";
  const omnichannel = assignments.omnichannel || panelPlacement;
  const asyncPlacement: AsyncPlacement = omnichannel ? "panel" : "tabs";
  return {
    panelPlacement,
    placement,
    asyncPlacement,
    omnichannel,
    aiInPanel: ai.displayLocation === "panel",
    aiInMain: panelPlacement,
  };
}
