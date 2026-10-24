// Customer Information seed data (P-EXTRACT C7): the profile fields, the
// Latest Interaction / Latest Note / Copilot summaries, the panel tab sets,
// and the Customer History pools and builders. All of it is synthesized
// deterministically per customer (`hashSeed` on the record id) — there's no
// real customer backend yet (P1.4).
import { type FilterChipOption, formatPhoneForDisplay } from "@nicecxone/lyra-ui";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { type LucideIcon, Phone, MessageSquare, Mail } from "lucide-react";
import { type Thread } from "@/components/agent-next-gen-interaction-dashboard";
import {
  splitCustomerName,
  hashSeed,
  synthesizePhone,
  formatHistoryTimestamp,
  synthesizeExternalInteractionId,
  synthesizeExternalThreadId,
  synthesizeCallDuration,
} from "@/components/agent-next-gen-shared-utils";
import { type ContactHistoryStatusVariant } from "@/components/agent-next-gen-contact-history";
import { OUTBOUND_AGENTS } from "@/components/agent-next-gen-outbound-data";
import { MARCUS_WEBB_SCRIPT } from "@/scenarios";
import { OUTCOME_TAG_OPTIONS } from "@/components/transcript/transcript-fixtures";
import { type CustomerListRecord, CUSTOMER_LIST_RECORDS } from "@/components/agent-next-gen-customers-table";

/** Marcus Webb's case id (his card's customer record id), from his script. */
const MARCUS_WEBB_CUSTOMER_ID = MARCUS_WEBB_SCRIPT.entity.caseId;

export interface CustomerInfoField {
  label: string;
  value: string;
}

// `CREATE_NEW_CUSTOMERS` (lyra-ui's shared customer fixture, see the import
// above) DOES carry real phone/email/address/city/state/zip/balance fields
// per record now (added for the Customers list view's own columns/filters —
// see that file's own top-of-file comment) — `buildCustomerInfoFields`
// below prefers those when a record matches, per explicit request ("match
// the customer information in the chat to the database information").
// These pools below are the fallback ONLY, for any interaction with no
// matching database record at all (ad-hoc/unknown contacts) — so the
// synthesized profile still reads as plausible varied data (different
// customers land on different cities/streets) rather than everyone getting
// the exact same invented address with only the house number changing.
const CUSTOMER_INFO_STREET_NAMES = [
  "Clinton Heights Ave", "Maple Grove Dr", "Sunset Ridge Ln", "Harbor View Ct",
  "Cedar Hollow Rd", "Birchwood Ter", "Fieldstone Way", "Willow Creek Blvd",
];
const CUSTOMER_INFO_CITY_STATE: { city: string; state: string }[] = [
  { city: "Columbus", state: "OH" },
  { city: "Austin", state: "TX" },
  { city: "Portland", state: "OR" },
  { city: "Raleigh", state: "NC" },
  { city: "Denver", state: "CO" },
  { city: "Tampa", state: "FL" },
  { city: "Madison", state: "WI" },
  { city: "Boise", state: "ID" },
];

/** Builds this panel's field list for whichever customer/interaction is
 *  actually open, instead of one fixed placeholder profile shown for every
 *  interaction. Resolution order, most authoritative first:
 *  1. Real data already on THIS interaction itself — "Phone #"/"Email" read
 *     the real address a voice/email channel was actually opened on
 *     (`Thread.addressLabel`/`value` — see that field's own doc comment)
 *     when one exists, since that's genuine data particular to this
 *     interaction, not invented.
 *  2. This customer's real database record (`CREATE_NEW_CUSTOMERS`, matched
 *     by `customerId` — every real-customer launch path already carries
 *     that same value onto `Interaction.customerId`, which every caller
 *     passes in as `recordId` here) — per explicit request ("match the
 *     customer information in the chat to the database information"),
 *     rather than reinventing independent values that happened to have no
 *     relationship to whatever the Customers list view already shows for
 *     that same person.
 *  3. Deterministically synthesized from `recordId` via `hashSeed` for
 *     anything left with neither of the above (ad-hoc/unknown contacts,
 *     with no database record at all) — at least keeps a given customer's
 *     "invented" details stable across reopens instead of reshuffling every
 *     render. `recordId` itself always becomes "Contact #" regardless of
 *     which tier the rest of the row came from. */
export function buildCustomerInfoFields(
  customerName: string | undefined,
  recordId: string,
  channels: Thread[]
): CustomerInfoField[] {
  const name = customerName ?? "Customer";
  const { firstName, lastName } = splitCustomerName(customerName);
  const seed = hashSeed(recordId || name);

  const voiceChannel = channels.find((c) => c.type === "voice");
  const emailChannel = channels.find((c) => c.type === "email");
  const dbRecord = CREATE_NEW_CUSTOMERS.find((c) => c.customerId === recordId);

  const phone = voiceChannel?.addressLabel ?? voiceChannel?.value ?? dbRecord?.firstPhone ?? synthesizePhone(seed);
  const email =
    emailChannel?.value ??
    dbRecord?.emailAddress ??
    `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`;

  const fallbackCityState = CUSTOMER_INFO_CITY_STATE[seed % CUSTOMER_INFO_CITY_STATE.length];
  const city = dbRecord?.city ?? fallbackCityState.city;
  const state = dbRecord?.state ?? fallbackCityState.state;
  const street = CUSTOMER_INFO_STREET_NAMES[Math.floor(seed / 7) % CUSTOMER_INFO_STREET_NAMES.length];
  const houseNumber = 100 + (seed % 900);
  const address = dbRecord?.address1 ?? `${houseNumber} ${street}`;
  const zipCode = dbRecord?.postalCode ?? String(10000 + (seed % 89999)).padStart(5, "0");
  const balance =
    dbRecord?.paymentBalance ??
    ((seed % 25000) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

  return [
    { label: "Phone #", value: phone },
    { label: "Contact #", value: recordId },
    { label: "Email", value: email },
    { label: "Balance", value: balance },
    { label: "Address", value: address },
    { label: "City", value: city },
    { label: "State", value: state },
    { label: "Zip Code", value: zipCode },
  ];
}

/** Resolves this interaction's own customer database row, if it has one —
 *  same identity space `buildCustomerInfoFields`'s own `dbRecord` lookup
 *  just above already relies on (`recordId` === `Interaction.customerId` ===
 *  `CustomerListRecord.contactNumber`, all sourced from `CREATE_NEW_CUSTOMERS`
 *  — see `CUSTOMER_LIST_RECORDS`'s own doc comment, agent-next-gen-customers-
 *  table.tsx, for that 1:1 mapping).
 *
 *  Per explicit request ("put the customer available channels in the
 *  Customer Overview in the same row as the edit (like in the customer
 *  table in Premium) for all Customer Information panels") —
 *  `CustomerAddChannelButton`'s wide mode (rendered by
 *  `CustomerInformationPanelBody`'s own Customer Overview top row) already
 *  IS that exact available-channels icon row, one button per channel the
 *  customer's own `CustomerListRecord.channels` lists, same component the
 *  Customers table itself renders per row. It was previously only ever fed
 *  a real `row` by the two Customers-table-ORIGINATED consumers
 *  (`CustomerRowInfoPanel`/`CustomerFullScreenTabContent`, which already
 *  carry the clicked row directly) — `CustomerInformationSidePanel` and
 *  `CustomerInfoHoverPreview` never called this at all, so their own top
 *  row only ever showed Edit, with no channel icons next to it, EVEN for a
 *  real customer with real known channels on file. Not a data gap, just a
 *  lookup nobody had wired up yet for those two consumers — this is that
 *  lookup, shared so both derive it the same way `buildCustomerInfoFields`
 *  already does for its own fields.
 *
 *  `null` for an ad-hoc/unknown contact with no matching database record —
 *  `CustomerAddChannelButton` already renders nothing at all for a `null`
 *  row (see that component's own doc comment), so this is a safe default,
 *  not a special case callers need to branch on themselves. */
export function resolveCustomerListRecord(recordId: string): CustomerListRecord | null {
  return CUSTOMER_LIST_RECORDS.find((r) => r.contactNumber === recordId) ?? null;
}

// "Latest Interaction" summary shown on the Overview tab, below the
// contact/billing field list. Same "no real per-customer data source, so
// deterministically synthesize one from the customer's own recordId"
// approach as `buildCustomerInfoFields` above — used to be one fixed
// summary (gendered pronoun and all: "Walked *her* through the upgrade
// flow") shown for every interaction regardless of who was actually open,
// which read just as disconnected as the old fixed contact-fields
// placeholder did. Pools below are written in third person with no
// pronouns at all, since the same pool is shared across every customer.
export interface CustomerLatestInteraction {
  timeAgo: string;
  channel: string;
  status: string;
  /** Reuses `ContactHistoryStatusVariant` (its own `Badge`'s circle-shape
   *  `variant` vocabulary) now that status renders as a small dot + label
   *  instead of a pill `Badge` — see the render site's own doc comment for
   *  why. */
  statusVariant: ContactHistoryStatusVariant;
  summary: string;
  caseId: string;
  handledBy: string;
}

const CUSTOMER_LATEST_INTERACTION_STATUS_POOL: { status: string; variant: ContactHistoryStatusVariant }[] = [
  { status: "Resolved", variant: "success" },
  { status: "Escalated", variant: "critical" },
  { status: "Pending", variant: "warning" },
];

const CUSTOMER_LATEST_INTERACTION_CHANNEL_POOL = ["Email", "Voice", "Chat", "SMS"];

const CUSTOMER_LATEST_INTERACTION_TIME_AGO_POOL = [
  "3 days ago", "9 days ago", "2 weeks ago", "3 weeks ago", "1 month ago", "6 weeks ago",
];

const CUSTOMER_LATEST_INTERACTION_SUMMARY_POOL = [
  "Asked about upgrading to the Pro tier for additional storage. Walked through the upgrade flow and confirmed the new billing amount.",
  "Reported trouble accessing the account after a password reset. Verified identity via KBA and confirmed access was restored.",
  "Requested a copy of the most recent invoice. Located the billing record and sent it over by email.",
  "Called in to update the account's mailing address. Confirmed the new address and applied the change.",
  "Flagged a recent charge that looked unfamiliar. Reviewed the transaction history and clarified the charge.",
  "Wanted to add an additional user seat to the plan. Walked through the add-seat flow and confirmed the updated price.",
];

/** Deterministic per-customer "Latest Interaction" summary — same
 *  `hashSeed`-on-`recordId` approach as `buildCustomerInfoFields`, just
 *  salted with a different suffix so this doesn't land on the exact same
 *  pool indexes that function's own fields happen to hash to for the same
 *  customer. `handledBy` reuses the real `OUTBOUND_AGENTS` roster (the
 *  same agent names already used elsewhere in this app) rather than a
 *  separate invented-name pool. */
export function buildLatestInteraction(customerName: string | undefined, recordId: string): CustomerLatestInteraction {
  const seed = hashSeed(`${recordId || customerName || "customer"}-latest-interaction`);
  const { status, variant } = CUSTOMER_LATEST_INTERACTION_STATUS_POOL[seed % CUSTOMER_LATEST_INTERACTION_STATUS_POOL.length];
  const channel = CUSTOMER_LATEST_INTERACTION_CHANNEL_POOL[Math.floor(seed / 3) % CUSTOMER_LATEST_INTERACTION_CHANNEL_POOL.length];
  const timeAgo = CUSTOMER_LATEST_INTERACTION_TIME_AGO_POOL[Math.floor(seed / 7) % CUSTOMER_LATEST_INTERACTION_TIME_AGO_POOL.length];
  const summary = CUSTOMER_LATEST_INTERACTION_SUMMARY_POOL[Math.floor(seed / 11) % CUSTOMER_LATEST_INTERACTION_SUMMARY_POOL.length];
  const handledByAgent = OUTBOUND_AGENTS[seed % OUTBOUND_AGENTS.length];
  const caseId = `CASE-${40000 + (seed % 9000)}`;

  return {
    timeAgo,
    channel,
    status,
    statusVariant: variant,
    summary,
    caseId,
    handledBy: handledByAgent?.name ?? "Support Team",
  };
}

// "Latest Note" summary shown on the Overview tab, directly below "Latest
// Interaction" — same deterministic-synthesis approach (no real per-
// customer notes data source yet) as `buildLatestInteraction` above, just
// its own pools/salt so a given customer doesn't land on the same pool
// indexes for both cards.
export interface CustomerLatestNote {
  timeAgo: string;
  author: string;
  note: string;
}

const CUSTOMER_LATEST_NOTE_TIME_AGO_POOL = [
  "1 day ago", "4 days ago", "1 week ago", "2 weeks ago", "1 month ago", "2 months ago",
];

const CUSTOMER_LATEST_NOTE_POOL = [
  "Customer prefers email follow-up over phone calls going forward.",
  "Flagged as a long-tenured account — check for loyalty offers before escalating.",
  "Prefers to be addressed by first name; mentioned this during last contact.",
  "Has a pending shipment; hold off on billing-related outreach until it arrives.",
  "Requested callback outside of standard business hours — see availability note on file.",
  "Previously disputed a charge that was resolved in the customer's favor; handle related questions with extra care.",
];

/** Deterministic per-customer "Latest Note" — same `hashSeed`-on-`recordId`
 *  approach as `buildLatestInteraction`, salted with a different suffix so
 *  it doesn't land on the same pool indexes. `author` reuses the real
 *  `OUTBOUND_AGENTS` roster, same as `buildLatestInteraction`'s
 *  `handledBy`. */
export function buildLatestNote(customerName: string | undefined, recordId: string): CustomerLatestNote {
  const seed = hashSeed(`${recordId || customerName || "customer"}-latest-note`);
  const timeAgo = CUSTOMER_LATEST_NOTE_TIME_AGO_POOL[seed % CUSTOMER_LATEST_NOTE_TIME_AGO_POOL.length];
  const note = CUSTOMER_LATEST_NOTE_POOL[Math.floor(seed / 3) % CUSTOMER_LATEST_NOTE_POOL.length];
  const author = OUTBOUND_AGENTS[Math.floor(seed / 7) % OUTBOUND_AGENTS.length];

  return {
    timeAgo,
    author: author?.name ?? "Support Team",
    note,
  };
}

// "Copilot" tab content — a short AI-generated-style briefing on WHY this
// customer is reaching out (`reasonForContact`, shown in a plain info box)
// plus a "Journey Summary" card recapping what's led up to this contact
// (`journeySummary`) — see `CopilotTabContent`'s own doc comment for the
// actual rendering. Same deterministic-synthesis approach as
// `buildLatestInteraction`/`buildLatestNote` (no real conversational-AI
// backend here yet) — one POOL of paired {reason, journey} strings (not two
// independently-hashed pools) so the two boxes always tell one coherent
// story instead of a "wants to update mailing address" reason sitting next
// to an unrelated "received a OneTread x1000" journey.
export interface CopilotSummary {
  reasonForContact: string;
  journeySummary: string;
}

const COPILOT_SUMMARY_POOL: Array<{ reason: string; journey: string }> = [
  {
    reason: "would like to file a claim under their bike's warranty and needs assistance.",
    journey:
      "received their OneTread x1000 on 1/25/25 and had no issues until the tablet began freezing and showing a blinking red light.",
  },
  {
    reason: "noticed an unfamiliar charge on their latest invoice and wants it explained.",
    journey: "has been on the Plus plan since 3/12/24 with no billing issues until this month's statement.",
  },
  {
    reason: "wants to cancel an upcoming subscription renewal before it charges.",
    journey:
      "signed up for a 12-month plan on 6/1/25 and has used the service steadily since, with the renewal now two weeks away.",
  },
  {
    reason: "is having trouble logging in after a recent password reset.",
    journey:
      "reset their account password on 7/2/25 after a prompted security update, and hasn't been able to sign back in since.",
  },
  {
    reason: "would like to reschedule an upcoming service appointment.",
    journey: "booked the original appointment on 5/14/25 and has had no other open requests since.",
  },
  {
    reason: "wants to return a recent order that arrived damaged.",
    journey: "placed the order on 7/28/25 and reported the damage the same day it arrived.",
  },
];

/** Deterministic per-customer Copilot summary — same `hashSeed`-on-`recordId`
 *  approach as `buildLatestInteraction`/`buildLatestNote`, salted with its
 *  own suffix so it doesn't land on the same pool indexes either of those
 *  hash to for the same customer.
 *
 *  Marcus Webb is special-cased ahead of the hash, per explicit request: his
 *  scripted scenario is a password-reset chat, but his `recordId` happened
 *  to hash into the shared `COPILOT_SUMMARY_POOL`'s "reschedule an upcoming
 *  service appointment" entry, which doesn't match what he's actually
 *  messaging in about. Hand-authored
 *  instead of a new pool entry, since a pool entry is shared by whichever
 *  OTHER customer happens to hash to the same index — Marcus's wording needs
 *  to stay pinned to him alone.
 *
 *  Checks `MARCUS_WEBB_CUSTOMER_ID` ("MW-DEMO-0001"), NOT `MARCUS_WEBB_ID`
 *  ("marcus-webb-scenario") — an earlier version of this check compared
 *  against `MARCUS_WEBB_ID`, which never matched (per explicit follow-up
 *  report, "this hasn't been updated") because every call site here passes
 *  `activeInteraction.customerId` as `recordId`, and the Marcus scenario
 *  card sets that field to
 *  `MARCUS_WEBB_CUSTOMER_ID`, not `MARCUS_WEBB_ID` — `MARCUS_WEBB_ID` is only
 *  ever the `Interaction.id`/left-nav key, never the customer identity. */
export function buildCopilotSummary(customerName: string | undefined, recordId: string): CopilotSummary {
  if (recordId === MARCUS_WEBB_CUSTOMER_ID) {
    return {
      reasonForContact: "Marcus Webb would like help resetting his password.",
      journeySummary:
        "Marcus created his account 5/14/25 and has accessed it 12 times since then. He has had no open or closed requests for password assistance.",
    };
  }
  const seed = hashSeed(`${recordId || customerName || "customer"}-copilot-summary`);
  const { reason, journey } = COPILOT_SUMMARY_POOL[seed % COPILOT_SUMMARY_POOL.length];
  const displayName = customerName ?? "The customer";
  return {
    reasonForContact: `${displayName} ${reason}`,
    journeySummary: `${displayName} ${journey}`,
  };
}

// Placeholder tab set (per reference screenshot). "Copilot" is still
// listed FIRST here for history's sake (its display-order journey: added,
// reordered to the front, briefly hidden entirely, re-enabled, made
// conditionally available), but per the latest explicit request ("stop
// launching copilot - hide it completely") it is now unconditionally
// excluded from `visibleTabs` everywhere (`CustomerInformationSidePanel`/
// `CustomerInfoHoverPreview`/`CustomerRowInfoPanel`/`AllContactsProfileView`
// — see each one's own `visibleTabs` doc comment), full stop, regardless
// of its position in this array or `copilotAvailable`-style gating (which
// no longer exists) — this array's own order no longer matters for it at
// all. `buildCopilotSummary`'s underlying recap text didn't go away,
// though — see `ContactOverview`'s `journeySummary` prop for its new home.
//
// "Contacts" (this customer's own session history — was a separate,
// independently-selectable "Customer History" tab in the record header,
// alongside the channel tabs — see `CustomerHistoryTabContent`'s own doc
// comment) moved in here per explicit request, so it's now just another
// tab of this same panel like Detail/Directory/etc., not a separate
// top-level control. Labeled "Interactions" at first, then renamed to
// "Contacts" per a later explicit follow-up request (the underlying value
// in the array below, and every literal comparison against it, changed
// together — this tab has no separate internal key distinct from its
// display label the way the Search panel's own "interactions" sub-tab
// does).
export const CUSTOMER_PANEL_TABS = ["Copilot", "Overview", "Contacts", "Detail", "Directory", "Tasks", "Notes", "Accounts", "Tickets"] as const;
export type CustomerPanelTabLabel = (typeof CUSTOMER_PANEL_TABS)[number];

// Agent Workspace 2.0's own reduced Customer Information tab set — per
// explicit request, Contacts/Directory/Tasks/Accounts/Tickets are
// hidden there (Contacts duplicates the Search panel's own real Contacts
// tab in that app; Directory/Tasks/Accounts/Tickets have no
// real content behind them, same "not ready to show yet" reasoning other
// stubbed surfaces in this app already follow). "Copilot" is still listed
// here too, same as `CUSTOMER_PANEL_TABS` above — it's unconditionally
// excluded from `visibleTabs` regardless of whether a given consumer's own
// `tabs` prop happens to include it. Agent Workspace 2.0 With Desk is
// unaffected — its own call sites pass the full `CUSTOMER_PANEL_TABS` list
// unchanged.
export const AGENT_WORKSPACE_CUSTOMER_PANEL_TABS: CustomerPanelTabLabel[] = ["Overview", "Copilot", "Detail", "Notes"];

// Temporarily hides the Overview tab's "Ask about this customer..."
// `AIInput` footer, AND (per a later explicit follow-up — "hide the ask
// anything input in copilot for now") the Copilot tab's own singleLine
// `AIInput` footer, during an active interaction. Flip back to `true` to
// restore both. Gates both the real panel's own `footer`
// (`CustomerInformationSidePanel`) and the hover-preview's content-parity
// copy of the same footer (`CustomerInfoHoverPreview`), so the two stay in
// sync rather than one showing an input the other doesn't. Originally
// Copilot's own `AIInput` was deliberately left UNgated here (see this
// file's git history/BEHAVIOR.md §83-era comments) as "a distinct,
// always-on feature" — reversed by the same follow-up request that added
// this sentence.
export const SHOW_CUSTOMER_INFO_AI_INPUT = false;

/** Shared neutral bordered-container treatment for every collapsible
 *  `Accordion` in the Customer Information panel (Overview tab's "Customer
 *  Overview"/"Latest Interaction", Detail tab's "General"/"Address",
 *  Directory tab's per-phone-slot rows) — one constant instead of each tab
 *  re-typing the same class string, so the four surfaces can't quietly
 *  drift apart. Callers that need an additional class alongside it (the
 *  Overview tab's `.lyra-card-split-even`) compose it with `cn(...)` rather
 *  than duplicating this string with an extra class appended. */
export const CUSTOMER_INFO_ACCORDION_CLASSNAME = "rounded-lyra-md border border-lyra-border-subtle bg-lyra-bg-control-subtle overflow-hidden h-fit";

/** Looks up one of `buildCustomerInfoFields`'s rows by label — lets the
 *  Detail tab below reuse the exact same Contact #/Balance/Address/City/
 *  State/Zip values the Overview tab already shows for this customer,
 *  instead of a second, independently-synthesized set that could disagree
 *  with it (e.g. a different "invented" balance on each tab for the same
 *  customer). */
export function getFieldValue(fields: CustomerInfoField[], label: string): string {
  return fields.find((f) => f.label === label)?.value ?? "";
}

/* ── Customer History tab ──
   Per a reference screenshot: a scrollable list of this customer's past
   sessions (one card per past voice/SMS/email contact — target, direction +
   channel, handling agent, timestamp, and an optional status like
   "Disconnected"), and clicking a card opens a right-docked `InteriorPanel`
   with that session's own detail fields (Start Date, Agent/Target, Type,
   Call Center, Customer, External Interaction ID, External Thread ID) plus
   a "Conversation Details" summary below them — same "click a row, open a
   right InteriorPanel with details, chevron through the list" shape
   `CustomerRowInfoPanel` already uses for the Customers table (see that
   component's own doc comment), just scoped to one customer's own history
   instead of the whole Customers table.

   No real backend/session log exists for this prototype, so
   `buildCustomerHistoryEntries` below deterministically synthesizes a
   plausible list per customer — same `hashSeed`-on-`recordId` approach
   `buildLatestInteraction`/`buildLatestNote` already use, salted per entry
   index so a given customer always sees the same history across reopens
   instead of it reshuffling every render. Target phone/email reuse the
   exact same values `buildCustomerInfoFields` already synthesizes for the
   Overview tab (via `getFieldValue` above) rather than a second,
   independently-invented address that could disagree with it. */

export type CustomerHistoryDirection = "inbound" | "outbound";
export type CustomerHistoryChannelType = "voice" | "sms" | "email";

export interface CustomerHistorySessionEntry {
  id: string;
  direction: CustomerHistoryDirection;
  channelType: CustomerHistoryChannelType;
  /** e.g. "Outbound call" / "Inbound SMS" / "Outbound email" — precomputed
   *  so the card and the detail panel's own "Type" field always agree on
   *  the exact same string. */
  typeLabel: string;
  target: string;
  agentName: string;
  agentEmail: string;
  timestamp: Date;
  /** "MM/DD/YYYY h:mm:ss AM/PM" — shared by the card's own timestamp and
   *  the detail panel's "Start Date" field (see `formatHistoryTimestamp`). */
  timestampDisplay: string;
  /** Only ever set for `channelType === "voice"` (see the reference
   *  screenshots — SMS/email rows never carry one); undefined most of the
   *  time even for voice, same "not every field is always present" shape
   *  `Thread.addressLabel` etc. already have elsewhere. */
  statusLabel?: string;
  callCenter: string;
  customerUsername: string;
  externalInteractionId: string;
  externalThreadId: string;
  conversationSummary: string;
  /** Only set for `channelType === "sms"` — the actual reconstructed
   *  message thread shown on the detail panel's "Conversation" tab (see
   *  `CustomerHistoryConversationContent`). Voice/email have no message
   *  thread of their own; they use `callDurationDisplay`/`emailSubject`
   *  below instead. */
  conversationMessages?: CustomerHistoryConversationMessage[];
  /** Only set for `channelType === "voice"` — "m:ss", shown on the
   *  Conversation tab's call-notes card. */
  callDurationDisplay?: string;
  /** Only set for `channelType === "email"` — shown above
   *  `conversationSummary` (reused as the email body) on the Conversation
   *  tab. */
  emailSubject?: string;
  /** 1-2 labels drawn from `OUTCOME_TAG_OPTIONS` (the same vocabulary the
   *  live-interaction Outcome tagging popover uses elsewhere in this file)
   *  — reused rather than inventing a second tag vocabulary, and it's what
   *  the history toolbar's own "Tags" filter checklist is built from (see
   *  `CUSTOMER_HISTORY_TAG_FILTER_OPTIONS`). Not rendered anywhere on the
   *  card itself (the reference screenshots never show tags on a history
   *  row) — purely a filterable attribute here. */
  tags: string[];
}

export interface CustomerHistoryConversationMessage {
  sender: "customer" | "agent";
  text: string;
  timestampDisplay: string;
}

const CUSTOMER_HISTORY_DIRECTION_LABEL: Record<CustomerHistoryDirection, string> = {
  inbound: "Inbound",
  outbound: "Outbound",
};

// Lowercase per the reference screenshots ("Outbound call", "Outbound
// email") except the SMS acronym, which stays upper — see `typeLabel`.
const CUSTOMER_HISTORY_CHANNEL_LOWER_LABEL: Record<CustomerHistoryChannelType, string> = {
  voice: "call",
  sms: "SMS",
  email: "email",
};

export const CUSTOMER_HISTORY_CHANNEL_ICON: Record<CustomerHistoryChannelType, LucideIcon> = {
  voice: Phone,
  sms: MessageSquare,
  email: Mail,
};

// Purple/green/pink per the reference screenshots — a different trio from
// `CONTACT_HISTORY_CHANNEL_TAG_VARIANT`'s purple/teal/pink (that one only
// has `TagVariant`'s 9 fixed categorical values to work with, and settled
// on teal for chat/SMS; this is plain `text-*` on a bare icon, not a `Tag`,
// so it isn't limited to that vocabulary and can use green directly).
export const CUSTOMER_HISTORY_CHANNEL_COLOR_CLASS: Record<CustomerHistoryChannelType, string> = {
  voice: "text-lyra-accent-purple-strong",
  sms: "text-lyra-accent-green-strong",
  email: "text-lyra-accent-pink-strong",
};

const CUSTOMER_HISTORY_CALL_CENTER_POOL = [
  "Testing Call Center", "Main Call Center", "East Region Call Center", "Overflow Call Center",
];

// Only `voice` entries ever roll against this — `undefined` (no status
// shown) is deliberately in the pool twice, so most calls show nothing at
// all, same as most rows in the reference screenshots.
const CUSTOMER_HISTORY_VOICE_STATUS_POOL: (string | undefined)[] = [
  "Disconnected", "Disconnected", undefined, undefined, "dialing",
];

// SMS thread content (Conversation tab, `channelType === "sms"`) — a short
// alternating customer/agent exchange. Indexed independently by sender so a
// synthesized thread doesn't accidentally pair an agent line that doesn't
// answer the customer line right before it; realism isn't the bar here (no
// real transcript data exists to reproduce), just a plausible-looking
// back-and-forth.
const CUSTOMER_HISTORY_SMS_CUSTOMER_MESSAGE_POOL = [
  "Hi, I had a question about my last bill.",
  "Can you check if my address on file is up to date?",
  "I don't think I received the confirmation text yet.",
  "Thanks, that answers my question!",
  "Is there a fee for that?",
  "Sorry, one more thing — when does that take effect?",
];
const CUSTOMER_HISTORY_SMS_AGENT_MESSAGE_POOL = [
  "Sure, let me pull that up for you.",
  "I can see that on your account now.",
  "You're all set — that's been updated.",
  "No problem, happy to help!",
  "That fee was waived for your account.",
  "It'll take effect on your next billing cycle.",
];

// Email content (Conversation tab, `channelType === "email"`) — `subject`
// only; the body reuses `conversationSummary` (already a customer-facing
// paragraph, no need for a second, near-duplicate pool).
const CUSTOMER_HISTORY_EMAIL_SUBJECT_POOL = [
  "Following up on your account",
  "Your recent request",
  "Question about your invoice",
  "Update to your account details",
  "Re: your last message",
];

/** Builds the "sms" conversation thread for one history entry — 3 to 5
 *  messages, alternating strictly by sender, starting with whichever side
 *  actually initiated the session (`direction`): an outbound session opens
 *  with the agent reaching out, an inbound one opens with the customer.
 *  Timestamps step forward a minute or two per message from the session's
 *  own start time, so they read in order without ever running past it. */
function buildCustomerHistorySmsMessages(
  seed: number,
  direction: CustomerHistoryDirection,
  sessionStart: Date
): CustomerHistoryConversationMessage[] {
  const messageCount = 3 + (seed % 3);
  const startsWithAgent = direction === "outbound";
  const messages: CustomerHistoryConversationMessage[] = [];
  let cursor = new Date(sessionStart);

  for (let i = 0; i < messageCount; i++) {
    const isAgentTurn = startsWithAgent ? i % 2 === 0 : i % 2 === 1;
    const pool = isAgentTurn ? CUSTOMER_HISTORY_SMS_AGENT_MESSAGE_POOL : CUSTOMER_HISTORY_SMS_CUSTOMER_MESSAGE_POOL;
    const text = pool[(seed + i * 5) % pool.length];
    cursor = new Date(cursor.getTime() + (60 + ((seed + i) % 90)) * 1000);
    messages.push({
      sender: isAgentTurn ? "agent" : "customer",
      text,
      timestampDisplay: formatHistoryTimestamp(cursor),
    });
  }

  return messages;
}

const CUSTOMER_HISTORY_ENTRY_COUNT = 8;

/** Deterministically synthesizes this customer's session history — see this
 *  section's own doc comment above for why (no real session log exists).
 *  Ordered most-recent-first: entry `0` is the most recent, walking
 *  backward in time from "now" by a pseudo-random (but seed-stable) number
 *  of hours per step. */
export function buildCustomerHistoryEntries(
  customerName: string | undefined,
  recordId: string,
  channels: Thread[]
): CustomerHistorySessionEntry[] {
  const fields = buildCustomerInfoFields(customerName, recordId, channels);
  // `formatPhoneForDisplay` here (not left raw) — this app's own synthesized
  // "Phone #" value is stored/round-tripped as "+1 XXX XXX XXXX" (see
  // `phoneDisplayFromValue`'s own doc comment), not the "(xxx) xxx-xxxx"
  // display format every History row below should actually show.
  const phone = formatPhoneForDisplay(getFieldValue(fields, "Phone #"));
  const email = getFieldValue(fields, "Email");
  const { firstName, lastName } = splitCustomerName(customerName);

  const entries: CustomerHistorySessionEntry[] = [];
  let cursor = new Date();

  for (let i = 0; i < CUSTOMER_HISTORY_ENTRY_COUNT; i++) {
    const seed = hashSeed(`${recordId || customerName || "customer"}-history-${i}`);

    // Step backward before creating this entry, so entry 0 isn't literally
    // "right now" — a couple hours to just under two days between sessions.
    cursor = new Date(cursor.getTime() - (2 + (seed % 46)) * 60 * 60 * 1000);

    const direction: CustomerHistoryDirection = seed % 10 < 7 ? "outbound" : "inbound";
    const channelPool: CustomerHistoryChannelType[] = ["voice", "voice", "sms", "email"];
    const channelType = channelPool[Math.floor(seed / 7) % channelPool.length];

    const agent = OUTBOUND_AGENTS[Math.floor(seed / 11) % OUTBOUND_AGENTS.length];
    const agentName = agent?.name ?? "Support Team";
    const { firstName: agentFirst, lastName: agentLast } = splitCustomerName(agentName);
    const agentEmail = `${agentFirst.toLowerCase()}.${agentLast.toLowerCase()}@cxisme.com`;

    entries.push({
      id: `${recordId || customerName || "customer"}-history-${i}`,
      direction,
      channelType,
      typeLabel: `${CUSTOMER_HISTORY_DIRECTION_LABEL[direction]} ${CUSTOMER_HISTORY_CHANNEL_LOWER_LABEL[channelType]}`,
      target: channelType === "email" ? email : phone,
      agentName,
      agentEmail,
      timestamp: cursor,
      timestampDisplay: formatHistoryTimestamp(cursor),
      statusLabel:
        channelType === "voice"
          ? CUSTOMER_HISTORY_VOICE_STATUS_POOL[Math.floor(seed / 13) % CUSTOMER_HISTORY_VOICE_STATUS_POOL.length]
          : undefined,
      callCenter: CUSTOMER_HISTORY_CALL_CENTER_POOL[Math.floor(seed / 17) % CUSTOMER_HISTORY_CALL_CENTER_POOL.length],
      customerUsername: `${firstName.charAt(0).toLowerCase()}${lastName}${10 + (seed % 90)}`,
      externalInteractionId: synthesizeExternalInteractionId(seed),
      externalThreadId: synthesizeExternalThreadId(seed),
      conversationSummary:
        CUSTOMER_LATEST_INTERACTION_SUMMARY_POOL[Math.floor(seed / 19) % CUSTOMER_LATEST_INTERACTION_SUMMARY_POOL.length],
      conversationMessages: channelType === "sms" ? buildCustomerHistorySmsMessages(seed, direction, cursor) : undefined,
      callDurationDisplay: channelType === "voice" ? synthesizeCallDuration(seed) : undefined,
      emailSubject:
        channelType === "email"
          ? CUSTOMER_HISTORY_EMAIL_SUBJECT_POOL[Math.floor(seed / 23) % CUSTOMER_HISTORY_EMAIL_SUBJECT_POOL.length]
          : undefined,
      // 1-2 tags per entry, drawn from the same `OUTCOME_TAG_OPTIONS`
      // vocabulary the live Outcome popover uses — see the field's own doc
      // comment on `CustomerHistorySessionEntry` above for why.
      tags:
        seed % 5 < 3
          ? [OUTCOME_TAG_OPTIONS[Math.floor(seed / 29) % OUTCOME_TAG_OPTIONS.length].label]
          : [
              OUTCOME_TAG_OPTIONS[Math.floor(seed / 29) % OUTCOME_TAG_OPTIONS.length].label,
              OUTCOME_TAG_OPTIONS[Math.floor(seed / 31) % OUTCOME_TAG_OPTIONS.length].label,
            ].filter((label, idx, arr) => arr.indexOf(label) === idx),
    });
  }

  return entries;
}

// Static checklist options for the history toolbar's "Channel type" and
// "Direction" filters — unlike `CUSTOMER_FILTER_FIELD_DEFS`'s "+ Filter"
// add-menu system (12 optional fields, none active by default), this list
// only ever has these 3 facets plus the date range below, so all 3 are
// always shown in the toolbar rather than gated behind an add-filter step.
export const CUSTOMER_HISTORY_CHANNEL_TYPE_FILTER_OPTIONS: FilterChipOption[] = [
  { value: "voice", label: "Voice" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
];
export const CUSTOMER_HISTORY_DIRECTION_FILTER_OPTIONS: FilterChipOption[] = [
  { value: "inbound", label: "Inbound" },
  { value: "outbound", label: "Outbound" },
];
// Built from `OUTCOME_TAG_OPTIONS` (declared well above this section) so the
// filter's checklist always matches whatever `tags` actually get synthesized
// onto each entry, without a second hand-maintained label list to drift out
// of sync with it.
export const CUSTOMER_HISTORY_TAG_FILTER_OPTIONS: FilterChipOption[] = OUTCOME_TAG_OPTIONS.map((t) => ({
  value: t.label,
  label: t.label,
}));

// `DateRangeFilterChip`'s own default `options` (`DATE_RANGE_FILTER_OPTIONS`)
// stops at "Last 7 days" + "Custom" — too narrow here, since synthesized
// entries can land up to ~16 days back (see `buildCustomerHistoryEntries`'s
// per-step "2 to 47 hours" walk × 8 entries). Adds "Last 30/90 days" (already
// supported by `DateRangeFilterValue`, just not in the default option list)
// so the toolbar's default selection doesn't start out hiding most of a
// customer's real history.
export const CUSTOMER_HISTORY_DATE_RANGE_OPTIONS = [
  { value: "today" as const, label: "Today" },
  { value: "yesterday" as const, label: "Yesterday" },
  { value: "last7" as const, label: "Last 7 days" },
  { value: "last30" as const, label: "Last 30 days" },
  { value: "last90" as const, label: "Last 90 days" },
  { value: "custom" as const, label: "Custom" },
];
