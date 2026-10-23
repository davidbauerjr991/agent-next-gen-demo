import { useCallback, useEffect, useRef } from "react";
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";
import type { TranscriptMessage } from "@/components/transcript/InteractionTranscript";
import { AI_PERFORM_MS } from "./ai-perform";

// Ask Copilot on a scripted case (P0.5c, moved out of the Advanced page):
// anything the agent asks is logged in the chat as an instruction row (the
// same clickable interstitial an approval decision gets), and a free-form
// question opens its result panel once Copilot "finishes". Agent-side assist
// UI, so it stays a page overlay row on the card's thread; AssistProvider
// takes it over in P4.8.

/** How long Copilot "works" on a free-form question before its panel opens. */
export const COPILOT_ASK_RESULT_MS = 1800;

/** Runs a Copilot result after its "working" delay; pending ones are
 *  cancelled on unmount. For asks that keep their own rows (Marcus's
 *  Copilot requests live in his Next Best Action card). */
export function useCopilotResultTimer(): (run: () => void, ms: number) => void {
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
      pending.clear();
    };
  }, []);
  return useCallback((run: () => void, ms: number) => {
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      run();
    }, ms);
    timers.current.add(timer);
  }, []);
}

export interface CopilotAskOptions {
  setCards: (update: (prev: NavCard[]) => NavCard[]) => void;
  /** The panel a lookup chip opens (so the row reopens the same content), if `text` is one. */
  linkFor: (cardId: string, text: string) => string | undefined;
  /** Whether a free-form question on this card opens its result panel by itself. */
  autoOpensResult: (cardId: string) => boolean;
  /** `link`: the row's own link, so the opened result marks that row active. */
  openResult: (cardId: string, request: { text: string; time: string; link: string }) => void;
  /** Called on every ask (the page reveals hidden AI action rows). */
  onAsk?: () => void;
  agentName?: string;
}

export function useCopilotAsk({ setCards, linkFor, autoOpensResult, openResult, onAsk, agentName = "John Smith" }: CopilotAskOptions) {
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const latest = useRef({ linkFor, autoOpensResult, openResult, onAsk });
  useEffect(() => {
    latest.current = { linkFor, autoOpensResult, openResult, onAsk };
  });

  return useCallback(
    (cardId: string, threadKey: string, text: string) => {
      const { linkFor: link, autoOpensResult: autoOpens, onAsk: asked } = latest.current;
      asked?.();
      const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const chipLink = link(cardId, text);
      const id = `copilot-ask-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      // A free-form question's row is identified by its own id (the trailing segment), not by its text and
      // minute: the same question asked twice is two rows, each opening and marking its own result (P-EXTRACT).
      const ownLink = `instruction:copilot:${encodeURIComponent(text)}:${encodeURIComponent(time)}:${id}`;
      const message: TranscriptMessage = {
        id,
        sender: "agent",
        name: agentName,
        initials: agentName
          .split(/\s+/)
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() ?? "")
          .join(""),
        timestamp: time,
        text,
        instruction: {
          title: text,
          by: agentName,
          // Lookup chips reopen the exact panel the chip opens; free-form
          // questions open the instruction/result panel.
          link: chipLink ?? ownLink,
          performedAt: Date.now() + AI_PERFORM_MS,
        },
      };
      setCards((prev) =>
        prev.map((card) =>
          card.id === cardId
            ? { ...card, liveMessages: { ...card.liveMessages, [threadKey]: [...(card.liveMessages?.[threadKey] ?? []), message] } }
            : card,
        ),
      );
      if (!chipLink && autoOpens(cardId)) {
        const timer = setTimeout(() => {
          timers.current.delete(timer);
          latest.current.openResult(cardId, { text, time, link: ownLink });
        }, COPILOT_ASK_RESULT_MS);
        timers.current.add(timer);
      }
    },
    [setCards, agentName],
  );
}
