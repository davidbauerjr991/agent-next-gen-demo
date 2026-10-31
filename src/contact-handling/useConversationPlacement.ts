import { useSlotFor } from "@/layout/useSlot";
import type { AsyncPlacement, ConversationPlacement } from "./omnichannel";

/** The layout flags Settings → AI display resolves (P-AIFIRST), in one place.
 *  Since (k3) AI display alone decides where threads open; there is no
 *  omnichannel setting.
 *  - `panelPlacement` (AI display "main", the AI-first profile): the main
 *    column is the AI workspace and every conversation thread opens in the
 *    docked panel, one at a time ("one thread that moves").
 *  - `asyncPlacement`: "panel" under "main"; otherwise "tabs": every thread
 *    on a card, voice included, is a tab for the main column, and the docked
 *    panel holds Contact Details only.
 *    Under it the main column shows the AI workspace (Autosummary, AI feed,
 *    Copilot composer, wrap-up card); a call's tab follows AI display like
 *    every other thread (k5).
 *  - `aiInPanel`: AI display "panel", the AI feed in Contact Details.
 *  Since P-LAYOUT these read the parts' slots (`layout.parts`): "main" is the conversation in the docked panel,
 *  "panel" the AI feed there. */
export function useConversationPlacement() {
  const panelPlacement = useSlotFor("conversation") === "docked-panel";
  const aiFeedDocked = useSlotFor("aiFeed") === "docked-panel";
  const placement: ConversationPlacement = panelPlacement ? "panel" : "main";
  const asyncPlacement: AsyncPlacement = panelPlacement ? "panel" : "tabs";
  return {
    panelPlacement,
    placement,
    asyncPlacement,
    aiInPanel: aiFeedDocked,
  };
}
