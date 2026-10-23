import type {
  Brand,
  EpochMs,
  FieldValue,
  InteractionId,
  MessageId,
  RelatedRecord,
  RelatedRecordId,
  UtteranceId,
} from "../domain";
import type { CollectionQuery } from "./customer-data-provider";
import type { EventSource, ProviderLifecycle } from "./events";

/** Identifies one suggest/extract request, for correlation and `cancel`. */
export type AssistRequestId = Brand<string, "AssistRequestId">;

/** What prompted a suggestion. */
export type SuggestTrigger =
  | { kind: "utterance"; sourceId: UtteranceId | MessageId; text: string }
  /** The agent's ask box. */
  | { kind: "ask"; text: string }
  /** The agent asked what to do next (P-CANVAS): the contact's Next Best
   *  Action surfaces at once, or "nothing" when there's none. */
  | { kind: "next-best-action" }
  /** The conversation paused (no customer or agent turn for `idleMs`): the
   *  Next Best Action surfaces if there is one; nothing otherwise. */
  | { kind: "pause"; idleMs: number }
  /** The conversation waits on the agent's turn (the nba card's `awaitingAgent`): it surfaces now. */
  | { kind: "turn" };

/** Asks for AI help on an interaction. The provider gathers conversation
 *  context itself from the interaction id; the UI never builds prompts. */
export interface SuggestRequest {
  interactionId: InteractionId;
  trigger: SuggestTrigger;
}

/** Asks for record fields to be pulled out of one utterance or message. */
export interface ExtractRequest {
  interactionId: InteractionId;
  sourceId: UtteranceId | MessageId;
  text: string;
}

/** Where a card's content came from — shown on every card so stakeholders
 *  see records, not invention. */
export interface AssistProvenance {
  /** 1 = deterministic router over real records; 2 = model synthesis. */
  tier: 1 | 2;
  /** Collections the content was drawn from. */
  collections: string[];
}

/** A button on a card that navigates within the app. */
export interface AssistCardAction {
  id: string;
  label: string;
  target: { kind: "open-collection"; collection: string } | { kind: "open-record"; recordId: RelatedRecordId };
}

interface AssistCardBase {
  /** Stable across streaming updates; cards upsert by this id. */
  id: string;
  /** Restates the interpreted query, e.g. "Last 5 declined payments". */
  title: string;
  /** "pending" before content, "streaming" while text grows, then final. */
  status: "pending" | "streaming" | "complete" | "error";
  provenance: AssistProvenance;
  actions?: AssistCardAction[];
}

/** What a Next Best Action asks of the agent: a line to say, a question to
 *  ask, or something to run. */
export type NextBestActionType = "say" | "ask" | "do";

/** A lesser option offered beside the suggestion ("Also consider"). */
export interface NextBestActionAlternative {
  type: NextBestActionType;
  text: string;
  /** A provider-side action this option starts when used (opaque to the UI). */
  branch?: string;
}

/** One Next Best Action. Say/Ask carry `text` (the suggested words); Do
 *  carries `action` (what running it does). */
export interface NextBestActionSuggestion {
  type: NextBestActionType;
  title: string;
  /** Why it's suggested, shown under the title. */
  why: string;
  text?: string;
  action?: string;
  /** A panel key the agent UI opens when a Do is run (scenario content). */
  link?: string;
  /** A provider-side action using it starts (opaque to the UI). */
  branch?: string;
  alt: NextBestActionAlternative[];
  /** When it was suggested. */
  at: EpochMs;
}

/** A reference card the AI can bring forward (P-CANVAS). */
export type ReferenceCardFocus = "summary" | "journey" | "customer";

/** A card. Records cards show the actual rows; text cards carry streamed
 *  Tier 2 synthesis; hint cards are the no-match fallback; the nba card is
 *  the contact's Next Best Action. It shows a suggestion only once one has
 *  surfaced (`suggest` with a "next-best-action" or "pause" trigger);
 *  otherwise it's "listening" (nothing showing), or "nothing" (nothing to
 *  suggest: the answer to a request, or the contact is over). `stepId`
 *  changes with every new state (a surfaced suggestion, an AI focus), so the
 *  agent UI can tell one step from the next. */
export type AssistCard =
  | (AssistCardBase & { kind: "records"; collection: string; query: CollectionQuery; records: RelatedRecord[] })
  | (AssistCardBase & {
      kind: "text";
      text: string;
      /** "real-time-summary": the contact's one running summary, rewritten as it goes on (streaming while live). */
      purpose?: "real-time-summary";
    })
  | (AssistCardBase & { kind: "hint"; text: string; collections: string[] })
  | (AssistCardBase & {
      kind: "nba";
      stepId: string;
      frame: "listening" | "suggestion" | "nothing";
      suggestion?: NextBestActionSuggestion;
      /** The reference card this step brings forward. */
      focus?: ReferenceCardFocus;
      /** A scripted conversation waits on the agent's turn, which this suggestion (surfaced or about to be)
       *  stands for: it goes on once the agent answers it (`resolveCard`). The agent UI surfaces it after a beat
       *  (`suggest` with a "turn" trigger). */
      awaitingAgent?: true;
    });

/** The agent's answer to a card that asks for one (the nba card). */
export interface AssistCardResolution {
  outcome: "used" | "dismissed";
  /** The alternative used instead of the suggestion (an index into `alt`). */
  alternative?: number;
  /** The agent wrote the turn themselves (inserted the suggestion and sent it): a waiting scripted
   *  conversation goes on without its own line for that turn. */
  agentTyped?: true;
}

/** One value detected for the Draft card. */
export interface ExtractedField {
  /** A profile field key, or "contactMethod.<type>" (e.g. "contactMethod.email"). */
  key: string;
  value: FieldValue;
  /** The utterance or message it came from, shown as the value's source. */
  sourceId: UtteranceId | MessageId;
  /** 0–1, when the extractor reports it. */
  confidence?: number;
}

/** Event payloads, by name. */
export interface AssistEvents {
  /** A card was created or updated — full snapshot, upsert by `card.id`.
   *  Streaming is successive snapshots with growing text. */
  card: { requestId: AssistRequestId; interactionId: InteractionId; card: AssistCard };
  /** Values detected for the Draft card on this interaction. */
  extracted: { requestId: AssistRequestId; interactionId: InteractionId; fields: ExtractedField[] };
}

/**
 * AI assist for the agent. Read-only by design: it has no write methods.
 * Extracted values only fill drafts; saving is the agent's own
 * `CustomerDataProvider.create`/`update` plus
 * `InteractionProvider.associateEntity`. The profile's intent pack is given
 * at construction.
 */
export interface AssistProvider extends EventSource<AssistEvents>, ProviderLifecycle {
  /** Requests suggestions; results arrive as `card` events. */
  suggest(request: SuggestRequest): Promise<AssistRequestId>;
  /** Requests field extraction; results arrive as `extracted` events. */
  extractEntities(request: ExtractRequest): Promise<AssistRequestId>;
  /** Stops a request; its cards end in "complete" or "error". No-op if done. */
  cancel(requestId: AssistRequestId): Promise<void>;
  /** Answers a card that asks for one (the nba card: used or not now). The
   *  next state arrives as a `card` event. Rejects `not-found` when the card
   *  has nothing to answer. */
  resolveCard(cardId: string, resolution: AssistCardResolution): Promise<void>;
}
