import { useCallback, useEffect, useRef } from "react";
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";
import type { TranscriptMessage } from "@/components/agent-next-gen-transcript";

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
  openResult: (cardId: string, request: { text: string; time: string }) => void;
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
      const message: TranscriptMessage = {
        id: `copilot-ask-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
          link: chipLink ?? `instruction:copilot:${encodeURIComponent(text)}:${encodeURIComponent(time)}`,
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
          latest.current.openResult(cardId, { text, time });
        }, COPILOT_ASK_RESULT_MS);
        timers.current.add(timer);
      }
    },
    [setCards, agentName],
  );
}
