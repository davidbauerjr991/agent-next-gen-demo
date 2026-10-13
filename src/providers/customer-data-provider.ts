import type {
  ContactMethod,
  Entity,
  EntityId,
  EpochMs,
  FieldValue,
  Interaction,
  Money,
  RelatedRecord,
} from "../domain";
import type { EventSource, ProviderLifecycle } from "./events";

/** One page of results plus the total across all pages. */
export interface Page<T> {
  items: T[];
  total: number;
}

/** Customer search (customers table, New Outbound search). */
export interface EntitySearch {
  /** Free text matched against name, phone, and email. */
  text?: string;
  /** Exact contact-method lookup, e.g. a caller's ANI. */
  contactMethod?: { type: ContactMethod["type"]; value: string };
  offset?: number;
  limit?: number;
}

/** A record that doesn't exist yet (the Draft card). Field keys come from the
 *  active profile's schema. */
export interface EntityDraft {
  /** The profile's entity key, e.g. "customer" or "patient". */
  kind: string;
  displayName?: string;
  contactMethods?: Omit<ContactMethod, "id">[];
  fields?: Record<string, FieldValue>;
}

/** Changes to an existing record. `fields` is merged, not replaced. */
export type EntityPatch = Partial<Pick<Entity, "displayName" | "fields" | "provisional">>;

/** An existing record that may be the same person as a draft. */
export interface NearMatch {
  entity: Entity;
  /** Similarity, 0–1. */
  score: number;
  /** Which values matched (e.g. "phone", "displayName"), so the UI can say
   *  why it offers "Link to <existing>?". */
  matchedOn: string[];
}

/** The generic query behind every collection lookup — "last 5 declined
 *  payments" and "last 3 denied claims" are the same query. */
export interface CollectionQuery {
  entityId: EntityId;
  /** One status or any of several, from the collection's vocabulary. */
  status?: string | string[];
  limit?: number;
  sort?: "newest" | "oldest" | "amount-desc" | "amount-asc";
  /** Inclusive bounds on `occurredAt`. */
  since?: EpochMs;
  until?: EpochMs;
  minAmount?: Money;
}

/** Records returned for a collection query. */
export interface CollectionResult {
  /** The collection queried — shown in AI cards' provenance line. */
  collection: string;
  records: RelatedRecord[];
  /** Matching records before `limit`. */
  total: number;
}

/** Event payloads, by name. */
export interface CustomerDataEvents {
  /** A record was created or changed (by anyone). Full snapshot. */
  entityChanged: { entity: Entity };
  /** Records in a collection were added or changed; re-query to refresh. */
  collectionChanged: { entityId: EntityId; collection: string };
}

/**
 * The active database: customer records, their related collections, and
 * contact history. The database handle and profile are given at
 * construction. Profile-named shortcuts ("getPayments") aren't part of the
 * contract — they're helpers built over `getCollection` from the profile.
 * Mutators return the result to the caller AND emit an event, so every other
 * panel updates live.
 */
export interface CustomerDataProvider extends EventSource<CustomerDataEvents>, ProviderLifecycle {
  /** One record, or `undefined` if it doesn't exist. */
  getEntity(id: EntityId): Promise<Entity | undefined>;
  /** Searches records by text or exact contact method. */
  search(query: EntitySearch): Promise<Page<Entity>>;
  /** Existing records that may match a draft, best first — checked before
   *  saving so the agent can link instead of duplicating. */
  findNearMatches(draft: EntityDraft): Promise<NearMatch[]>;
  /** Creates a record. Only on an explicit agent action — never from AI on
   *  its own. Emits `entityChanged`. */
  create(draft: EntityDraft): Promise<Entity>;
  /** Updates a record. Emits `entityChanged`. */
  update(id: EntityId, patch: EntityPatch): Promise<Entity>;
  /** Adds a phone/email/handle to a record (e.g. the unknown caller's ANI).
   *  Emits `entityChanged`. */
  linkContactMethod(id: EntityId, method: Omit<ContactMethod, "id">): Promise<Entity>;
  /** Queries one of the record's related collections by name. */
  getCollection(name: string, query: CollectionQuery): Promise<CollectionResult>;
  /** Past interactions with this record (Contact History), newest first. */
  getContactHistory(id: EntityId, query?: { since?: EpochMs; limit?: number }): Promise<Page<Interaction>>;
}
