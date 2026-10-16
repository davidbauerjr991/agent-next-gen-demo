import { useSettings } from "@/settings";
import type { ConversationPlacement } from "./omnichannel";

/** The layout flags Settings → AI display resolves (P-AIFIRST), in one place:
 *  - `panelPlacement` (AI display "main", the AI-first profile): every
 *    conversation thread opens in the docked right panel and the main column
 *    is the AI workspace.
 *  - `omnichannel`: the tempo routing; AI display "main" implies it.
 *  - `aiInPanel`: AI display "panel", the AI feed in Contact Details.
 *  - `aiInMain`: AI display "main". */
export function useConversationPlacement() {
  const [assignments] = useSettings("assignments");
  const [ai] = useSettings("ai");
  const panelPlacement = ai.displayLocation === "main";
  const placement: ConversationPlacement = panelPlacement ? "panel" : "main";
  return {
    panelPlacement,
    placement,
    omnichannel: assignments.omnichannel || panelPlacement,
    aiInPanel: ai.displayLocation === "panel",
    aiInMain: panelPlacement,
  };
}
