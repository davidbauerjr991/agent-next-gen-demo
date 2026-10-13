// App-owned identity primitives. Domain types only — this folder imports
// nothing from components, lyra-ui, React, or any vendor SDK.

/** Nominal string type: an `EntityId` can't be passed where an
 *  `InteractionId` is expected. Construct with a cast (`as EntityId`) at
 *  the adapter edge only. */
export type Brand<T, B extends string> = T & { readonly __brand: B };

/** One channel contact (a call, a chat, an email thread). */
export type InteractionId = Brand<string, "InteractionId">;
/** Groups the Interactions of one customer journey (the left-nav card). */
export type JourneyId = Brand<string, "JourneyId">;
export type MessageId = Brand<string, "MessageId">;
export type UtteranceId = Brand<string, "UtteranceId">;
/** The vertical's primary record — customer, patient, account holder. */
export type EntityId = Brand<string, "EntityId">;
export type RelatedRecordId = Brand<string, "RelatedRecordId">;
export type ContactMethodId = Brand<string, "ContactMethodId">;
export type AgentId = Brand<string, "AgentId">;

/** A record's id in an outside system. `system` names the adapter that owns
 *  it ("cxone", "twilio", "demo-crm", "sim"), so ids from two backends can
 *  coexist without ambiguity. */
export interface ExternalRef {
  system: string;
  id: string;
}

/** Absolute time in milliseconds since the Unix epoch. Sim clock ticks and
 *  display strings are converted at the edge; formatting stays in the UI. */
export type EpochMs = number;
