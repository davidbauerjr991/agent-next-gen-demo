import type { ContactMethodId, EntityId, EpochMs, ExternalRef, RelatedRecordId } from "./ids";

/** Schema-driven field value; field keys come from the active profile. */
export type FieldValue = string | number | boolean | null;

export interface ContactMethod {
  id: ContactMethodId;
  type: "phone" | "email" | "chat-handle" | "whatsapp";
  value: string;
  label?: string;
  primary?: boolean;
}

/** Amount in minor units (cents) to avoid float rounding. */
export interface Money {
  minor: number;
  currency: string;
}

/** The vertical's primary record (customer, patient, account holder). */
export interface Entity {
  id: EntityId;
  externalId?: ExternalRef;
  /** The profile's entity key, e.g. "customer" or "patient". */
  kind: string;
  displayName: string;
  contactMethods: ContactMethod[];
  fields: Record<string, FieldValue>;
  /** Auto-saved when an interaction ended before the agent confirmed the draft. */
  provisional?: boolean;
}

/** One row in a profile collection (payments, orders, claims, tickets).
 *  `status`, `occurredAt`, and `amount` sit outside `fields` because the
 *  generic collection query filters and sorts on them. */
export interface RelatedRecord {
  id: RelatedRecordId;
  externalId?: ExternalRef;
  entityId: EntityId;
  collection: string;
  title?: string;
  /** From the collection's status vocabulary in the profile. */
  status?: string;
  occurredAt?: EpochMs;
  amount?: Money;
  fields: Record<string, FieldValue>;
}
