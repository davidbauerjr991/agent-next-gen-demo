import { useCallback, useEffect, useRef } from "react";
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";
import type { TranscriptMessage } from "@/components/transcript/InteractionTranscript";
import { AI_PERFORM_MS } from "./ai-perform";
import { rememberCopilotAnswer, resultPresentation, type CopilotResult } from "./copilot-results";
import { t } from "@/i18n";
import type { InteractionId } from "@/domain";
import { useAssistProvider } from "@/provider-context";
import { redact } from "@/providers/redaction";

// Ask Copilot on an assignment (P0.5c, moved out of the Advanced page; every
// card since P-HOME-1j). P-LAYOUT-F1 F: a plain answer (`resultPresentation`,
// copilot-results.ts) shows the instruction row's "performing" state, then,
// once Copilot "finishes", an event line — "time · Copilot · the question",
// then the text — not clickable and not an artifact. Anything more is the
// instruction row (the same clickable interstitial an approval decision
// gets), whose result opens on its own only
// when it carries an artifact (a lookup chip opens its own panel instead).
// Agent-side assist UI, so it stays a page overlay row on the card's thread.
// The answer is the AssistProvider's ("ask" trigger, an answer card;
// P-LAYOUT-F2 5b), unless the question has a registered result.

/** How long Copilot "works" on a free-form question before its panel opens. */
const COPILOT_ASK_RESULT_MS = 1800;

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

const ASK_ID_PREFIX = "copilot-ask-";

/** A card's Copilot asks across its threads, in ask order: the instruction rows `useCopilotAsk` logs (P-HOME-1h: the
 *  Real-Time Summary lists them). */
export function copilotAsksOf(card: Pick<NavCard, "liveMessages"> | undefined): (TranscriptMessage & { instruction: NonNullable<TranscriptMessage["instruction"]> })[] {
  return Object.values(card?.liveMessages ?? {})
    .flat()
    .filter((m): m is TranscriptMessage & { instruction: NonNullable<TranscriptMessage["instruction"]> } => m.id.startsWith(ASK_ID_PREFIX) && !!m.instruction)
    .sort((a, b) => (a.instruction.performedAt ?? 0) - (b.instruction.performedAt ?? 0));
}

export interface CopilotAskOptions {
  setCards: (update: (prev: NavCard[]) => NavCard[]) => void;
  /** The panel a lookup chip opens (so the row reopens the same content), if `text` is one. */
  linkFor: (cardId: string, text: string) => string | undefined;
  /** The result for a question (not a lookup chip) when it's known: a scripted case's own panel (an artifact), or the
   *  registry's. `link`: the row's own link. Unknown (undefined): the AssistProvider answers it (P-LAYOUT-F2 5b). */
  resultFor: (cardId: string, request: { text: string; link: string }) => CopilotResult | undefined;
  /** The provider contact a card's thread is, which the AssistProvider is asked about. */
  interactionIdFor: (cardId: string, threadKey: string) => string | undefined;
  /** Opens a card result that carries an artifact once Copilot "finishes". `link`: the row's own link, so the opened
   *  result marks that row active. */
  openResult: (cardId: string, request: { text: string; time: string; link: string }) => void;
  /** Called on every ask (the page reveals hidden AI action rows). */
  onAsk?: () => void;
  agentName?: string;
}

export function useCopilotAsk({ setCards, linkFor, resultFor, interactionIdFor, openResult, onAsk, agentName = "John Smith" }: CopilotAskOptions) {
  const assist = useAssistProvider();
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  // Asks waiting on the provider's answer: dropped on unmount.
  const subscriptions = useRef(new Set<() => void>());
  useEffect(() => {
    const pending = timers.current;
    const waiting = subscriptions.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
      pending.clear();
      for (const stop of waiting) stop();
      waiting.clear();
    };
  }, []);

  const latest = useRef({ linkFor, resultFor, interactionIdFor, openResult, onAsk });
  useEffect(() => {
    latest.current = { linkFor, resultFor, interactionIdFor, openResult, onAsk };
  });

  return useCallback(
    (cardId: string, threadKey: string, text: string) => {
      const { linkFor: link, onAsk: asked } = latest.current;
      asked?.();
      const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const chipLink = link(cardId, text);
      const id = `${ASK_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const append = (message: TranscriptMessage) =>
        setCards((prev) =>
          prev.map((card) =>
            card.id === cardId
              ? { ...card, liveMessages: { ...card.liveMessages, [threadKey]: [...(card.liveMessages?.[threadKey] ?? []), message] } }
              : card,
          ),
        );
      const later = (run: () => void) => {
        const timer = setTimeout(() => {
          timers.current.delete(timer);
          run();
        }, COPILOT_ASK_RESULT_MS);
        timers.current.add(timer);
      };
      // A free-form question's row is identified by its own id (the trailing segment), not by its text and
      // minute: the same question asked twice is two rows, each opening and marking its own result (P-EXTRACT).
      const ownLink = `instruction:copilot:${encodeURIComponent(text)}:${encodeURIComponent(time)}:${id}`;
      const known = chipLink ? undefined : latest.current.resultFor(cardId, { text, link: ownLink });
      const askedAt = Date.now();
      // Copilot "finishes" no sooner than its usual beat after the ask, nor before the answer is in.
      const finishedAt = () => Math.max(askedAt + AI_PERFORM_MS, Date.now());
      const replace = (message: TranscriptMessage) =>
        setCards((prev) =>
          prev.map((card) =>
            card.id === cardId
              ? { ...card, liveMessages: { ...card.liveMessages, [threadKey]: (card.liveMessages?.[threadKey] ?? []).map((m) => (m.id === id ? message : m)) } }
              : card,
          ),
        );
      /** A plain answer's event line ("performing" until it's finished); with no answer yet, performing until it comes. */
      const line = (result: CopilotResult | undefined): TranscriptMessage => ({
        id,
        sender: "agent",
        name: t("Copilot"),
        initials: "",
        timestamp: time,
        text: result?.summary ?? "",
        event: true,
        eventContext: text,
        eventPoints: result?.points,
        eventPerformedAt: result ? finishedAt() : askedAt + ANSWER_WAIT_MS,
        eventAskedBy: agentName,
      });
      /** Anything more: the instruction row. Lookup chips reopen the exact panel the chip opens; free-form questions
       *  open the instruction/result panel. */
      const row = (): TranscriptMessage => ({
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
        instruction: { title: text, by: agentName, link: chipLink ?? ownLink, performedAt: finishedAt() },
        copilotAsk: true,
      });
      /** Shows the result: a plain answer as a line, anything more as the row (`placed`: in place of the pending line). A
       *  card result opens here only with an artifact (else its row does, on a click). */
      const present = (result: CopilotResult | undefined, placed: boolean) => {
        const message = result && resultPresentation(result) === "line" ? line(result) : row();
        if (placed) replace(message);
        else append(message);
        if (result?.artifact) later(() => latest.current.openResult(cardId, { text, time, link: ownLink }));
      };
      // Not known (a contact with no script): the AssistProvider answers (P-LAYOUT-F2 5b; the sim's placeholder
      // answers). The line goes in at once, "performing" as before, and takes the answer (or becomes the row) when it
      // comes. The answer is kept for this row alone (`rememberCopilotAnswer`, by its link), never under the question:
      // another contact or a kind item asking the same thing gets its own answer.
      if (!chipLink && !known) {
        const interactionId = latest.current.interactionIdFor(cardId, threadKey);
        if (!interactionId) return;
        append(line(undefined));
        const question = redact(text);
        const done = () => {
          stop();
          subscriptions.current.delete(stop);
        };
        const stop = assist.on("card", ({ interactionId: about, card }) => {
          if (about !== interactionId || card.kind !== "answer" || card.question !== question) return;
          done();
          rememberCopilotAnswer(ownLink, card.answer);
          present(card.answer, true);
        });
        subscriptions.current.add(stop);
        assist
          .suggest({ interactionId: interactionId as InteractionId, trigger: { kind: "ask", text: question } })
          .catch((err) => {
            done();
            present({ summary: t("Copilot couldn't answer that just now."), points: [] }, true);
            if (import.meta.env.DEV) console.warn("[copilot] ask failed", err);
          });
        return;
      }
      present(known, false);
    },
    [assist, setCards, agentName],
  );
}

/** How long a line waits on the provider's answer, "performing", before it stops (the answer still fills it in). */
const ANSWER_WAIT_MS = 30_000;
