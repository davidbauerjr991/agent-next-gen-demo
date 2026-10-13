import type {
  Brand,
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
  | { kind: "ask"; text: string };

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

/** A card. Records cards show the actual rows; text cards carry streamed
 *  Tier 2 synthesis; hint cards are the no-match fallback. */
export type AssistCard =
  | (AssistCardBase & { kind: "records"; collection: string; query: CollectionQuery; records: RelatedRecord[] })
  | (AssistCardBase & { kind: "text"; text: string })
  | (AssistCardBase & { kind: "hint"; text: string; collections: string[] });

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
}
