// The AI card kinds (P-LAYOUT-F4 8): one registry that says how each card the AI puts in the conversation reaches the
// agent. "pushed": the AI decided to show it (an approval request, a wrap-up, the Next Best Action, an interstitial for
// what the agent or the AI just did, a save-address offer): it renders inline in the transcript, whatever the AI
// display. "onDemand": the agent asked for it (a Copilot question, a chip's result): under AI display "panel" it is
// the panel's, kept out of the transcript. Static cards (the Real-Time Summary, the handoff snapshot, Customer Info,
// the Journey Summary) are the canvas registry's reference cells, not messages; they're the panel's too.
// Which side a card is on is its kind's `delivery`, never a per-card list.
import type { TranscriptMessage } from "@/components/transcript/transcript-types";

type AiCardDelivery = "pushed" | "onDemand";

export interface AiCardKind {
  id: string;
  delivery: AiCardDelivery;
  matches: (m: TranscriptMessage) => boolean;
}

/** A plain Copilot answer's event line (P-LAYOUT-F1 F: "time · Copilot · the question"). */
export const isCopilotLine = (m: TranscriptMessage) => !!(m.event && m.eventContext);

/** In match order: the first kind that matches a message is its kind. */
const AI_CARD_KINDS: readonly AiCardKind[] = [
  { id: "copilot-line", delivery: "onDemand", matches: isCopilotLine },
  // The row an Ask Copilot question or a chip leaves (`useCopilotAsk`), before the interstitial rows below.
  { id: "copilot-result", delivery: "onDemand", matches: (m) => !!m.instruction && !!m.copilotAsk },
  { id: "interstitial", delivery: "pushed", matches: (m) => !!m.instruction },
  { id: "approval", delivery: "pushed", matches: (m) => !!m.summary },
  { id: "wrap-up", delivery: "pushed", matches: (m) => !!m.wrapUp },
  { id: "save-address", delivery: "pushed", matches: (m) => !!m.saveAddress },
  { id: "nba-outcome", delivery: "pushed", matches: (m) => !!m.nbaOutcome },
  { id: "nba", delivery: "pushed", matches: (m) => !!m.nba },
];

/** The kind of an AI card message, or undefined for the conversation record (bubbles, plain event lines). */
export const aiCardKindOf = (m: TranscriptMessage): AiCardKind | undefined => AI_CARD_KINDS.find((kind) => kind.matches(m));

/** An AI card (any kind): not the conversation record. */
export const isAiActionMessage = (m: TranscriptMessage) => !!aiCardKindOf(m);

/** An AI card of one delivery. */
export const isPushedAiMessage = (m: TranscriptMessage) => aiCardKindOf(m)?.delivery === "pushed";
export const isOnDemandAiMessage = (m: TranscriptMessage) => aiCardKindOf(m)?.delivery === "onDemand";
