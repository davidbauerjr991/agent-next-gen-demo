import { useCallback } from "react";
import type { TranscriptMessage } from "@/components/agent-next-gen-transcript";
import type { NextBestActionUse } from "@/components/ai-cards/NextBestActionCard";
import { timeLabel } from "@/components/ai-cards/ai-card-icon";
import { useAssistProvider, useContactAssistCards } from "@/provider-context";
import { CURRENT_AGENT_FIRST_NAME, CURRENT_AGENT_LAST_NAME } from "@/components/agent-next-gen-shared-utils";
import { LUCAS_THOMAS_ID } from "./scenario-cases";
import { useWorkspaceUiField } from "./workspace-ui-store";
import { useWorkspace } from "./workspace/WorkspaceContext";

// The Next Best Action's controller (P-CANVAS): the active thread's nba card
// (from the assist provider, by its contact) and what each of its buttons
// does. Using a suggestion (Insert into reply, Said it, Run it, an
// alternative's Use) or putting it aside (Not now) logs a compact AI row on
// the thread and answers the provider, which moves the card on.

const TEXT_CHANNELS = new Set(["chat", "sms", "whatsapp"]);
const AGENT_NAME = `${CURRENT_AGENT_FIRST_NAME} ${CURRENT_AGENT_LAST_NAME}`;

export function useNextBestAction() {
  const ws = useWorkspace();
  const assist = useAssistProvider();
  const { activeInteraction, activeChannel, activeChannelKey, activeChannelType, lucasThomasReviewing, scenarioKeyOf, setInteractions } = ws;
  const contactId = activeChannel?.providerInteractionId;
  const { nba: card } = useContactAssistCards(contactId);
  const [usedByContact, setUsedByContact] = useWorkspaceUiField("nbaUsedByContact");
  const [, setPrefill] = useWorkspaceUiField("composerPrefill");
  const cardId = activeInteraction?.id;
  const suggestion = card?.frame === "suggestion" ? card.suggestion : undefined;

  // A Say or Ask goes into the chat composer where the thread has one, is
  // "said" on a call, and is only copied elsewhere (email, a chat the bot still holds).
  const hasChatComposer =
    !!activeChannelType && TEXT_CHANNELS.has(activeChannelType) && !activeInteraction?.closed &&
    !(cardId && scenarioKeyOf(cardId) === LUCAS_THOMAS_ID && lucasThomasReviewing);
  const use: NextBestActionUse = activeChannelType === "voice" ? "said" : hasChatComposer ? "insert" : "copy";

  const log = useCallback(
    (outcome: "used" | "dismissed", title: string) => {
      if (!cardId) return;
      const at = timeLabel(Date.now());
      const message: TranscriptMessage = {
        id: `nba-${outcome}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: "agent",
        name: AGENT_NAME,
        initials: `${CURRENT_AGENT_FIRST_NAME[0] ?? ""}${CURRENT_AGENT_LAST_NAME[0] ?? ""}`,
        timestamp: at,
        text: title,
        nbaOutcome: { outcome, title, at },
      };
      setInteractions((prev) =>
        prev.map((c) =>
          c.id === cardId
            ? { ...c, liveMessages: { ...c.liveMessages, [activeChannelKey]: [...(c.liveMessages?.[activeChannelKey] ?? []), message] } }
            : c,
        ),
      );
      // The card's "Used" frame shows the last used suggestion; putting one aside clears it.
      if (contactId) {
        setUsedByContact((prev) => {
          const { [contactId]: _previous, ...rest } = prev;
          return outcome === "used" ? { ...rest, [contactId]: { title, at } } : rest;
        });
      }
      return at;
    },
    [cardId, activeChannelKey, contactId, setInteractions, setUsedByContact],
  );

  const resolve = useCallback(
    (outcome: "used" | "dismissed", alternative?: number) => {
      if (!card) return;
      assist.resolveCard(card.id, { outcome, ...(alternative !== undefined ? { alternative } : {}) }).catch((err) => {
        if (import.meta.env.DEV) console.warn("[nba] resolveCard failed", err);
      });
    },
    [assist, card],
  );

  const onUse = useCallback(() => {
    if (!suggestion || !cardId) return;
    if (suggestion.type === "do") {
      if (suggestion.link) ws.snapshotLinkHandlerFor(cardId)(suggestion.link);
    } else if (use === "insert" && suggestion.text) {
      setPrefill((prev) => ({ ...prev, [`${cardId}:${activeChannelKey}`]: suggestion.text! }));
    }
    log("used", suggestion.title);
    resolve("used");
  }, [suggestion, cardId, use, activeChannelKey, ws, setPrefill, log, resolve]);

  const onCopy = useCallback(() => {
    const text = suggestion?.text ?? suggestion?.action;
    if (text) void navigator.clipboard?.writeText(text).catch(() => {});
  }, [suggestion]);

  const onNotNow = useCallback(() => {
    if (!suggestion) return;
    log("dismissed", suggestion.title);
    resolve("dismissed");
  }, [suggestion, log, resolve]);

  const onUseAlternative = useCallback(
    (index: number) => {
      const alternative = suggestion?.alt[index];
      if (!alternative) return;
      log("used", alternative.text);
      resolve("used", index);
    },
    [suggestion, log, resolve],
  );

  return {
    card,
    used: contactId ? usedByContact[contactId] : undefined,
    use,
    onUse,
    onCopy,
    onNotNow,
    onUseAlternative,
  };
}
