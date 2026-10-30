import { useCallback } from "react";
import { useWorkspaceUiField } from "./workspace-ui-store";

// A call's "Hide Transcript" (P-CANVAS): under AI display inline, a voice
// contact's main column can drop the transcript's utterances and keep only
// the AI rows (Next Best Action, Copilot results, Used/Dismissed, approvals).
// Per card, in the workspace UI store, so it's kept across card switches;
// Contact Details offers its Transcript tab while it's on.

/** Where the toggle shows: a call under AI display inline (not chat or email, not under main or panel). `aiInline`:
 *  the conversation and the AI feed both in the main column (`layout.parts`, P-LAYOUT). */
export const transcriptToggleApplies = (aiInline: boolean, channelType: string | undefined) => aiInline && channelType === "voice";

/** Whether the agent hid this card's transcript, and the setter. Only the toggle's own contacts read it as hidden. */
export function useTranscriptHidden(cardId: string | undefined, applies: boolean): [boolean, (hide: boolean) => void] {
  const [byCard, setByCard] = useWorkspaceUiField("transcriptHiddenByCard");
  const setHidden = useCallback(
    (hide: boolean) => {
      if (cardId) setByCard((prev) => ({ ...prev, [cardId]: hide }));
    },
    [cardId, setByCard],
  );
  return [applies && !!cardId && !!byCard[cardId], setHidden];
}
