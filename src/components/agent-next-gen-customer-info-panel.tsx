// Customer Information panel — profile block, tabs (Copilot/Customer
// History/Detail/Directory/Contacts), hover preview, docked side panel,
// and the pinned row panel — see agent-next-gen-shared-utils.ts and sibling
// agent-next-gen-*.ts(x) files for everything AgentNextGenPage.tsx itself no
// longer declares — split out once that file crossed Babel's 500KB
// code-generator threshold.
import { useState, useMemo, useEffect, useRef, useLayoutEffect } from "react";
import {
  type FilterChipOption,
  type DateRangeFilterValue,
  type DateRange,
  TableToolbar,
  DateRangeFilterChip,
  Label,
  Button,
  TabList,
  Tab,
  Accordion,
  type SelectOption,
  Input,
  Checkbox,
  Select,
  DatePicker,
  type PhoneValue,
  PhoneInput,
  RadioGroup,
  RadioGroupItem,
  EmailInput,
  ActionIconButton,
  Separator,
  Badge,
  PanelHeader,
  PanelContent,
  PanelFooter,
  AIInput,
  SidePanel,
  PanelPinButton,
  type CreateNewOutboundContact,
  type ChannelType,
  type MenuEntry,
  KebabMenuButton,
  type ToastItem,
  SearchInput,
  ChatMessage,
  InteriorPanel,
  formatPhoneForDisplay,
  CustomerContextOverview,
  type CustomerContextOverviewInfo,
  Tooltip,
} from "@nicecxone/lyra-ui";
import { CREATE_NEW_CUSTOMERS, type CreateNewCustomerRecord } from "@nicecxone/lyra-ui/customers-data";
import { type Thread } from "@/components/agent-next-gen-interaction-dashboard";
import {
  splitCustomerName,
  hashSeed,
  synthesizePhone,
  formatHistoryTimestamp,
  synthesizeExternalInteractionId,
  synthesizeExternalThreadId,
  synthesizeCallDuration,
  isWithinCustomerHistoryDateRange,
  phoneValueFromDisplay,
  phoneDisplayFromValue,
  initialsFor,
  formatRealTimeSummaryUpdatedLabel,
} from "@/components/agent-next-gen-shared-utils";
import { ClockValue } from "@/components/agent-next-gen-clock-tick";
import { type ContactHistoryStatusVariant } from "@/components/agent-next-gen-contact-history";
import { OUTBOUND_AGENTS } from "@/components/agent-next-gen-outbound-data";
import { MARCUS_WEBB_CUSTOMER_ID } from "@/components/agent-next-gen-marcus-webb-scenario";
import {
  OUTCOME_TAG_OPTIONS,
  type Contact,
  TranscriptSessionDetails,
} from "@/components/agent-next-gen-transcript";
import { type CustomerListRecord, CUSTOMER_LIST_RECORDS, CustomerAddChannelButton } from "@/components/agent-next-gen-customers-table";
import { cn } from "@/lib/utils";
import {
  type LucideIcon,
  Phone,
  MessageSquare,
  Mail,
  ArrowUp,
  ArrowDown,
  Inbox,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Clock,
  FileText,
  Minimize2,
  Maximize2,
  SquareArrowOutUpRight,
  PanelRightClose,
  RefreshCw,
  Trash2,
  MoreVertical,
  Pencil,
  ArrowLeft,
  X,
  UserRound,
  Paperclip,
} from "lucide-react";

/* ── InteractionTranscript ──
   The conversation-transcript body for an active interaction's detail page,
   shown below the page header — whose own `titleSuffix` slot holds the
   `ChannelToggle` row now, not a separate row beneath it (replaces the
   empty placeholder div that used to sit there — see the `activeInteraction`
   branch above). Shows
   one fixed mock conversation (Liam Davis ↔ John Smith) split across two
   fixed mock sessions (`TRANSCRIPT_SESSIONS`) for every active interaction
   rather than a real per-interaction transcript — this is a UI prototype of
   the transcript layout itself, not a case-data integration.

   Only shown as-is for SMS/WhatsApp (a chat-shaped channel) — `channelType`
   picks which content renders, matching the record header's own active
   `ChannelToggle` pill: Voice and Email are placeholders ("Coming Soon
   {Voice,Email} Content") rather than the same chat transcript, since a
   voice call's or an email thread's own content genuinely doesn't look like
   a chat log and hasn't been designed yet — showing the SMS mock underneath
   either would misrepresent it as done. `customerName` swaps in for every
   customer-sender message's hardcoded mock name/initials ("Liam Davis"/
   "LD") in the SMS/WhatsApp branch, so the transcript at least reads as
   this interaction's actual customer rather than always the same fixed
   mock person; falls back to "Liam Davis" when unset (e.g. no active
   interaction) so this still renders sensibly in isolation.

   Broken into sessions (each a `# <case id> · <date>` separator — see
   `TranscriptSessionSeparator` — followed by that session's own messages)
   rather than one flat message list, per explicit request: a single
   interaction can span more than one contact record (a follow-up thread
   days later, a callback), and each one needs its own separator that
   expands in place to a "Session Details" summary (`Contact
   Details`) without disturbing the others. Each separator is `sticky
   top-0`, so scrolling through a session keeps its separator pinned at the
   top until the next session's own separator reaches the top and takes
   over — plain CSS sticky-header stacking, no scroll listener — see that
   component's own doc comment for why source order alone is enough to get
   this behavior.

   Deliberately hand-built instead of composed from lyra-ui's
   `ConversationMessage`: that component's "agent" variant doesn't produce
   the white-bordered customer bubble the reference screenshot shows (no
   variant maps to that background), and its avatar sits beside the bubble
   rather than below it next to the tag row — both would require changing
   `ConversationMessage` itself, which is off the table for this feature
   ("do not update the components in lyra-ui until i say"). The removable
   Technical/Urgent/Billing pills still reuse `Tag` unmodified — it already
   supports `onRemove` plus the purple/critical/default variants used below,
   no lyra-ui changes needed there. */


/* ── CustomerInformationPanelBody ──
   Body content for the "Customer Information" `InteriorPanel` docked right
   of an active interaction — a profile block (avatar initials + name +
   presence),
   two placeholder tab sections, and a detail-row list, reproducing the
   reference mockup's layout as placeholder content (real per-tab data isn't
   wired up yet, same "prototype the shape first" status as the transcript
   above).

   The mockup's field rows (label left, value right, hairline divider) are
   lyra-ui's own documented "Label Horizontal With Separator" composition
   (see Input.stories.tsx) — `Label` (not a plain span) + a value span
   (`lyra-body-md text-lyra-fg-secondary`) + `Separator`, not literally the
   `Input` component itself (Input's own `readonly` mode still renders a
   bordered box, which isn't this shape at all — the horizontal/label-only
   look lives in this separate story pattern, composed from `Label` +
   `Separator`, both already lyra-ui exports). Avatar uses initials
   (`initialsFor`, already used everywhere else in this file) instead of
   the mockup's photo — no photo source exists for these interactions. */

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
export const CUSTOMER_INFO_STREET_NAMES = [
  "Clinton Heights Ave", "Maple Grove Dr", "Sunset Ridge Ln", "Harbor View Ct",
  "Cedar Hollow Rd", "Birchwood Ter", "Fieldstone Way", "Willow Creek Blvd",
];
export const CUSTOMER_INFO_CITY_STATE: { city: string; state: string }[] = [
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

export const CUSTOMER_LATEST_INTERACTION_STATUS_POOL: { status: string; variant: ContactHistoryStatusVariant }[] = [
  { status: "Resolved", variant: "success" },
  { status: "Escalated", variant: "critical" },
  { status: "Pending", variant: "warning" },
];

export const CUSTOMER_LATEST_INTERACTION_CHANNEL_POOL = ["Email", "Voice", "Chat", "SMS"];

export const CUSTOMER_LATEST_INTERACTION_TIME_AGO_POOL = [
  "3 days ago", "9 days ago", "2 weeks ago", "3 weeks ago", "1 month ago", "6 weeks ago",
];

export const CUSTOMER_LATEST_INTERACTION_SUMMARY_POOL = [
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

export const CUSTOMER_LATEST_NOTE_TIME_AGO_POOL = [
  "1 day ago", "4 days ago", "1 week ago", "2 weeks ago", "1 month ago", "2 months ago",
];

export const CUSTOMER_LATEST_NOTE_POOL = [
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

export const COPILOT_SUMMARY_POOL: Array<{ reason: string; journey: string }> = [
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

export const CUSTOMER_HISTORY_DIRECTION_LABEL: Record<CustomerHistoryDirection, string> = {
  inbound: "Inbound",
  outbound: "Outbound",
};

// Lowercase per the reference screenshots ("Outbound call", "Outbound
// email") except the SMS acronym, which stays upper — see `typeLabel`.
export const CUSTOMER_HISTORY_CHANNEL_LOWER_LABEL: Record<CustomerHistoryChannelType, string> = {
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

export const CUSTOMER_HISTORY_CALL_CENTER_POOL = [
  "Testing Call Center", "Main Call Center", "East Region Call Center", "Overflow Call Center",
];

// Only `voice` entries ever roll against this — `undefined` (no status
// shown) is deliberately in the pool twice, so most calls show nothing at
// all, same as most rows in the reference screenshots.
export const CUSTOMER_HISTORY_VOICE_STATUS_POOL: (string | undefined)[] = [
  "Disconnected", "Disconnected", undefined, undefined, "dialing",
];

// SMS thread content (Conversation tab, `channelType === "sms"`) — a short
// alternating customer/agent exchange. Indexed independently by sender so a
// synthesized thread doesn't accidentally pair an agent line that doesn't
// answer the customer line right before it; realism isn't the bar here (no
// real transcript data exists to reproduce), just a plausible-looking
// back-and-forth.
export const CUSTOMER_HISTORY_SMS_CUSTOMER_MESSAGE_POOL = [
  "Hi, I had a question about my last bill.",
  "Can you check if my address on file is up to date?",
  "I don't think I received the confirmation text yet.",
  "Thanks, that answers my question!",
  "Is there a fee for that?",
  "Sorry, one more thing — when does that take effect?",
];
export const CUSTOMER_HISTORY_SMS_AGENT_MESSAGE_POOL = [
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
export const CUSTOMER_HISTORY_EMAIL_SUBJECT_POOL = [
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
export function buildCustomerHistorySmsMessages(
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

export const CUSTOMER_HISTORY_ENTRY_COUNT = 8;

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

/** Small directional-icon pair (an `ArrowUp`/`ArrowDown` beside the channel
 *  icon) — no existing composed "inbound/outbound channel icon" exists
 *  anywhere in this file or lyra-ui (checked); side-by-side rather than
 *  overlaid as a corner badge (the convention `Button`'s own `badge` prop/
 *  `channelCount` pill elsewhere in this file use) since at this small size
 *  an overlaid arrow would mostly obscure the channel glyph underneath it,
 *  and the reference screenshots show both fully visible side by side. */
export function CustomerHistoryChannelIcon({
  channelType,
  direction,
}: {
  channelType: CustomerHistoryChannelType;
  direction: CustomerHistoryDirection;
}) {
  const ChannelIcon = CUSTOMER_HISTORY_CHANNEL_ICON[channelType];
  const DirectionIcon = direction === "outbound" ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn("flex items-center gap-0.5 shrink-0 pt-0.5", CUSTOMER_HISTORY_CHANNEL_COLOR_CLASS[channelType])}
      aria-hidden="true"
    >
      <DirectionIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
      <ChannelIcon className="h-4 w-4" strokeWidth={1.75} />
    </span>
  );
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

/** The "Contacts" tab's own body — a toolbar (search + Channel
 *  type/Direction/Tags checklists + a date-range filter) above a list of
 *  `CustomerHistorySessionEntry` cards (see this section's own doc comment
 *  above). `selectedIndex`/`onSelectIndex` drive which one's own detail
 *  panel (`CustomerHistorySessionDetailPanel`, rendered as a sibling at the
 *  call site) is open; clicking the already-open card's own row toggles it
 *  back closed instead of just re-selecting the same one, same convention
 *  `CustomersListView`'s own `onRowClick` uses for `CustomerRowInfoPanel`.
 *
 *  Scrolls in its OWN independent box (`flex-1 min-h-0 overflow-hidden`
 *  below, with the list itself `overflow-y-auto`) — not as part of the
 *  Customer Information panel's shared `PanelContent` scroll region.
 *  Briefly changed to the latter (single shared scroll + a `sticky`
 *  toolbar) while chasing what turned out to be a real bug one level up —
 *  `SidePanel`'s own docked/pinned branch was missing an `h-full` its
 *  full-screen branch already had, so nothing above this component ever
 *  had a genuinely definite height to bound against, no matter how this
 *  component itself was built. With that fixed at its actual source (see
 *  `CustomerInformationPanelBody`'s own outer wrapper comment), the
 *  original independent-scroll design works as intended again, and is
 *  worth keeping over the shared-scroll fallback: it's what lets
 *  `CustomerHistorySessionDetailPanel` (rendered as this component's own
 *  sibling at the call site) overlay ON TOP of this list instead of
 *  pushing it down or inheriting an arbitrary, content-driven height that
 *  doesn't match the visible viewport.
 *
 *  Search/filter state is local (`useState` in here), not lifted to
 *  `AgentNextGenPage` — unlike `selectedIndex` (which has to survive this
 *  component unmounting, since the detail panel renders as its sibling),
 *  nothing outside this component ever needs to read or restore the
 *  toolbar's own state, so there's no reason to hoist it. `selectedIndex`
 *  itself always refers to a position in the full, unfiltered `entries`
 *  array (so `CustomerHistorySessionDetailPanel`'s prev/next chevrons keep
 *  stepping through the customer's whole history, not just whatever's
 *  currently visible under a filter) — the filtered rows below are mapped
 *  with their original index preserved for exactly that reason. */
export function CustomerHistoryTabContent({
  entries,
  selectedIndex,
  onSelectIndex,
}: {
  entries: CustomerHistorySessionEntry[];
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string[]>>({});
  const [dateRangeValue, setDateRangeValue] = useState<DateRangeFilterValue>("last30");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);

  const filterDefs = [
    { key: "channelType", label: "Channel type", options: CUSTOMER_HISTORY_CHANNEL_TYPE_FILTER_OPTIONS },
    { key: "direction", label: "Direction", options: CUSTOMER_HISTORY_DIRECTION_FILTER_OPTIONS },
    { key: "tags", label: "Tags", options: CUSTOMER_HISTORY_TAG_FILTER_OPTIONS },
  ];
  const handleFilterChange = (key: string, values: string[]) =>
    setFilterValues((prev) => ({ ...prev, [key]: values }));
  const clearAllFilters = () => {
    setFilterValues({});
    setSearchQuery("");
    setDateRangeValue("last30");
    setCustomDateRange(undefined);
  };

  const channelTypeValues = filterValues.channelType ?? [];
  const directionValues = filterValues.direction ?? [];
  const tagValues = filterValues.tags ?? [];

  // Keeps each visible row's ORIGINAL index into `entries` (see this
  // component's own doc comment above for why that matters), rather than
  // reassigning fresh 0-based indices to the filtered subset.
  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => {
        if (query) {
          const haystack = `${entry.target} ${entry.agentName} ${entry.typeLabel}`.toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        if (channelTypeValues.length && !channelTypeValues.includes(entry.channelType)) return false;
        if (directionValues.length && !directionValues.includes(entry.direction)) return false;
        if (tagValues.length && !entry.tags.some((tag) => tagValues.includes(tag))) return false;
        if (!isWithinCustomerHistoryDateRange(entry.timestamp, dateRangeValue, customDateRange)) return false;
        return true;
      });
  }, [entries, searchQuery, channelTypeValues, directionValues, tagValues, dateRangeValue, customDateRange]);

  if (entries.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4">
        <Inbox className="h-8 w-8 text-lyra-fg-disabled" strokeWidth={1.5} aria-hidden="true" />
        <p className="lyra-body-md text-lyra-fg-disabled text-center">No previous interactions with this customer</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <TableToolbar
        className="px-6"
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterDefs={filterDefs}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onFilterClear={clearAllFilters}
        filters={
          <DateRangeFilterChip
            value={dateRangeValue}
            onValueChange={setDateRangeValue}
            options={CUSTOMER_HISTORY_DATE_RANGE_OPTIONS}
            customValue={customDateRange}
            onCustomValueChange={setCustomDateRange}
          />
        }
      />

      {filteredEntries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4">
          <Inbox className="h-8 w-8 text-lyra-fg-disabled" strokeWidth={1.5} aria-hidden="true" />
          <p className="lyra-body-md text-lyra-fg-disabled text-center">No interactions match these filters</p>
        </div>
      ) : (
        // `min-h-0` — without it, this flex-column item's default
        // `min-height: auto` lets it refuse to shrink below its own
        // (potentially long) list's natural content height during the
        // flex algorithm's shrink pass, so it would grow past its actual
        // available space instead of respecting it — the classic nested-
        // flex-scroll gotcha. Needed now that this list is back to
        // scrolling in its own independent box (see this component's own
        // doc comment).
        <div className="flex flex-1 flex-col min-h-0 overflow-y-auto">
          {filteredEntries.map(({ entry, index }, i) => {
            const isSelected = selectedIndex === index;
            return (
              <div
                key={entry.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() => onSelectIndex(isSelected ? null : index)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectIndex(isSelected ? null : index);
                  }
                }}
                className={cn(
                  "flex items-start gap-3 px-6 py-3 cursor-pointer transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lyra-border-focus focus-visible:-ring-offset-2",
                  i > 0 && "border-t border-lyra-border-subtle",
                  isSelected
                    ? "bg-lyra-bg-active-subtle hover:bg-lyra-state-hover-active-subtle"
                    : "hover:bg-lyra-state-hover"
                )}
              >
                <CustomerHistoryChannelIcon channelType={entry.channelType} direction={entry.direction} />
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  {/* Full-width now that the timestamp isn't sharing this
                      row with it anymore — was truncating badly (e.g. a
                      whole phone number down to "(456) 383-3...") in the
                      Customer Information panel's own narrower width (this
                      list used to only ever render at full page width, back
                      when "Interactions" was a separate top-level tab — see
                      `CUSTOMER_PANEL_TABS`), since the timestamp's own
                      `whitespace-nowrap` column was claiming a fixed chunk
                      of that now-scarcer horizontal space on every row. */}
                  <span className="lyra-body-md text-lyra-fg-default truncate">{entry.target}</span>
                  {/* Just the timestamp now — the call type/direction text
                      (e.g. "Outbound call", "Inbound sms", formerly inline
                      here next to it) and the trailing status column (e.g.
                      "Disconnected"/"Dialing") were both dropped per
                      explicit request. Direction is still conveyed visually
                      via `CustomerHistoryChannelIcon`'s own up/down arrow
                      (left of the target line above), so removing the
                      redundant text label doesn't lose that information. */}
                  <span className="lyra-body-sm text-lyra-fg-secondary whitespace-nowrap">
                    {entry.timestampDisplay}
                  </span>
                  <span className="lyra-body-sm-emphasis text-lyra-fg-default truncate">
                    {entry.agentName} ({entry.agentEmail.toUpperCase()})
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Read-only session-detail field, `Label` stacked above its value —
 *  matches the reference screenshot's own layout (label above value, not
 *  `CustomerInformationPanelBody`'s Overview-tab "label left, value right"
 *  row), and reuses the plain `Label` atom rather than a hand-styled
 *  uppercase span (CONTRIBUTING's "don't hand-roll `text-transform`" rule —
 *  `Label`'s own built-in look is whatever this app already uses for every
 *  other field label, so this stays visually consistent with the rest of
 *  the panel even though it isn't pixel-identical to the reference). */
export function CustomerHistoryDetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <Label label={label} />
      <span className="lyra-body-md text-lyra-fg-default break-words">{value}</span>
    </div>
  );
}

export const CUSTOMER_HISTORY_DETAIL_TABS = ["Details", "Conversation"];

/** One read-only customer/agent bubble for the Conversation tab's SMS
 *  thread (`CustomerHistoryConversationContent` below) — was a hand-rolled
 *  copy of the live-transcript bubble markup (nearly identical to
 *  `ContactHistoryMessageBubble`, agent-next-gen-contact-history.tsx's own
 *  equivalent), now just a thin adapter over lyra-ui's shared `ChatMessage`
 *  — same component the real, in-progress transcript uses
 *  (`TranscriptMessageBubble`, agent-next-gen-transcript.tsx). No
 *  `onCopy`/`tagOptions` passed — both are live-editing affordances for an
 *  open conversation, and every session this panel shows is already closed
 *  history; there's nothing to tag or copy-in-progress, and `ChatMessage`'s
 *  own toolbar stays hidden entirely when those are omitted.
 *  `customerName`/`agentName` — `CustomerHistoryConversationMessage` itself
 *  carries no name field, so `CustomerHistoryConversationContent` passes
 *  both down from its own `entry` (`customerUsername`/`agentName`). */
export function CustomerHistoryConversationMessageBubble({
  message,
  customerName,
  agentName,
}: {
  message: CustomerHistoryConversationMessage;
  customerName: string;
  agentName: string;
}) {
  const isCustomer = message.sender === "customer";
  return (
    <ChatMessage
      variant={message.sender}
      name={isCustomer ? customerName : agentName}
      initials={initialsFor(isCustomer ? customerName : agentName)}
      timestamp={message.timestampDisplay}
      text={message.text}
    />
  );
}

/** The Conversation tab's actual body — what it shows depends on
 *  `entry.channelType`, since a call/SMS thread/email genuinely don't look
 *  like the same kind of content (same reasoning `InteractionTranscript`'s
 *  own per-channel branching already uses, see that component's doc
 *  comment): an SMS session renders its real reconstructed message thread
 *  (`conversationMessages`); a voice session has no messages at all, just a
 *  call-notes card (`conversationSummary`) with its `callDurationDisplay`;
 *  an email session renders as `emailSubject` + body (`conversationSummary`
 *  again) rather than chat bubbles, since an email doesn't read as a
 *  back-and-forth the way SMS does. */
export function CustomerHistoryConversationContent({ entry }: { entry: CustomerHistorySessionEntry }) {
  if (entry.channelType === "sms") {
    return (
      <div className="flex flex-col gap-4 px-4 py-3">
        {(entry.conversationMessages ?? []).map((message, i) => (
          <CustomerHistoryConversationMessageBubble
            key={i}
            message={message}
            customerName={entry.customerUsername}
            agentName={entry.agentName}
          />
        ))}
      </div>
    );
  }

  if (entry.channelType === "email") {
    return (
      <div className="flex flex-col gap-3 p-4">
        <div className={cn(CUSTOMER_INFO_ACCORDION_CLASSNAME, "flex flex-col gap-3 p-4")}>
          <CustomerHistoryDetailField label="Subject" value={entry.emailSubject ?? ""} />
          <div className="flex flex-col gap-1">
            <Label label="Body" />
            <p className="lyra-body-md text-lyra-fg-default">{entry.conversationSummary}</p>
          </div>
        </div>
      </div>
    );
  }

  // Voice — call notes + duration, no message thread.
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className={cn(CUSTOMER_INFO_ACCORDION_CLASSNAME, "flex flex-col gap-3 p-4")}>
        <CustomerHistoryDetailField label="Duration" value={entry.callDurationDisplay ?? ""} />
        <div className="flex flex-col gap-1">
          <Label label="Call Notes" />
          <p className="lyra-body-md text-lyra-fg-default">{entry.conversationSummary}</p>
        </div>
      </div>
    </div>
  );
}

/** Right-docked `InteriorPanel` opened by clicking a `CustomerHistoryTabContent`
 *  card — same "click a row, open a right `InteriorPanel`, chevron through
 *  the list" shape `CustomerRowInfoPanel` already uses for the Customers
 *  table (see that component's own doc comment), just over
 *  `CustomerHistorySessionEntry` rows instead of `CustomerListRecord` ones.
 *
 *  Two tabs, per explicit request: "Details" (a "Conversation Details" card
 *  — summary blurb + Duration for voice entries — directly above a
 *  "Session Details" card of this session's own identity fields, both
 *  collapsible `Accordion`s rather than permanently-expanded blocks; panel
 *  header itself reads "Interaction Details", was "Session Details") and
 *  "Conversation" (the actual reconstructed conversation content,
 *  `CustomerHistoryConversationContent` above). Own `activeTab` state,
 *  reset back to "Details" whenever a different session's entry is opened
 *  (via `entry?.id`) — a `Conversation` tab left open on session A
 *  shouldn't carry over silently to session B. */
export function CustomerHistorySessionDetailPanel({
  entry,
  onClose,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
}: {
  entry: CustomerHistorySessionEntry | null;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
}) {
  /* Defaults to "Conversation", not "Details" — agents open a past session
     to read what was said; the metadata fields are the secondary tab.
     Deliberately NOT reset when `entry.id` changes (it used to reset to 0
     on every change): the prev/next chevrons' primary use is scanning back
     through several sessions reading each conversation, and resetting the
     tab forced a re-click of "Conversation" on every step of that scan. */
  const [activeTab, setActiveTab] = useState(() => CUSTOMER_HISTORY_DETAIL_TABS.indexOf("Conversation"));

  return (
    <InteriorPanel
      side="right"
      open={entry !== null}
      onClose={onClose}
      // `z-[3]` — overrides `InteriorPanel`'s own default `z-[5]` (via
      // `cn()`'s `tailwind-merge` dedup, same "consumer className overrides
      // the internal default" mechanism `CustomerInformationSidePanel`'s own
      // header-icon `Popover` etc. already rely on elsewhere in this file).
      // Needed because this panel's absolutely-positioned narrow/overlay
      // branch (interior-panel.tsx, triggered below ~1024px of available
      // width) and `CustomerInformationSidePanel`'s own unpinned/floating
      // branch (side-panel.tsx) both otherwise land on that exact same
      // `z-[5]` tier — and since neither of their shared ancestors (the
      // "everything else" column, this body row) sets its own `z-index`,
      // they compete in the SAME stacking context, where DOM order (this
      // panel renders later/deeper) broke the tie in this panel's favor —
      // confirmed live: opening a session's details in a narrow container
      // painted this panel over top of the Customer Information panel
      // instead of leaving it visible. `z-[3]` keeps this panel safely
      // above the plain `CustomerHistoryTabContent` list it's meant to
      // cover (unstyled, `z-auto`) while staying below the Customer
      // Information panel's own `z-[5]` — same "pick a tier relative to
      // that panel's z-[5]" convention already established for the
      // transcript's own sticky session separator (`z-[1]`, see its own
      // doc comment) and the shared panel's fullscreen overlay (`z-[9]`).
      className="z-[3]"
      storageKey="customer-history-session-detail-panel-width"
      headerTitle="Interaction Details"
      headerSubhead={entry?.timestampDisplay}
      headerActions={
        <>
          <Button
            variant="outline"
            size="icon-md"
            onClick={onPrevious}
            disabled={!hasPrevious}
            title="Previous session"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </Button>
          <Button variant="outline" size="icon-md" onClick={onNext} disabled={!hasNext} title="Next session">
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </Button>
        </>
      }
      headerTabs={
        <TabList className="px-4" overflowMenu>
          {CUSTOMER_HISTORY_DETAIL_TABS.map((label, i) => (
            <Tab key={label} active={activeTab === i} onClick={() => setActiveTab(i)}>
              {label}
            </Tab>
          ))}
        </TabList>
      }
    >
      {entry && activeTab === CUSTOMER_HISTORY_DETAIL_TABS.indexOf("Details") && (
        <div className="flex flex-col gap-4 px-4 pt-3 pb-4 lyra-form-grid-wrap">
          {/* Conversation Details — moved above Session Details (per
              explicit request; was below it). Duration added here too
              (voice entries only — `callDurationDisplay` is only ever set
              for `channelType === "voice"`, see `CustomerHistorySessionEntry`'s
              own doc comment — SMS/email entries just show the summary
              alone, same as before). */}
          <Accordion
            className={CUSTOMER_INFO_ACCORDION_CLASSNAME}
            defaultValue="conversation-details"
            items={[
              {
                id: "conversation-details",
                title: "Conversation Details",
                content: (
                  <div className="flex flex-col gap-4">
                    {entry.callDurationDisplay && (
                      <CustomerHistoryDetailField label="Duration" value={entry.callDurationDisplay} />
                    )}
                    <p className="lyra-body-md text-lyra-fg-secondary">{entry.conversationSummary}</p>
                  </div>
                ),
              },
            ]}
          />
          <Accordion
            className={CUSTOMER_INFO_ACCORDION_CLASSNAME}
            defaultValue="session-details"
            items={[
              {
                id: "session-details",
                title: "Session Details",
                content: (
                  <div className="flex flex-col gap-4">
                    <CustomerHistoryDetailField label="Start Date" value={entry.timestampDisplay} />
                    <div className="lyra-form-grid">
                      <CustomerHistoryDetailField
                        label="Agent"
                        value={`${entry.agentName} (${entry.agentEmail.toUpperCase()})`}
                      />
                      <CustomerHistoryDetailField label="Target" value={entry.target} />
                    </div>
                    <CustomerHistoryDetailField label="Type" value={entry.typeLabel} />
                    <CustomerHistoryDetailField label="Call Center" value={entry.callCenter} />
                    <CustomerHistoryDetailField label="Customer" value={entry.customerUsername} />
                    <CustomerHistoryDetailField label="External Interaction ID" value={entry.externalInteractionId} />
                    <CustomerHistoryDetailField label="External Thread ID" value={entry.externalThreadId} />
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}
      {entry && activeTab === CUSTOMER_HISTORY_DETAIL_TABS.indexOf("Conversation") && (
        <>
          {/* One-line outcome header — status · agent · date — so quick
              "how did that end?" lookups can finish without reading the
              thread at all. Same lyra-body-sm secondary treatment as the
              Overview tab's Latest Interaction meta lines. */}
          <div className="px-4 pt-3">
            <span className="lyra-body-sm text-lyra-fg-secondary">
              {[entry.statusLabel, entry.agentName, entry.timestampDisplay].filter(Boolean).join(" · ")}
            </span>
          </div>
          <CustomerHistoryConversationContent entry={entry} />
        </>
      )}
    </InteriorPanel>
  );
}

/* ── HistoryConversationView ──
   A past session's conversation rendered in the INTERACTION SPACE (the
   record area's content column), as the body of the history tab the
   Customer Information panel's "Open Conversation" deep link opens — full
   reading width, unlike the ≤425px panel detail. Same one-line outcome
   header + `CustomerHistoryConversationContent` composition the panel's own
   detail view uses; `px-2` tops up that content's own `px-4` to the record
   area's standard 24px inset. */
export function HistoryConversationView({ entry }: { entry: CustomerHistorySessionEntry }) {
  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-y-auto px-2">
      <div className="px-4 pt-4">
        <span className="lyra-body-sm text-lyra-fg-secondary">
          {[entry.statusLabel, entry.agentName, entry.timestampDisplay].filter(Boolean).join(" · ")}
        </span>
      </div>
      <CustomerHistoryConversationContent entry={entry} />
    </div>
  );
}

export const CUSTOMER_DETAIL_ACCOUNT_BLOCK_OPTIONS: SelectOption[] = [
  { value: "none", label: "None" },
  { value: "collections", label: "Collections" },
  { value: "fraud-review", label: "Fraud Review" },
  { value: "credit-hold", label: "Credit Hold" },
];

/* ── CustomerDetailTabContent ──
   The "Detail" tab's field-editor form (per a reference screenshot of a
   legacy admin contact-edit page) — two collapsible `Accordion` sections,
   "General" and "Address", both open by default, each a responsive
   `.lyra-form-grid` of real lyra-ui field components (`Input`/`Select`/
   `Checkbox`/`DatePicker`), same "Accordion wrapping real editable fields"
   composition `FormTemplate`'s own "Placement Information" section already
   demonstrates (form-template.tsx) — not a hand-rolled bordered box imitating
   one. `lyra-form-grid-wrap` on the root establishes the container-query
   boundary `.lyra-form-grid` needs (see that class's own doc comment in
   lyra-tokens.css): each row is 2-up at this component's own full width,
   stepping down to a single column well before an `InteriorPanel`'s
   typical ~250–425px width would otherwise crowd two fields onto one line.

   Reference screenshot's field labels were all-caps ("CONTACT #", "FIRST
   NAME") — that's the *legacy* admin app's own styling, not something to
   replicate via CSS `text-transform` (CONTRIBUTING.md §17 already covers
   exactly this mistake). Labels here are typed in normal case and rendered
   through each field component's own built-in label, same as every other
   field in this panel/app.

   Fields with a real source reuse it instead of inventing a second,
   possibly-disagreeing value: "Contact #"/"Total Balance"/"Address
   1"/"City"/"State"/"Zip Code" come straight from `fields` (the same
   per-customer data `buildCustomerInfoFields` already computed for the
   Overview tab — see `getFieldValue` above), and "First Name"/"Last Name"
   are seeded from `customerName` the same way `buildCustomerInfoFields`'s
   own synthesized email does (`splitCustomerName`) — done once, at draft-
   build time (`buildCustomerRecordDraft` below), not derived fresh every
   render here. Everything else in the reference screenshot (Original
   Contact #, Title, Department, Balance Due, Account Block, Group, Due
   Date, Address 2) has no real or synthesized source anywhere in this
   app's data, so those stay at the screenshot's own shown defaults (empty
   / "None" / unchecked-false where shown, "$0.00" for Balance Due
   specifically since it's a distinct "amount currently owed" concept from
   Total Balance, not just a repeat of it).

   Every editable field here is now CONTROLLED via `draft`/`onDraftChange`
   (a `CustomerRecordDraft` + patch-merge setter, both owned by
   `useCustomerRecordDraft` — see that hook's own doc comment) rather than
   this component's own local `useState` per field, per explicit request
   for a Save/Cancel footer: this component used to unmount (losing all
   its local state) the moment the agent switched away from the Detail tab
   (see the `activeTab === ... &&` conditional render in
   `CustomerInformationPanelBody`), which made "pending, revertible edits
   that survive a tab switch" impossible without lifting the values out of
   here first. Still "not wired to persistence" in the sense that matters
   for a prototype (no backend call on Save) — just no longer "silently
   discarded on tab switch" either. */
export function CustomerDetailTabContent({
  fields,
  draft,
  onDraftChange,
}: {
  fields: CustomerInfoField[];
  draft: CustomerRecordDraft;
  onDraftChange: (patch: Partial<CustomerRecordDraft>) => void;
}) {
  // Same neutral bordered-container treatment as the Overview tab's
  // "Customer Overview"/"Latest Interaction" accordions (see
  // `CustomerInformationPanelBody`) — each section gets its own card-like
  // container rather than the two sharing one borderless `Accordion` root,
  // so "General" and "Address" read as distinct blocks instead of one long
  // list. Split into two single-item `Accordion`s (each still open by
  // default via its own `defaultValue`) instead of the previous single
  // `type="multiple"` root, since that's what separate containers require —
  // each item now toggles independently by construction, the same behavior
  // `type="multiple"` was providing before.
  return (
    <div className="flex flex-col gap-4 px-4 pt-3 pb-4 lyra-form-grid-wrap">
      <Accordion
        defaultValue="general"
        className={CUSTOMER_INFO_ACCORDION_CLASSNAME}
        items={[
          {
            id: "general",
            title: "General",
            content: (
              <div className="flex flex-col gap-4">
                <div className="lyra-form-grid">
                  <Input label="Contact #" value={getFieldValue(fields, "Contact #")} readonly />
                  <Input
                    label="Original Contact #"
                    value={draft.originalContactNumber}
                    onChange={(e) => onDraftChange({ originalContactNumber: e.target.value })}
                  />
                </div>
                <div className="lyra-form-grid">
                  <Input label="First Name" value={draft.firstName} onChange={(e) => onDraftChange({ firstName: e.target.value })} />
                  <Input label="Last Name" value={draft.lastName} onChange={(e) => onDraftChange({ lastName: e.target.value })} />
                </div>
                <div className="lyra-form-grid">
                  <Input label="Title" value={draft.title} onChange={(e) => onDraftChange({ title: e.target.value })} />
                  <Input label="Department" value={draft.department} onChange={(e) => onDraftChange({ department: e.target.value })} />
                </div>
                <div className="lyra-form-grid">
                  <Input label="Total Balance" value={getFieldValue(fields, "Balance")} readonly />
                  <Input label="Balance Due" value={draft.balanceDue} onChange={(e) => onDraftChange({ balanceDue: e.target.value })} />
                </div>
                <div className="lyra-form-grid">
                  <Checkbox
                    label="Active"
                    checked={draft.active}
                    onCheckedChange={(checked) => onDraftChange({ active: checked === true })}
                  />
                  <Select
                    label="Account Block"
                    options={CUSTOMER_DETAIL_ACCOUNT_BLOCK_OPTIONS}
                    value={draft.accountBlock}
                    onValueChange={(value) => onDraftChange({ accountBlock: value })}
                  />
                </div>
                <div className="lyra-form-grid">
                  <Select
                    label="Group"
                    options={[]}
                    value={draft.group}
                    onValueChange={(value) => onDraftChange({ group: value })}
                    placeholder="Select group"
                  />
                  <DatePicker label="Due Date" value={draft.dueDate} onChange={(date) => onDraftChange({ dueDate: date })} />
                </div>
              </div>
            ),
          },
        ]}
      />
      <Accordion
        defaultValue="address"
        className={CUSTOMER_INFO_ACCORDION_CLASSNAME}
        items={[
          {
            id: "address",
            title: "Address",
            content: (
              <div className="flex flex-col gap-4">
                <div className="lyra-form-grid">
                  <Input label="Address 1" value={getFieldValue(fields, "Address")} readonly />
                  <Input label="Address 2" value={draft.address2} onChange={(e) => onDraftChange({ address2: e.target.value })} />
                </div>
                <div className="lyra-form-grid">
                  <Input label="City" value={getFieldValue(fields, "City")} readonly />
                  <Input label="State" value={getFieldValue(fields, "State")} readonly />
                </div>
                <div className="lyra-form-grid">
                  <Input label="Zip Code" value={getFieldValue(fields, "Zip Code")} readonly />
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

export const CUSTOMER_DIRECTORY_BLOCK_OPTIONS = [
  { value: "no-block", label: "No Block" },
  { value: "block-daily", label: "Block Daily" },
  { value: "block-permanent", label: "Block Permanent" },
];

/** Total phone slots the Directory tab renders — "up to 10 phones" per the
 *  reference screenshot: the first is always labeled "Home", the rest
 *  "Phone 2" through "Phone 10". */
export const CUSTOMER_DIRECTORY_PHONE_COUNT = 10;
export const CUSTOMER_DIRECTORY_PHONE_LABELS = Array.from({ length: CUSTOMER_DIRECTORY_PHONE_COUNT }, (_, i) =>
  i === 0 ? "Home" : `Phone ${i + 1}`
);

export interface CustomerDirectoryPhoneState {
  phone: PhoneValue;
  consentCall: boolean;
  consentSms: boolean;
  block: string;
}

/* ── CustomerDirectoryPhoneRow ──
   One phone slot's worth of fields, its own little self-contained block —
   pulled out of `CustomerDirectoryTabContent` (rather than inlined in a
   `.map`) so each of the up to 10 rows below owns independent `useState`
   the normal way a component does, instead of ten parallel array-indexed
   state slots in the parent needing hand-rolled per-index update
   functions for every field. Same "Call Attempts Today/Total" read-only
   stat pair for every row (there's no live call-attempt tracking in this
   demo, same static-`0` status as `Thread.messageCount`
   elsewhere) — plain text, not `Metric`/`DashboardCardMetric`, since those
   render a large headline figure + caption meant for a dashboard card,
   not a compact inline stat under a phone field.

   Each slot is its own single-item `Accordion` (title = the slot label,
   e.g. "Home"/"Phone 2") — collapsible per request, `defaultValue={label}`
   so every slot still starts open (same "collapsible but open by default"
   convention as the Overview tab's own "Latest Interaction" accordion).
   `PhoneInput` no longer gets its own `label` prop: the accordion's own
   trigger already shows the slot name as its title immediately above the
   field, so a second, identical label directly under it was pure
   duplication (confirmed from a screenshot of the pre-accordion layout —
   "Home" as a plain heading, then "Home" again as the phone field's own
   label right below it).

   No divider of its own on this row — `Accordion`'s own per-item
   `border-b` (accordion.tsx, rendered after every item's content)
   supplies the hairline between consecutive slots; `CustomerDirectory
   TabContent` adds one `border-t` above the whole list of rows for the
   divider separating it from the Email/Consent block, rather than every
   row duplicating that same top border (which used to visually double up
   with the row-before's own bottom divider).

   Controlled via `state`/`onChange` (a patch-merge setter into this
   slot's own `CustomerDirectoryPhoneState`) rather than its own local
   `useState` seeded from a `defaultState` prop — same "lifted into
   `useCustomerRecordDraft`, survives a tab switch, drives the Save/Cancel
   footer" reasoning `CustomerDetailTabContent`'s own doc comment covers,
   just per-phone-slot instead of per-field. */
export function CustomerDirectoryPhoneRow({
  label,
  state,
  onChange,
}: {
  label: string;
  state: CustomerDirectoryPhoneState;
  onChange: (patch: Partial<CustomerDirectoryPhoneState>) => void;
}) {
  return (
    <Accordion
      type="single"
      defaultValue={label}
      // Same neutral bordered-container treatment as the Overview tab's
      // "Customer Overview"/"Latest Interaction" accordions and the Detail
      // tab's "General"/"Address" accordions (see those components' own
      // comments) — each phone slot now reads as its own card instead of a
      // borderless row, consistent across all three tabs.
      className={CUSTOMER_INFO_ACCORDION_CLASSNAME}
      items={[
        {
          id: label,
          title: label,
          content: (
            // Three columns — phone + its call-attempt stats, consent
            // checkboxes, block radios — share one `.lyra-form-grid` row.
            // `.lyra-form-grid` already handles any number of children
            // evenly (`> *` gets `flex: 1 1 0%` by default — no
            // per-consumer modifier needed, unlike `.lyra-card-split`'s
            // `-even`, see that class's own doc comment in
            // lyra-tokens.css for why the two families differ here), and
            // reacts off the same `.lyra-form-grid-wrap` boundary this
            // row's ancestor (`CustomerDirectoryTabContent`'s root div)
            // already establishes — full width (e.g. `allowFullScreen`'d)
            // reads as a real 3-up row per the reference screenshot, this
            // panel's normal ~350–425px resizable width stacks to one
            // column same as before this existed.
            <div className="lyra-form-grid">
              <div className="flex flex-col gap-3">
                {/* `max-w-sm` (384px) — same convention as the Directory
                    tab's `EmailInput` above (see its own comment): caps a
                    single full-width-by-default field at a sane reading
                    width via the standing `className` passthrough, rather
                    than letting it stretch to fill this column's full
                    (already only ~1/3-row) width. */}
                <PhoneInput value={state.phone} onChange={(phone) => onChange({ phone })} className="max-w-sm" />
                <div className="flex flex-col gap-1">
                  <span className="lyra-body-md-emphasis text-lyra-fg-default">Call Attempts Today: 0</span>
                  <span className="lyra-body-md-emphasis text-lyra-fg-default">Call Attempts Total: 0</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Checkbox
                  label="Consent Call"
                  checked={state.consentCall}
                  onCheckedChange={(c) => onChange({ consentCall: c === true })}
                />
                <Checkbox
                  label="Consent SMS"
                  checked={state.consentSms}
                  onCheckedChange={(c) => onChange({ consentSms: c === true })}
                />
              </div>
              <RadioGroup value={state.block} onValueChange={(block) => onChange({ block })} className="gap-2">
                {CUSTOMER_DIRECTORY_BLOCK_OPTIONS.map((option) => (
                  <RadioGroupItem key={option.value} value={option.value} label={option.label} />
                ))}
              </RadioGroup>
            </div>
          ),
        },
      ]}
    />
  );
}

/* ── CustomerDirectoryTabContent ──
   The "Directory" tab (per a reference screenshot of a legacy admin
   contact-edit page): an `EmailInput` + a standalone consent `Checkbox` at
   the top, then up to 10 phone slots (`CustomerDirectoryPhoneRow`),
   separated by a hairline divider between every section
   (`border-lyra-border-subtle`). The reference screenshot's own
   alternating shaded/unshaded rows were dropped on request — plain
   dividers only, no zebra striping.

   Reference screenshot's own field labels were all-caps ("EMAIL", "HOME") —
   same legacy-app-styling situation as the Detail tab's "CONTACT #" etc.
   (see `CustomerDetailTabContent`'s own doc comment and CONTRIBUTING.md
   §17): typed in normal case here and left to each field component's own
   built-in label typography, not forced uppercase via CSS.

   Only the "Home" row (the first phone slot) seeds from real data — the
   same `fields` "Phone #" this panel's Overview/Detail tabs already show
   (parsed back into a `PhoneValue` via `phoneValueFromDisplay`), with
   `consentCall`/`consentSms` defaulted true since it's the customer's
   already-established primary channel. "Phone 2" through "Phone 10" have
   no real or synthesized source (a customer doesn't have 10 real numbers
   in this app's data), so they start genuinely blank/unconsented, same as
   the reference screenshot shows them — see `buildCustomerRecordDraft`,
   which now owns seeding this same starting shape.

   Controlled via `draft`/`onDraftChange`/`onPhoneChange` (all three from
   `useCustomerRecordDraft`) rather than its own local `useState` — same
   "lifted so it survives a tab switch and can drive the Save/Cancel
   footer" reasoning as `CustomerDetailTabContent`'s own doc comment. */
export function CustomerDirectoryTabContent({
  draft,
  onDraftChange,
  onPhoneChange,
}: {
  draft: CustomerRecordDraft;
  onDraftChange: (patch: Partial<CustomerRecordDraft>) => void;
  onPhoneChange: (index: number, patch: Partial<CustomerDirectoryPhoneState>) => void;
}) {
  return (
    <div className="flex flex-col lyra-form-grid-wrap">
      <div className="flex flex-col gap-3 px-4 py-4">
        {/* `max-w-sm` (384px) — same "cap a single full-width-by-default
            field at a sane reading width" convention lyra-ui's own
            Storybook demos use for a lone `Input`/`EmailInput` outside a
            multi-column grid (`Input.stories.tsx`'s `max-w-[400px]`,
            `TagsInput`/`Textarea` stories' `max-w-sm`) — `EmailInput`
            itself has no dedicated width prop; `className` lands on its
            outer wrapper div (email-input.tsx) same as `Input`, so this is
            the standing way to constrain one rather than adding a new
            component prop for it. */}
        <EmailInput
          label="Email"
          value={draft.directoryEmail}
          onChange={(value) => onDraftChange({ directoryEmail: value })}
          className="max-w-sm"
        />
        <Checkbox
          label="Consent"
          checked={draft.emailConsent}
          onCheckedChange={(c) => onDraftChange({ emailConsent: c === true })}
        />
      </div>
      {/* Each phone slot is now its own bordered card
          (`CUSTOMER_INFO_ACCORDION_CLASSNAME` on the `Accordion` inside
          `CustomerDirectoryPhoneRow`), so this wrapper switches from a bare
          `border-t` + flush list (dividers supplied by each row's own
          bottom border) to a gap + padding, matching the Overview/Detail
          tabs' own card-stack spacing. */}
      <div className="flex flex-col gap-4 px-4 pt-3 pb-4">
        {CUSTOMER_DIRECTORY_PHONE_LABELS.map((label, i) => (
          <CustomerDirectoryPhoneRow
            key={label}
            label={label}
            state={draft.phones[i]}
            onChange={(patch) => onPhoneChange(i, patch)}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Customer record draft (Detail/Directory Save/Cancel) ──
   Per explicit request: a Save/Cancel footer that animates into the
   bottom of the Customer Information panel whenever the Detail tab's
   fields or the Directory tab's email/consent/phone slots are edited,
   with Cancel reverting every pending edit. Before this, every one of
   those fields was its own local, uncontrolled `useState` inside
   `CustomerDetailTabContent`/`CustomerDirectoryTabContent`/
   `CustomerDirectoryPhoneRow` — which had two problems for this feature:
   (1) there was nowhere to observe "has anything changed" from outside
   those components, and (2) since the Detail/Directory tabs are only
   rendered while active (`activeTab === ... &&`, see
   `CustomerInformationPanelBody`), switching to a different tab UNMOUNTS
   them, silently discarding whatever was locally typed — no baseline to
   even revert TO. `CustomerRecordDraft` below is the whole editable
   surface lifted into one plain object; `useCustomerRecordDraft` owns it
   plus a separately-tracked saved baseline, so edits now survive tab
   switches and Cancel has something real to restore.

   `overviewFields` (added per a later explicit request) extends this same
   draft to also cover the Overview tab's own "Customer Overview" field
   list (Phone #/Contact #/Email/Balance/Address/City/State/Zip Code) —
   previously plain read-only display rows sourced straight from `fields`
   (`buildCustomerInfoFields`'s own synthesized output), with no edit
   affordance at all. A copy of `fields` at draft-build time, not `fields`
   itself: `fields` stays the immutable synthesized "as if freshly loaded"
   baseline the draft is SEEDED from (and what a Cancel effectively
   reverts back toward, via `savedDraft`), while `overviewFields` is the
   editable, saveable copy. `CustomerDetailTabContent`'s own read-only
   duplicates of some of these same values (Contact #/Total Balance/
   Address 1/City/State/Zip Code) now also read from THIS copy — see that
   component's own render call site — so a saved Overview edit doesn't go
   stale there. */
export interface CustomerRecordDraft {
  originalContactNumber: string;
  firstName: string;
  lastName: string;
  title: string;
  department: string;
  balanceDue: string;
  active: boolean;
  accountBlock: string;
  group: string;
  dueDate: Date | undefined;
  address2: string;
  directoryEmail: string;
  emailConsent: boolean;
  phones: CustomerDirectoryPhoneState[];
  overviewFields: CustomerInfoField[];
}

/** Builds a fresh draft's starting values for one customer record — same
 *  real-data-where-it-exists, blank-default-elsewhere split
 *  `CustomerDetailTabContent`/`CustomerDirectoryTabContent` used to seed
 *  their own local state with (see those components' own now-superseded
 *  doc comments for the field-by-field reasoning). */
function buildCustomerRecordDraft(fields: CustomerInfoField[], customerName?: string): CustomerRecordDraft {
  const { firstName, lastName } = splitCustomerName(customerName);
  const phoneDisplay = getFieldValue(fields, "Phone #");
  return {
    originalContactNumber: "",
    firstName,
    lastName,
    title: "",
    department: "",
    balanceDue: "$0.00",
    active: true,
    accountBlock: "none",
    group: "",
    dueDate: undefined,
    address2: "",
    directoryEmail: getFieldValue(fields, "Email"),
    emailConsent: false,
    phones: CUSTOMER_DIRECTORY_PHONE_LABELS.map((_, i) =>
      i === 0
        ? { phone: phoneValueFromDisplay(phoneDisplay), consentCall: true, consentSms: true, block: "no-block" }
        : { phone: { countryCode: "us", number: "" }, consentCall: false, consentSms: false, block: "no-block" }
    ),
    // Shallow copy — a fresh array/objects, not the same references
    // `fields` holds, so mutating this later (`updateOverviewField`) never
    // reaches back and mutates the caller's own `fields` prop.
    overviewFields: fields.map((field) => ({ ...field })),
  };
}

/** Owns one customer record's Detail/Directory draft plus its last-saved
 *  baseline — called independently by each of `CustomerInformationSidePanel`/
 *  `CustomerRowInfoPanel`/`CustomerInfoHoverPreview` (same "every consumer
 *  builds its own copy of shared per-customer state" convention `fields`/
 *  `latestInteraction`/etc. already use in this file), then threaded down
 *  into `CustomerInformationPanelBody` as a controlled prop. `isDirty`
 *  drives the Save/Cancel footer the two real panels render in their own
 *  `footer` slot — the hover preview doesn't render one (see its own call
 *  site) since it's a transient mouse-hover popover, not a place an agent
 *  parks pending edits.
 *
 *  `isDirty` is reference equality (`draft !== savedDraft`), not a deep
 *  compare: `save`/`cancel` both re-point one of the two state variables
 *  at the exact SAME object the other already holds (not a copy), so
 *  `isDirty` flips back to `false` the instant either fires; any actual
 *  field edit always produces a brand-new object via `updateDraft`'s own
 *  spread, so it can never be accidentally reference-equal to the
 *  baseline again until the next save/cancel. One accepted edge case from
 *  this simplification: editing a field back to its original value still
 *  reads as dirty (no per-field value diffing) — fine for this
 *  prototype's "no real persistence" fields, and better than the
 *  alternative (a real deep-equal on every keystroke across up to 10
 *  phone slots). */
export function useCustomerRecordDraft(
  fields: CustomerInfoField[],
  customerName: string | undefined,
  recordId: string | undefined
) {
  const [savedDraft, setSavedDraft] = useState(() => buildCustomerRecordDraft(fields, customerName));
  const [draft, setDraft] = useState(savedDraft);

  // A genuinely different record is now showing (switched customer/
  // interaction) — start ITS draft fresh rather than carrying over the
  // PREVIOUS record's pending edits (or stale dirty state) onto this one.
  // Keyed on `recordId` alone, not also `fields`/`customerName` — same
  // reasoning `CustomerRowInfoPanel`'s own `row?.contactNumber`-keyed
  // reset effect documents elsewhere in this file: those are fresh
  // object/value references most renders even for the SAME record, so
  // keying on them too would reset this far more often than intended.
  useEffect(() => {
    const fresh = buildCustomerRecordDraft(fields, customerName);
    setSavedDraft(fresh);
    setDraft(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  const updateDraft = (patch: Partial<CustomerRecordDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };
  const updatePhone = (index: number, patch: Partial<CustomerDirectoryPhoneState>) => {
    setDraft((prev) => ({
      ...prev,
      phones: prev.phones.map((phone, i) => (i === index ? { ...phone, ...patch } : phone)),
    }));
  };
  const updateOverviewField = (index: number, value: string) => {
    setDraft((prev) => ({
      ...prev,
      overviewFields: prev.overviewFields.map((field, i) => (i === index ? { ...field, value } : field)),
    }));
  };

  return {
    draft,
    isDirty: draft !== savedDraft,
    updateDraft,
    updatePhone,
    updateOverviewField,
    save: () => setSavedDraft(draft),
    cancel: () => setDraft(savedDraft),
  };
}

/** Save/Cancel footer for the Detail/Directory/Customer Overview tabs'
 *  pending edits — rendered by both `CustomerInformationSidePanel` and
 *  `CustomerRowInfoPanel` (each via their own `footer`/`InteriorPanel`-
 *  `footer` slot) whenever their own `useCustomerRecordDraft` reports
 *  `isDirty` OR the Customer Overview edit button has been clicked (see
 *  each call site's own `recordDraft.isDirty || overviewEditing` check),
 *  per explicit request: appears immediately on either trigger, not just
 *  once a field has actually changed, and stays open regardless of which
 *  tab the agent has since switched to — not scoped to Detail/Directory
 *  being the active tab — until Save or Cancel resolves it (same "keep it
 *  open until resolved" precedent the Agent Leg Disconnected toast
 *  already established). No "You have unsaved changes" copy — per a
 *  follow-up explicit request, the Cancel/Save buttons alone are the
 *  whole footer now (they already only ever appear together with nothing
 *  else in this slot, so the label was redundant). `animate-in
 *  slide-in-from-bottom-2 fade-in-0` gives it the requested "animates
 *  into the bottom of the panel" entrance; no matching exit animation —
 *  `footer`'s own conditional render already unmounts it immediately on
 *  Save/Cancel, same "entrance-only" treatment already used elsewhere in
 *  this file (e.g. the tab-switch "Coming soon" placeholder in
 *  `useSearchPanelContent`). */
function CustomerRecordSaveFooter({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <PanelFooter className="animate-in slide-in-from-bottom-2 fade-in-0 duration-200">
      <Button variant="outline" size="md" onClick={onCancel}>
        Cancel
      </Button>
      <Button size="md" onClick={onSave}>
        Save
      </Button>
    </PanelFooter>
  );
}

/** Copilot tab content — per explicit request, shown whenever the panel's
 *  "Copilot" tab is active: a plain info box giving the agent a one-line
 *  reason the customer is reaching out, plus a "Journey Summary" card
 *  recapping what's led up to this contact. Both pulled from
 *  `buildCopilotSummary` (synthesized, same deterministic-per-customer
 *  approach as Overview's Latest Interaction/Latest Note — see that
 *  function's own doc comment). Purely a read-only recap — the actual
 *  "ask copilot something" affordance is the shared `AIInput` component
 *  (ai-input.tsx) — same component the Overview tab's own footer uses —
 *  pinned to the bottom of this same tab by its caller, not rendered
 *  inline here (see `CustomerInformationSidePanel`'s `footer` prop).
 *
 *  Per explicit follow-up request ("animate in the content in copilot
 *  sequentially after the copilot window opens"), the two blocks below
 *  reveal one after another rather than popping in together: each gets the
 *  same `animate-in fade-in-0 slide-in-from-bottom-1` entrance
 *  `CustomerRecordSaveFooter` above already established for this codebase,
 *  staggered via `tailwindcss-animate`'s `delay-*` utilities (a plain
 *  Tailwind `transitionDelay` scale that plugin also wires up as
 *  `animation-delay` for anything under `animate-in` — no custom CSS
 *  needed). This works as an "on open" reveal with no extra JS/state
 *  because `CopilotTabContent` is only ever mounted while the Copilot tab
 *  is actually active (see this component's call site's `activeTab ===
 *  ...&&` guard) — every fresh mount (tab opened, or landed on directly —
 *  see `copilotAvailable`'s own doc comment on the two places that now
 *  default straight to this tab) is a brand new entrance for the CSS
 *  animation classes to replay, with nothing to reset between opens.
 *
 *  `fill-mode-backwards` on both blocks fixes a flash reported live: by
 *  default `animate-in`'s `animation-fill-mode` is `none`, so during a
 *  `delay-*` (and even the split-second before a non-delayed animation's
 *  first frame paints) the browser renders the element in its plain,
 *  fully-visible resting state — THEN, once the animation actually starts,
 *  it jumps straight to the "from" keyframe (invisible/offset) before
 *  animating back to visible. That "briefly fully visible → sudden
 *  disappear → fade back in" sequence is what read as a flash, worst on the
 *  Journey Summary card since its whole `delay-300` window was spent fully
 *  visible first. `fill-mode-backwards` makes the element hold the "from"
 *  keyframe's styles for the ENTIRE time before its animation starts too,
 *  so both blocks stay invisible from first paint straight through their
 *  delay, with nothing to visually pop before the intended reveal.
 *  `duration-500`/`delay-300` (up from the original `duration-300`/
 *  `delay-150`) per the same follow-up request to slow the pacing down —
 *  a more clearly readable half-second fade+slide each, with a noticeable
 *  pause between the two rather than a rushed back-to-back flicker.
 *
 *  `extra` (per explicit follow-up request — the Marcus Webb scripted
 *  scenario, `AgentWorkspace2WithDeskPage.tsx`) renders BELOW the Journey
 *  Summary card, third in the same staggered reveal (`delay-500`) — a
 *  generic escape hatch rather than any Marcus-specific markup living in
 *  this shared component: that page builds its own decision/steps/wrap-up
 *  cards entirely on its own and just hands the finished `ReactNode` down
 *  through `CustomerInformationPanelBody`/`CustomerInformationSidePanel`'s
 *  own same-named prop. `undefined` for every other caller/interaction —
 *  nothing renders here normally. */
export function CopilotTabContent({ summary, extra }: { summary: CopilotSummary; extra?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 px-4 py-3">
      {/* Reason for contact — plain info box, same background
          `InlineNotification`'s own "info" variant uses
          (`bg-lyra-status-info-subtle`, inline-notification.tsx) but without
          its icon/dismiss chrome: this is a passive one-line summary, not an
          alert the agent needs to acknowledge or dismiss. First to reveal —
          no `delay-*`. */}
      <div className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-backwards duration-500 rounded-lyra-md bg-lyra-status-info-subtle px-4 py-3">
        <p className="lyra-body-md text-lyra-fg-default">{summary.reasonForContact}</p>
      </div>

      {/* Journey Summary — a bordered card with its own soft-purple header
          band (icon + title) over a plain white body, per the reference
          screenshot. `lyra-accent-purple-soft`/`-strong` (tailwind-preset.ts)
          is the same accent pair `Badge`'s `color="purple"` variant resolves
          to (badge.tsx) — used directly here since this is a fixed two-tone
          header bar, not a pill needing that component's full variant
          machinery. Second to reveal — `delay-300` staggers it clearly
          behind the info box above rather than both animating in at once,
          and `fill-mode-backwards` (see this component's own doc comment)
          keeps it invisible for that entire wait instead of flashing fully
          visible first. */}
      <div className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-backwards duration-500 delay-300 overflow-hidden rounded-lyra-md border border-lyra-border-subtle">
        <div className="flex items-center gap-2 bg-lyra-accent-purple-soft px-4 py-2.5">
          <Bookmark className="h-4 w-4 shrink-0 text-lyra-accent-purple-strong" strokeWidth={1.5} aria-hidden="true" />
          <span className="lyra-body-md-emphasis text-lyra-fg-default">Journey Summary</span>
        </div>
        <div className="bg-lyra-bg-surface-base px-4 py-3">
          <p className="lyra-body-md text-lyra-fg-default">{summary.journeySummary}</p>
        </div>
      </div>

      {extra && (
        <div className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-backwards duration-500 delay-500">
          {extra}
        </div>
      )}
    </div>
  );
}

export function CustomerInformationPanelBody({
  activeTab,
  customerName,
  latestInteraction,
  latestNote,
  copilotSummary,
  copilotExtra,
  recordId,
  channels,
  onOpenConversation,
  onViewAllInteractions,
  draft,
  onDraftChange,
  onPhoneChange,
  onOverviewFieldChange,
  overviewEditing = false,
  onOverviewEditingChange = () => {},
  allowOverviewEdit,
  row,
  onStartInteraction,
}: {
  activeTab: number;
  /** Overview's "Open Conversation" deep link (Latest Interaction
   *  accordion) — opens the newest past session's conversation as a TAB in
   *  the interaction space (record header), not inside this panel. Only
   *  the real side panel passes it; the hover preview doesn't. */
  onOpenConversation?: (entry: CustomerHistorySessionEntry) => void;
  /**
   * Overview's "View All Contacts" button (Latest Interaction
   * accordion, directly below "Open Conversation") — switches THIS SAME
   * panel over to its own "Contacts" tab (labeled "Interactions" until a
   * later explicit follow-up request renamed it), per explicit request.
   * Unlike `onOpenConversation` above (which opens a whole separate tab in
   * the interaction space), this stays entirely within the panel the agent
   * is already looking at — so every caller that owns `activeTab`/
   * `setActiveTab` (the real side panel, the hover preview, and the
   * Customers-table row panel alike) can wire this the same simple way:
   * `() => setActiveTab(CUSTOMER_PANEL_TABS.indexOf("Contacts"))`.
   * Gated at the render site below on `recordId` (not
   * `customerHistoryEntries.length`, unlike `onOpenConversation`) — the
   * Contacts tab itself is always worth switching to once a real
   * record exists, even for a customer with zero synthesized entries
   * (`CustomerHistoryTabContent`'s own empty state already covers that
   * case), whereas "Open Conversation" specifically needs a real newest
   * entry to open.
   */
  onViewAllInteractions?: () => void;
  /** Needed here (not just by `buildCustomerInfoFields`) for the
   *  Contacts tab's synthesized history (`buildCustomerHistoryEntries`
   *  below) — no longer threaded into the Detail tab directly, since that
   *  tab's First Name/Last Name now come from `draft` (seeded from this
   *  same `customerName` once, at draft-build time — see
   *  `buildCustomerRecordDraft`). */
  customerName?: string;
  /** Built per-interaction by `buildLatestInteraction` — see that
   *  function's own doc comment. */
  latestInteraction: CustomerLatestInteraction;
  /** Built per-interaction by `buildLatestNote` — see that function's own
   *  doc comment. Renders as its own accordion directly below Latest
   *  Interaction (see the "Latest Interaction"/"Latest Note" column
   *  comment below). */
  latestNote: CustomerLatestNote;
  /** Built per-interaction by `buildCopilotSummary` — see that function's
   *  own doc comment. Feeds the Copilot tab (`CopilotTabContent`). */
  copilotSummary: CopilotSummary;
  /** Passed straight through to `CopilotTabContent`'s own same-named prop —
   *  see that prop's own doc comment. Only `CustomerInformationSidePanel`
   *  ever sets this to a real value (the Marcus Webb scripted scenario,
   *  `AgentWorkspace2WithDeskPage.tsx`); every other caller leaves it
   *  `undefined`. */
  copilotExtra?: React.ReactNode;
  /** Supplied by every real consumer of this body — `CustomerInformationSidePanel`
   *  and `CustomerInfoHoverPreview` pass a real active interaction's own
   *  `recordId`/`channels`; `CustomerRowInfoPanel` (Customers-table row, no
   *  actually-open `Thread[]` of its own — a row was never opened
   *  as a real interaction) passes its own `recordId` with `channels={[]}`,
   *  which `buildCustomerHistoryEntries` already treats as "synthesize
   *  everything, nothing to prefer" — per explicit request, ALL THREE now
   *  show real (synthesized) Contacts-tab content, not just the two
   *  with a genuine active interaction behind them. Left truly `undefined`
   *  only if some future consumer has no record at all to show — see the
   *  Contacts-tab branch below, which still gates on `recordId` being
   *  falsy specifically (not on `channels`) for exactly that case. */
  recordId?: string;
  channels?: Thread[];
  /** Detail/Directory tabs' controlled draft — from the caller's own
   *  `useCustomerRecordDraft(fields, customerName, recordId)` (see that
   *  hook's own doc comment). Threaded straight through to
   *  `CustomerDetailTabContent`/`CustomerDirectoryTabContent` below rather
   *  than owned here, so `isDirty`/`save`/`cancel` stay visible to
   *  whichever caller renders the actual Save/Cancel footer (this body
   *  has no `footer` slot of its own to put it in). */
  draft: CustomerRecordDraft;
  onDraftChange: (patch: Partial<CustomerRecordDraft>) => void;
  onPhoneChange: (index: number, patch: Partial<CustomerDirectoryPhoneState>) => void;
  /** Edits one row of `draft.overviewFields` by index — see that field's
   *  own doc comment on `CustomerRecordDraft`. */
  onOverviewFieldChange: (index: number, value: string) => void;
  /** Whether the "Customer Overview" field list is currently showing real
   *  inputs (toggled by the ghost Edit button rendered above the first
   *  field) rather than plain read-only rows. Controlled by the caller —
   *  not local state here — because the caller (whichever of the two real
   *  panels renders the Save/Cancel footer) needs to know this too: per
   *  explicit request, the footer now appears the instant this flips
   *  `true` (clicking Edit), not only once a field has actually been
   *  changed. Defaults to `false` via the destructured default below for
   *  `CustomerInfoHoverPreview`, which never toggles it (omits
   *  `allowOverviewEdit`, so the button that would flip it never renders). */
  overviewEditing?: boolean;
  /** Fired when the ghost Edit button is clicked (toggles) — the caller
   *  owns the actual state (see `overviewEditing`'s own doc comment just
   *  above) and is also responsible for resetting it back to `false` on
   *  Save/Cancel and on switching to a different record; this body only
   *  ever asks to flip it. Omitted (defaults to a no-op) for
   *  `CustomerInfoHoverPreview`, which never renders the button that would
   *  call it. */
  onOverviewEditingChange?: (editing: boolean) => void;
  /** Whether this consumer should offer the "Customer Overview" edit
   *  button at all — per explicit request, only the two real panels
   *  (`CustomerInformationSidePanel`/`CustomerRowInfoPanel`, both of
   *  which also render the Save/Cancel footer this needs) do;
   *  `CustomerInfoHoverPreview` omits it (defaults to `undefined`/falsy)
   *  since it's a transient mouse-hover popover with no footer of its own
   *  to commit or cancel an edit through. */
  allowOverviewEdit?: boolean;
  /** Per explicit request ("move the contact icon buttons into the
   *  customer overview and put them next to the edit button in a row
   *  above the other information") — the row this customer came from,
   *  feeding `CustomerAddChannelButton` (always its "wide" one-button-
   *  per-channel shape here, matching `CustomerFullScreenTabContent`'s
   *  own prior header usage) so the channel launch buttons live inside
   *  this card's own top row instead of the panel/tab header. `undefined`/
   *  `null` for every consumer with no such row to launch a channel
   *  from — `CustomerInformationSidePanel` (an already-open interaction,
   *  never had these buttons at all) and `CustomerInfoHoverPreview`
   *  (never offered `allowOverviewEdit` either) simply omit this, and the
   *  new top row renders with no channel buttons in it (just the Edit
   *  button, if `allowOverviewEdit` is set) — same as `CustomerAddChannelButton`
   *  itself already does for a `null` row (see that component's own doc
   *  comment). */
  row?: CustomerListRecord | null;
  /** Required whenever `row` is a real (non-null) record — same signature
   *  `CustomerAddChannelButton` itself takes, just forwarded straight
   *  through. Optional here (not required outright) only so a consumer
   *  that never passes `row` doesn't also have to pass a never-called
   *  handler. */
  onStartInteraction?: (contact: CreateNewOutboundContact, channel: ChannelType, phone: string, skillId: string) => void;
}) {
  // Controlled (not `defaultValue`, unlike Latest Interaction beside it)
  // specifically so the stacked column below knows whether Latest Note
  // itself is open — needed to gate its own `flex-1` height-matching growth
  // (see that Accordion's own comment) off while it's collapsed. Growing a
  // COLLAPSED card to fill the column's full stretched height would stretch
  // its little closed header row across a tall box with a big dead gray gap
  // below it instead of matching content — the exact failure mode this
  // file's own `bothCardsOpen` gate was originally written to avoid for the
  // two cards' old side-by-side row (see git history), reapplied here to
  // just the one trailing card that actually needs it now.
  const [latestNoteAccordionValue, setLatestNoteAccordionValue] = useState("latest-note");
  const latestNoteOpen = latestNoteAccordionValue !== "";
  // Same controlled pattern, same reasoning, for Customer Overview itself —
  // per explicit follow-up request, height-matching between the two
  // COLUMNS now has to work in BOTH directions: Customer Overview used to
  // be assumed the reliably-taller side (see `CUSTOMER_INFO_ACCORDION_
  // CLASSNAME`'s `h-fit` on it, still the default height), with only the
  // right-hand stacked column ever growing to match it. Adding "View All
  // Contacts" to Latest Interaction can now push the RIGHT column
  // taller instead for some customers (a long field list isn't guaranteed
  // to stay the taller side any more) — so Customer Overview needs the
  // exact same "stay `h-fit` while collapsed, grow to match while open"
  // toggle Latest Note already has, just applied to the ROW's cross axis
  // (height, via the row's own default `align-items: stretch`) instead of
  // a COLUMN's main axis (see that Accordion's own `flex-1 h-auto` comment
  // for the axis distinction) — no `flex-1` needed here for that reason,
  // just clearing `h-fit` to `h-auto` is enough to let the row's existing
  // stretch behavior size it to match whichever side is actually taller.
  const [customerOverviewAccordionValue, setCustomerOverviewAccordionValue] = useState("customer-overview");
  const customerOverviewOpen = customerOverviewAccordionValue !== "";

  // Contacts tab — this customer's synthesized session history
  // (`CustomerHistoryTabContent`/`CustomerHistorySessionDetailPanel`, see
  // that section's own doc comment) — was a separate, independently-
  // selectable "Customer History" tab in the record header before, moved in
  // here per explicit request so it's just another tab of this same panel.
  // State lives locally in this component (not lifted to `AgentNextGenPage`
  // the way it used to be) because this whole component already remounts on
  // a genuine interaction switch via its caller's own
  // `key={`side-panel-${activeInteraction.id}`}` wrapper — the exact same
  // "survives navigate-away-and-back to the SAME interaction, resets on a
  // genuinely different one" behavior the old lifted state was hand-rolling
  // via a ref-based identity check, now free from the remount itself.
  // `undefined` while `recordId` isn't supplied (see that prop's own doc
  // comment) — this tab renders nothing at all in that case, so the
  // synthesized-entries memo just yields an empty array and nothing below
  // ever reads `selectedHistoryIndex`.
  const customerHistoryEntries = useMemo(
    () => (recordId ? buildCustomerHistoryEntries(customerName, recordId, channels ?? []) : []),
    [customerName, recordId, channels]
  );
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number | null>(null);
  const selectedHistoryEntry = selectedHistoryIndex !== null ? customerHistoryEntries[selectedHistoryIndex] ?? null : null;

  const handleHistoryNav = (direction: 1 | -1) => {
    setSelectedHistoryIndex((prev) => {
      if (prev === null) return prev;
      const next = prev + direction;
      if (next < 0 || next >= customerHistoryEntries.length) return prev;
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* `h-full min-h-0` — unconditional, every tab, not just gated to
          Contacts. Two earlier attempts at giving Contacts its own
          independently-scrolling box (one gated to just this tab, one
          unconditional like this) both failed live — but the actual root
          cause turned out to be one level up, not here: `SidePanel`'s own
          pinned/docked branch (side-panel.tsx) was missing the `h-full`
          its unpinned/full-screen branch already had, so `PanelContent`
          above this wrapper never reliably had a DEFINITE height to give
          it in docked mode specifically (confirmed by the exact symptom
          reported: full-screen scrolled fine, docked didn't — full-screen
          reaches its height a completely different way, `position:
          absolute` against `Container`'s own unambiguous flex-grow height,
          which was never affected by the bug). With that fixed at its
          actual source, this wrapper's own `h-full` now resolves correctly
          again — every tab gets a real box matching `PanelContent`'s
          available height (harmless for Overview/Detail/etc., which just
          overflow it normally with no clipping, same as always), and the
          Contacts tab below gets a genuinely bounded box to build its
          own internal list-scroll + overlaying detail panel on top of. */}
      {/* No avatar/name/presence block here — the InteriorPanel's own
          header (`headerTitle="Customer Information"` +
          `headerSubhead="{name} · {id}"`) already shows the name, so a
          second name+avatar block right below it was redundant.

          No tabs here either anymore — they used to live at the top of
          this same scrolling body, pinned via a hand-rolled `sticky`
          wrapper (see the git history / CONTRIBUTING.md's "Composing
          panel body content" for the full story of why that was wrong:
          the surrounding scroll container's own scrollbar still ran
          alongside a merely-`sticky` row, and `TabList`'s "N More"
          overflow menu had its own separate bug where selecting a tab
          from it silently did nothing once the row collapsed, fixed in
          tabs.tsx). They now render inside the header itself via
          `SidePanel`'s `headerTabs` prop — see
          `CustomerInformationSidePanel` below, which owns the
          `activeTab` state both this body and that header tab row need
          and passes this component just the number.

          This field list and the Customer Overview/Latest Interaction/
          Latest Note block below it are now both explicitly gated to the
          Overview tab (`activeTab === ...indexOf("Overview")`) —
          previously only the accordions had that gate, so this list
          rendered on every tab, including the new Detail tab added below,
          which shows its own full editable version of the same fields
          (`CustomerDetailTabContent`) and would otherwise show them twice.

          Layout (per explicit follow-up request): Customer Overview is now
          its own full-width row on top; Latest Interaction and Latest Note
          share one `.lyra-card-split-wrap`/`.lyra-card-split` row below it
          (see lyra-tokens.css) — reusing the same family `DashboardCard`
          bodies already use for "a couple of regions side by side,
          stacking once the container's own width gets tight" rather than
          inventing a new one (its ≤480px threshold already fits here on
          both ends: this panel's normal resizable range, ~350–425px per
          `InteriorPanel`'s own min/max defaults, stays comfortably under
          it — single column, unchanged from before this existed — and
          `allowFullScreen`'d width is easily past it — side by side).
          (Earlier arrangement, superseded here: Latest Interaction paired
          with Customer Overview in the split row, Latest Note full-width
          below both — moved per this follow-up request so Latest
          Interaction sits directly left of Latest Note instead.)

          Top/bottom order (both row and stacked state) falls straight out
          of plain DOM order — flexbox doesn't reverse either axis without
          an explicit `row-reverse`/`column-reverse`, so whichever child
          comes FIRST in the JSX is the TOP block regardless of state here
          (Customer Overview, full width, has no row-state sibling to sit
          left/right of). `align-items: stretch` (the split family's own
          default) is harmless here specifically because `Accordion`'s own
          root has no `h-full`/`flex-1` of its own (accordion.tsx) — a
          stretched flex item just leaves invisible empty space below its
          natural-height content, not a visibly over-tall bordered box.

          Unlike `.lyra-container-grid`/`.lyra-form-grid`, `.lyra-card-
          split` does NOT put `flex: 1 1 0%` on its children automatically
          — that family's own two optional modifiers (`.lyra-card-split-
          fixed`, a deliberately fixed 12rem column; `.lyra-card-split-
          chart`, `flex: 1 1 0%` for the region beside it) exist precisely
          because its usual pairing is one fixed-width region next to one
          flexible one, not two equal columns. Left as plain children, the
          two `Accordion`s took their own natural content width instead,
          rendering visibly unequal (each has its own different content
          length). The `.lyra-card-split-even` modifier (lyra-tokens.css)
          on both fixes that, splitting the row evenly (and correctly
          resetting back to full-width at the stacked stage, same as
          `.lyra-container-grid`/`.lyra-form-grid`'s own children — see
          that modifier's own doc comment for why a bare `flex-1` utility
          class alone isn't enough here).

          Gap consistency (per explicit request — rows and columns both
          16px): the outer `flex flex-col gap-4` below already puts 16px
          between Customer Overview and the split row. `.lyra-card-split`'s
          own shared rule (lyra-tokens.css) defaults to `gap: 1.5rem`
          (24px) — correct for its other consumers, but inconsistent with
          this 16px if left alone. Overridden here via an inline `style`
          (not a Tailwind class) specifically because `.lyra-card-split`'s
          `gap` comes from a plain CSS class, not a Tailwind utility —
          `cn()`/`tailwind-merge` only dedupes genuine Tailwind utility
          conflicts, so a `gap-4` class alongside `lyra-card-split` would
          just tie in specificity with it and depend on stylesheet source
          order to win, the exact fragility CONTRIBUTING.md already warns
          about elsewhere in this file. An inline style has no such
          ambiguity — it always wins. Applies identically whether the row
          is side-by-side or (≤480px) stacked to a column, since inline
          styles aren't scoped to a breakpoint the way the shared class's
          own `@container` rule is — 16px either way, matching the 16px
          above it. */}
      {activeTab === CUSTOMER_PANEL_TABS.indexOf("Overview") && (
        <div className="px-4 py-3 flex flex-col gap-4">
          {/* Customer Overview now sits directly LEFT of a stacked Latest
              Interaction/Latest Note column (per explicit request) — was a
              full-width block on its own row above that pair, back when
              Latest Interaction and Latest Note were side-by-side beneath
              it instead of stacked. Reuses the same `.lyra-card-split-wrap`/
              `.lyra-card-split`/`.lyra-card-split-even` family the two-
              column Latest Interaction/Latest Note row already used for "a
              couple of regions side by side, stacking once the container's
              own width gets tight" (see that modifier's own doc comment in
              lyra-tokens.css) — just with two DIFFERENT regions as the
              row's two children now: this Accordion on the left, and the
              new stacked wrapper below on the right, rather than each half
              being one Accordion the way the old row was. Its ≤480px
              stacking threshold still fits here: at the panel's normal
              resizable width (~325–425px) it stacks to a column (Customer
              Overview on top, matching the old top-to-bottom reading order),
              and `allowFullScreen`'d width stays comfortably side by side. */}
          <div className="lyra-card-split-wrap">
            <div className="lyra-card-split" style={{ gap: "1rem" }}>
              {/* Customer Overview field list. Wrapped in a neutral
                  container (`bg-lyra-bg-control-subtle`, rounded) per
                  CONTRIBUTING.md's "Composing panel body content"
                  convention, rather than sitting flush against the panel
                  background — the convention to follow for any future
                  card-like block added here, not a one-off choice for this
                  block alone. Collapsible via lyra-ui's `Accordion` (single
                  item, open by default) rather than a plain static block,
                  so the panel can be collapsed once read.

                  Height-matching now goes BOTH ways, per explicit follow-up
                  request — this used to stay unconditionally `h-fit` (its
                  own natural content height, from `CUSTOMER_INFO_ACCORDION_
                  CLASSNAME`) on the assumption its own field list was
                  reliably the taller side, with only the stacked column on
                  the right ever growing to match it. That assumption broke
                  once "View All Contacts" made the right column taller
                  for some customers — so this now clears `h-fit` to
                  `h-auto` (via `customerOverviewOpen`, controlled the same
                  way `latestNoteOpen` is — see that state's own comment)
                  whenever it's open, letting the row's own default
                  `align-items: stretch` size it to match whichever side is
                  actually taller, same mechanism the stacked wrapper below
                  already relied on for the other direction. Stays `h-fit`
                  while collapsed (same reasoning `latestNoteOpen`'s own gate
                  documents) so collapsing this card doesn't leave it
                  stretched into a tall box with a dead gap below its closed
                  header row. */}
              <Accordion
                className={cn(
                  CUSTOMER_INFO_ACCORDION_CLASSNAME,
                  "lyra-card-split-even",
                  customerOverviewOpen && "h-auto"
                )}
                value={customerOverviewAccordionValue}
                onValueChange={setCustomerOverviewAccordionValue}
                items={[
                  {
                    id: "customer-overview",
                    title: "Customer Overview",
                    content: (
                      <div className="flex flex-col gap-3">
                        {/* Channel launch buttons + Edit, together in one row
                            above the field list — per explicit request
                            ("move the contact icon buttons into the customer
                            overview and put them next to the edit button in
                            a row above the other information"). Previously
                            the channel buttons lived in the panel/tab
                            header's own `headerActions`/`actions`
                            (`CustomerRowInfoPanel`/`CustomerFullScreenTabContent`
                            — see each call site's own doc comment on `row`/
                            `onStartInteraction` below) and Edit sat alone
                            below the LAST field row; both now share this one
                            row instead. Only rendered while NOT editing —
                            same reasoning the Edit button itself already
                            had (see `allowOverviewEdit`'s own doc comment):
                            once editing starts, Save/Cancel in the footer
                            are the only way back out, and launching a new
                            channel mid-edit would be a confusing detour.
                            `justify-between` splits the channel buttons
                            (left) from Edit (right) — matches the reference
                            screenshot's layout. */}
                        {((row && !overviewEditing) || (allowOverviewEdit && !overviewEditing)) && (
                          <div className="flex items-center justify-between gap-2">
                            {/* `gap-1` (4px) between the channel buttons
                                themselves — per explicit request ("make the
                                gap between the buttons 4px") — distinct from
                                the wrapping row's own `gap-2`/`justify-
                                between`, which is the (much larger) space
                                between this whole button cluster and Edit. */}
                            <div className="flex items-center gap-1">
                              {row && (
                                <CustomerAddChannelButton
                                  row={row}
                                  isNarrow={false}
                                  onStartInteraction={onStartInteraction!}
                                />
                              )}
                            </div>
                            {allowOverviewEdit && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onOverviewEditingChange(true)}
                                className="gap-1.5"
                              >
                                <Pencil className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                                Edit
                              </Button>
                            )}
                          </div>
                        )}
                        {draft.overviewFields.map((field, index) => (
                          <div key={field.label} className="flex flex-col gap-3">
                            {overviewEditing ? (
                              // Standard, vertical (label-above-field) form
                              // fields while editing — per explicit
                              // follow-up request, no longer the read-only
                              // row's own "label left, value right"
                              // horizontal layout. Each field component
                              // supplies its own `label` now (rendered
                              // above the field by the component itself),
                              // so there's no separate standalone `Label`
                              // here the way the read-only row below still
                              // has. "Phone #"/"Email" specifically use the
                              // real `PhoneInput`/`EmailInput` components
                              // (per explicit request) rather than a plain
                              // `Input` — `PhoneInput` needs a `PhoneValue`,
                              // not the plain string `overviewFields`
                              // stores, so it round-trips through
                              // `phoneValueFromDisplay`/`phoneDisplayFromValue`
                              // (agent-next-gen-shared-utils.ts) on the way
                              // in/out; `EmailInput` already takes/returns a
                              // plain string, same as `overviewFields`
                              // itself, so no conversion is needed there.
                              field.label === "Phone #" ? (
                                <PhoneInput
                                  label={field.label}
                                  value={phoneValueFromDisplay(field.value)}
                                  onChange={(phone) => onOverviewFieldChange(index, phoneDisplayFromValue(phone))}
                                />
                              ) : field.label === "Email" ? (
                                <EmailInput
                                  label={field.label}
                                  value={field.value}
                                  onChange={(value) => onOverviewFieldChange(index, value)}
                                />
                              ) : (
                                <Input
                                  label={field.label}
                                  value={field.value}
                                  onChange={(e) => onOverviewFieldChange(index, e.target.value)}
                                />
                              )
                            ) : (
                              // `whitespace-nowrap` (previously on the value
                              // span below) was a real, shipped bug — lyra-ui's
                              // own reference for this exact row shape
                              // (Input.stories.tsx's "Label Horizontal With
                              // Separator") has no such override and wraps a
                              // long value fine by default; this app-level
                              // copy added `whitespace-nowrap` on top of it,
                              // which forced even a normal multi-word value
                              // onto one line and let it silently overflow
                              // past the panel's own right edge. Removed, plus
                              // `break-words` (wraps a value with no spaces at
                              // all to break too, e.g. a long email address —
                              // default word-wrapping alone only breaks at
                              // space boundaries, which a single unbroken
                              // string like an email has none of) and
                              // `min-w-0` on the value span (a flex item's
                              // default `min-width: auto` refuses to shrink
                              // below its own unwrapped content width no
                              // matter what wrapping rule is set, which would
                              // silently defeat `break-words` on its own).
                              // `<Label>` gets `flex-shrink-0` so it keeps its
                              // own natural single-line width and only the
                              // value column ever wraps.
                              <div className="flex items-start justify-between gap-4">
                                <Label label={field.label} className="flex-shrink-0" />
                                <span className="lyra-body-md text-lyra-fg-secondary break-words min-w-0">
                                  {/* Only "Phone #" is ever phone-shaped here
                                      — `formatPhoneForDisplay` is scoped to
                                      that one field (rather than applied to
                                      every row unconditionally) so an
                                      unrelated all-digit value (e.g. a zip
                                      code) is never mistaken for a phone
                                      number and reformatted incorrectly. */}
                                  {field.label === "Phone #" ? formatPhoneForDisplay(field.value) : field.value}
                                </span>
                              </div>
                            )}
                            {!overviewEditing && index < draft.overviewFields.length - 1 && <Separator />}
                          </div>
                        ))}
                      </div>
                    ),
                  },
                ]}
              />

              {/* Latest Interaction stacked directly ABOVE Latest Note (per
                  explicit request) — was side-by-side with it in its own
                  row below Customer Overview before; now the two share this
                  plain flex column instead, which is itself the second
                  (right) child of the Customer Overview split row above.
                  `lyra-card-split-even` goes on THIS wrapper (a direct
                  child of `.lyra-card-split`), not on the two Accordions
                  inside it — they're no longer direct children of the split
                  row themselves, just plain stacked flex-column children.

                  `align-items: stretch` (the split row's own default)
                  stretches this wrapper's HEIGHT to match the row's cross
                  size — since it has no explicit height of its own to opt
                  out with, unlike each side's own Accordion, which opts
                  BACK out to `h-fit` whenever collapsed (Customer Overview's
                  own `customerOverviewOpen`/Latest Note's own
                  `latestNoteOpen` gates — see each Accordion's own comment).
                  While open, the row's cross size is simply the max of the
                  two sides' natural content heights, and BOTH sides now grow
                  to match it (Customer Overview via the row's cross axis
                  directly, this wrapper's own stacked column via Latest
                  Note's `flex-1` below) — so whichever side is actually
                  taller for a given customer, the other one grows to match
                  it, not just one fixed "always taller" side. That alone
                  only gets the outer wrapper box to the right total height,
                  though — a plain `flex-col` of two natural-height
                  Accordions doesn't automatically grow its own children to
                  fill that extra space, so without more, the wrapper would
                  just end in blank unbordered space below Latest Note
                  instead of the two columns visually lining up (confirmed
                  live — this was the very next thing reported). Latest
                  Note's own `flex-1` (see that Accordion's own comment
                  below) is what actually closes that gap, growing ITS
                  bordered box to absorb the leftover height so the stack's
                  own bottom edge lines up with Customer Overview's — same
                  "stretch a card's own box to fill available height, even
                  past its natural content" mechanism this file's own
                  `bothCardsOpen`/`h-auto` used for the two cards' old
                  side-by-side row, just applied to one trailing card in a
                  column instead of two peer cards in a row. */}
              <div className="flex flex-col gap-4 lyra-card-split-even">
                {/* Its trigger renders the "Latest Interaction" title
                    itself — no hand-styled label needed here at all, which
                    also fixes an earlier mistake: that label used to be a
                    hand-built `uppercase tracking-wide` span, applying an
                    all-caps CSS transform to change how it displayed
                    instead of just typing it correctly — exactly the thing
                    CONTRIBUTING.md §17 ("Field label casing") says not to
                    do ("don't add `text-transform`; type the label text
                    correctly to begin with"). Typing the string as
                    `"Latest Interaction"` (already correct Title Case) and
                    letting the shared component's own typography render it
                    is the fix, not restyling it further.

                    Content itself comes from `latestInteraction` (built by
                    `buildLatestInteraction`) rather than one fixed
                    placeholder blurb — see that function's own doc comment
                    for why (it used to be the exact same "Asked about
                    upgrading her plan..." summary for every customer,
                    gendered pronoun and all, regardless of who was actually
                    open).

                    Status used to render as its own pill `Badge` sitting to
                    the right of the timestamp line — reverted per explicit
                    request (a filled pill there read as too visually loud/
                    noticeable). Now a plain second line directly below the
                    timestamp: a small circle `Badge` dot (`shape="circle"
                    dot"`, colored via `statusVariant` the same semantic-role
                    vocabulary `ContactHistoryStatusVariant`/Contact
                    History's own status dots already use) plus the status
                    name as plain text next to it — quieter than a filled
                    pill, same "dot + label" idiom already established
                    elsewhere in this file. */}
                <Accordion
                  className={CUSTOMER_INFO_ACCORDION_CLASSNAME}
                  defaultValue="latest-interaction"
                  items={[
                    {
                      id: "latest-interaction",
                      title: "Latest Interaction",
                      content: (
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1.5 lyra-body-sm text-lyra-fg-secondary">
                              <Clock className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                              {latestInteraction.timeAgo} · {latestInteraction.channel}
                            </span>
                            <span className="inline-flex items-center gap-1.5 lyra-body-sm text-lyra-fg-secondary">
                              <Badge shape="circle" dot size="sm" variant={latestInteraction.statusVariant} aria-hidden="true" />
                              {latestInteraction.status}
                            </span>
                          </div>
                          <p className="lyra-body-md text-lyra-fg-default">{latestInteraction.summary}</p>
                          <span className="lyra-body-sm text-lyra-fg-secondary">
                            {latestInteraction.caseId} · Handled by {latestInteraction.handledBy}
                          </span>
                          {/* Deep link: the single most common history lookup
                              ("what happened last time?") in ONE click from the
                              panel's landing tab — opens the newest past
                              session's conversation as a tab in the
                              INTERACTION SPACE (record header), full reading
                              width, per explicit request. Only rendered when
                              the owner wired it (real side panel, not the
                              hover preview) and entries exist. */}
                          {onOpenConversation && customerHistoryEntries.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="self-start"
                              onClick={() => onOpenConversation(customerHistoryEntries[0])}
                            >
                              Open Conversation
                              <ChevronRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                            </Button>
                          )}
                          {/* "View All Contacts" — per explicit
                              request, an outline button (visually distinct
                              from "Open Conversation"'s own plain `ghost`
                              styling right above it) that switches this
                              same panel over to its "Contacts" tab
                              rather than opening a separate one — see
                              `onViewAllInteractions`'s own doc comment for
                              why its gate (`recordId`) differs from "Open
                              Conversation"'s (`customerHistoryEntries.
                              length > 0`). */}
                          {onViewAllInteractions && recordId && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="self-start"
                              onClick={onViewAllInteractions}
                            >
                              View All Contacts
                            </Button>
                          )}
                        </div>
                      ),
                    },
                  ]}
                />

                {/* Latest Note — directly below Latest Interaction (per
                    explicit request). Same neutral-container + collapsible-
                    Accordion treatment as Latest Interaction above it (see
                    that block's own comments for the container/collapsible
                    rationale — applies identically here), synthesized by
                    `buildLatestNote` the same deterministic-per-customer
                    way. No status `Badge` here — notes don't carry a
                    resolution status the way an interaction does — just the
                    author + relative time, same placement
                    `latestInteraction`'s case-id/handled-by line uses.

                    `flex-1` (only while open — see `latestNoteOpen`) is
                    what actually makes the stacked column's own stretched
                    height (from the split row's `align-items: stretch`,
                    see the wrapper's own comment above) show up as a real,
                    visibly-taller bordered box instead of invisible space
                    below it — growing THIS card, specifically, rather than
                    Latest Interaction above it, so the trailing card in the
                    stack is the one that absorbs the leftover height,
                    matching Customer Overview's own bottom edge. `h-auto`
                    alongside it clears `CUSTOMER_INFO_ACCORDION_CLASSNAME`'s
                    own `h-fit` for the same reason it did on the two cards'
                    old side-by-side row (see that history for the full
                    "h-fit silently overriding stretch" explanation) — this
                    is a flex-COLUMN growing on the main axis (height) this
                    time rather than a flex-ROW stretching on the cross axis,
                    but an explicit `h-fit` risks the same kind of fight
                    with the flex algorithm either way, so it's cleared here
                    too rather than assumed harmless. */}
                <Accordion
                  className={cn(CUSTOMER_INFO_ACCORDION_CLASSNAME, latestNoteOpen && "flex-1 h-auto")}
                  value={latestNoteAccordionValue}
                  onValueChange={setLatestNoteAccordionValue}
                  items={[
                    {
                      id: "latest-note",
                      title: "Latest Note",
                      content: (
                        <div className="flex flex-col gap-3">
                          <span className="inline-flex items-center gap-1.5 lyra-body-sm text-lyra-fg-secondary">
                            <FileText className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                            {latestNote.timeAgo}
                          </span>
                          <p className="lyra-body-md text-lyra-fg-default">{latestNote.note}</p>
                          <span className="lyra-body-sm text-lyra-fg-secondary">By {latestNote.author}</span>
                        </div>
                      ),
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === CUSTOMER_PANEL_TABS.indexOf("Copilot") && (
        <CopilotTabContent summary={copilotSummary} extra={copilotExtra} />
      )}

      {activeTab === CUSTOMER_PANEL_TABS.indexOf("Contacts") && recordId && (
        // `relative flex flex-1 min-h-0 overflow-hidden` — restored (was
        // briefly simplified away to plain `relative` while chasing what
        // turned out to be an unrelated bug one level up — see the outer
        // wrapper's own comment above). This is the shape that was always
        // intended: a flex ROW, bounded to this tab's own share of the
        // panel's real available height (`min-h-0` off the now-reliably-
        // definite `h-full` chain above).
        //   - `relative` gives `CustomerHistorySessionDetailPanel` (a
        //     right-docked `InteriorPanel`) the positioning context it
        //     needs to dock within THIS box specifically, not the whole
        //     app shell.
        //   - At this panel's normal docked/popover widths (well under
        //     `InteriorPanel`'s own 1024px `isNarrow` threshold), that
        //     panel renders via its absolute-overlay branch — floating on
        //     TOP of the list below, not pushing it down, and (now that
        //     this box has a real bounded height instead of an arbitrary
        //     content-driven one) sized to the actual visible area instead
        //     of the full unscrolled list height — which is what was
        //     causing the reported "double scroll"/cut-off-with-room-to-
        //     spare symptoms: an absolutely-positioned `h-full` matching a
        //     content-driven ancestor's height is exactly as tall as ALL
        //     the (possibly very long) list content, not the viewport.
        //   - At real full-screen width (≥1024px, `allowFullScreen`'d),
        //     that same panel switches to its normal inline branch instead
        //     — and because THIS wrapper is a flex ROW (not a plain block),
        //     that inline panel sits beside `CustomerHistoryTabContent` as
        //     a true side-by-side dock, not stacked below it (a plain
        //     block wrapper, as this briefly was, stacks block children
        //     vertically instead — confirmed live as the "session details
        //     opening below the list in full screen" report).
        //   - `CustomerHistoryTabContent`'s own `flex-1 min-h-0 overflow-
        //     hidden` root (see that component) is what then gives its
        //     list a real box to scroll independently WITHIN — a single
        //     scroll, not the double-scroll this box's earlier, unbounded
        //     `relative`-only version produced (list content overflowing
        //     into the page's own scroll AND the detail panel separately
        //     trying to scroll its own oversized box).
        <div className="relative flex flex-1 min-h-0 overflow-hidden">
          <CustomerHistoryTabContent
            entries={customerHistoryEntries}
            selectedIndex={selectedHistoryIndex}
            onSelectIndex={setSelectedHistoryIndex}
          />
          <CustomerHistorySessionDetailPanel
            entry={selectedHistoryEntry}
            onClose={() => setSelectedHistoryIndex(null)}
            onPrevious={() => handleHistoryNav(-1)}
            onNext={() => handleHistoryNav(1)}
            hasPrevious={selectedHistoryIndex !== null && selectedHistoryIndex > 0}
            hasNext={selectedHistoryIndex !== null && selectedHistoryIndex < customerHistoryEntries.length - 1}
          />
        </div>
      )}

      {activeTab === CUSTOMER_PANEL_TABS.indexOf("Detail") && (
        /* `draft.overviewFields`, not the raw `fields` prop — the Detail
           tab's own readonly Contact #/Total Balance/Address 1/City/
           State/Zip Code duplicates now track whatever the Overview tab's
           editable copy of those same fields currently holds (including a
           still-pending, not-yet-saved edit), not the original synthesized
           snapshot — see `CustomerRecordDraft.overviewFields`'s own doc
           comment for why these needed to stop pointing at two different
           copies of the same values. */
        <CustomerDetailTabContent fields={draft.overviewFields} draft={draft} onDraftChange={onDraftChange} />
      )}

      {activeTab === CUSTOMER_PANEL_TABS.indexOf("Directory") && (
        <CustomerDirectoryTabContent draft={draft} onDraftChange={onDraftChange} onPhoneChange={onPhoneChange} />
      )}
    </div>
  );
}

/** Shows the exact same "Customer Information" content the real panel
 *  displays — same `CustomerInformationPanelBody`, fed by the same
 *  `buildCustomerInfoFields`/`buildLatestInteraction`/`buildLatestNote`
 *  data and the same `CUSTOMER_PANEL_TABS` tab set, even the same
 *  Overview-tab `AIInput` footer — inside a `Popover` when the agent
 *  hovers the record header's toggle icon while the real panel is closed
 *  (see the render site further down). A hover-preview flyout of the panel
 *  itself, per explicit request, not a separate hand-built summary — this
 *  can never show something different from what actually opening the panel
 *  would. Same idea as `InteractionNavItem`'s own compact-rail hover
 *  preview (interaction-nav-item.tsx: "think of how you display your left
 *  nav when it's closed"), which shows that card's full real content
 *  (`cardBody`) inside a bare, self-chromed `Popover` rather than a
 *  simplified stand-in — this component supplies that same complete chrome
 *  itself (border/background/shadow/rounded corners, matching `SidePanel`'s
 *  own `bg-lyra-bg-surface-container-subtle` — side-panel.tsx) since the
 *  render site strips the default `Popover` framing to a bare frame around
 *  it, exactly like that same precedent.
 *
 *  Sized to actually fit as a flyout (fixed `w-[340px]`, matching this
 *  panel's own default docked width, `max-h-[70vh]` with only the body
 *  scrolling) rather than the real panel's full docked/full-screen height —
 *  the header (title/subhead + tabs) stays pinned via `PanelHeader`'s own
 *  `tabs` prop, same fixed-header/scrolling-body split `SidePanel` itself
 *  uses, so a tall tab's content scrolls internally instead of pushing the
 *  popover off-screen. Owns its own `activeTab` state (starts on Overview),
 *  independent of the real panel's own — switching tabs in this preview
 *  doesn't affect, and isn't affected by, whatever tab the agent last left
 *  the real panel on.
 *
 *  `onMouseEnter`/`onMouseLeave` are wired by the caller to the exact same
 *  open-immediately/close-on-a-short-delay handlers as the trigger icon
 *  itself — Radix `Popover.Content` portals straight to `document.body`,
 *  outside the trigger icon's own DOM subtree, so without re-arming here
 *  too, moving the pointer from the icon into this (portaled) popover would
 *  fire the icon's own `onMouseLeave` and close the preview before the
 *  agent can actually read it — same fix already applied once for
 *  `InteractionNavItem`'s own hover-preview card. */
export function CustomerInfoHoverPreview({
  customerName,
  recordId,
  channels,
  startedFresh,
  tabs,
  onMouseEnter,
  onMouseLeave,
  onAddToast,
  recordDraft,
  overviewEditing,
  onOverviewEditingChange,
  matchState,
  copilotExtra,
  onStartInteraction,
  bodyOverride,
}: {
  customerName?: string;
  recordId: string;
  channels: Thread[];
  /** Same "has this conversation actually started yet" signal
   *  `CustomerInformationSidePanel` uses for its own `copilotAvailable` —
   *  see that prop's own doc comment. Mirrors the exact real panel this
   *  preview shows, so a hover preview never shows Copilot as available
   *  when opening the real panel wouldn't. */
  startedFresh?: boolean;
  /** Which tabs this preview supports at all, in order — see
   *  `CustomerInformationSidePanel`'s own `tabs` doc comment. The caller
   *  passes the SAME list it configures its own real
   *  `CustomerInformationSidePanel` with, for the same "never show
   *  something the real panel wouldn't" reason this component's own
   *  top-of-file doc comment already covers for content. */
  tabs: readonly CustomerPanelTabLabel[];
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  /** Fires a toast into the shared stack the caller owns — same prop/
   *  reasoning as `CustomerInformationSidePanel`'s own `onAddToast` (see
   *  that prop's doc comment); fired on a successful Customer Overview
   *  save below. */
  onAddToast?: (toast: Omit<ToastItem, "id">) => void;
  /** The SAME `useCustomerRecordDraft` instance the caller also passes to
   *  its real `CustomerInformationSidePanel` for this exact interaction —
   *  LIFTED here (this component used to own a totally separate instance)
   *  per explicit request: this popover's own content unmounts every time
   *  the agent hovers off (Radix `Popover.Content` has no `forceMount`),
   *  which used to silently wipe any pending edit the instant the mouse
   *  left. Sharing one instance with the docked panel means hovering off
   *  and back on (or opening/closing the docked panel instead) never loses
   *  anything — the draft only resets when `recordId` changes (inside
   *  `useCustomerRecordDraft` itself) or the interaction is actually
   *  dismissed (the caller's instance goes away with it), never merely
   *  from this popover unmounting. */
  recordDraft: ReturnType<typeof useCustomerRecordDraft>;
  /** Same lift as `recordDraft` above, for the identical reason — see that
   *  prop's own doc comment. */
  overviewEditing: boolean;
  onOverviewEditingChange: (editing: boolean) => void;
  /** Per explicit request: this hover preview must show the SAME
   *  information the docked open panel does, for the exact same
   *  interaction — so it needs the exact same `matchState` prop
   *  `CustomerInformationSidePanel` accepts (see that prop's own doc
   *  comment for what each piece does), not just the same `tabs`/
   *  `recordDraft`. `undefined` for a real-customer interaction, same as
   *  the docked panel. */
  matchState?: {
    step: "search" | "create";
    query: string;
    onQueryChange: (query: string) => void;
    possibleMatches: CreateNewCustomerRecord[];
    searchResults: CreateNewCustomerRecord[];
    onLinkRecord: (customer: CreateNewCustomerRecord) => void;
    onStartCreate: () => void;
    onBackToSearch: () => void;
    onSaveNewCustomer: () => void;
  };
  /** Per explicit request ("make sure to update the hover state of copilot
   *  to match the docked state"): passed straight through to
   *  `CustomerInformationPanelBody`'s own same-named prop (see that prop's
   *  own doc comment) exactly like `CustomerInformationSidePanel` already
   *  does — this hover preview never had this prop at all before, so its
   *  own Copilot tab was silently missing whatever the docked panel's own
   *  `copilotExtra` was showing (the Marcus Webb scenario's summary cards/
   *  decision flow) even though every OTHER piece of Copilot content
   *  (`copilotSummary`) was already shared between the two. `undefined` for
   *  every interaction that has no scripted extra content, same default
   *  every other consumer gets. */
  copilotExtra?: React.ReactNode;
  /** Per explicit request ("put the customer available channels in the
   *  Customer Overview in the same row as the edit... for all Customer
   *  Information panels... make sure this is reflected in the hover panel
   *  as well") — feeds `CustomerInformationPanelBody`'s own `row`/
   *  `onStartInteraction` props exactly like `CustomerInformationSidePanel`
   *  does (see that prop's own doc comment); `row` itself is derived from
   *  `recordId` right below via `resolveCustomerListRecord`, same as the
   *  docked panel. */
  onStartInteraction: (contact: CreateNewOutboundContact, channel: ChannelType, phone: string, skillId: string) => void;
  /** Same override as `CustomerInformationSidePanel`'s own identically-
   *  named prop — see that component's own doc comment for the full "why".
   *  Advanced passes the SAME `DetailsPanelAccordions` element to both this
   *  hover preview and the docked panel, so the two never disagree on what
   *  they show for the same interaction, exactly like every other piece of
   *  content this preview mirrors from the docked panel. */
  bodyOverride?: React.ReactNode;
}) {
  const latestInteraction = useMemo(
    () => buildLatestInteraction(customerName, recordId),
    [customerName, recordId]
  );
  const latestNote = useMemo(() => buildLatestNote(customerName, recordId), [customerName, recordId]);
  // See `resolveCustomerListRecord`'s own doc comment above — same lookup
  // `CustomerInformationSidePanel` performs, so the hover preview's own
  // Customer Overview row shows the identical channel icons the docked
  // panel does for this same interaction.
  const row = useMemo(() => resolveCustomerListRecord(recordId), [recordId]);
  const copilotSummary = useMemo(() => buildCopilotSummary(customerName, recordId), [customerName, recordId]);
  // Per explicit request ("stop launching copilot - hide it completely")
  // — Copilot is now unconditionally excluded below (`visibleTabs`), same
  // as `CustomerInformationSidePanel`'s identical fix just below in this
  // file (see that component's own doc comment for the full reasoning).
  // `copilotSummary`/`buildCopilotSummary` above stay computed regardless
  // — `ContactOverview`'s own `journeySummary` prop now reuses that exact
  // recap in its new home.
  const [activeTab, setActiveTab] = useState(() => CUSTOMER_PANEL_TABS.indexOf("Overview"));
  const visibleTabs = tabs.filter((t) => t !== "Copilot");
  // See `buildCustomerMatchSubhead`'s own doc comment — shared with
  // `CustomerInformationSidePanel` so the docked panel and this hover
  // preview never disagree on the match count/wording or which list is
  // showing, for the exact same interaction.
  const { subhead: matchSubhead, visibleList: matchVisibleList } = matchState
    ? buildCustomerMatchSubhead(matchState.query, matchState.possibleMatches, matchState.searchResults)
    : { subhead: "", visibleList: [] };

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      // `h-[80vh] max-h-[768px]` — a standard size regardless of which
      // tab's content happens to be active, rather than shrinking to fit
      // whatever's shortest (confirmed live: switching to the Interactions
      // tab here — before it had `recordId`/`channels` wired below — showed
      // nothing, and with no min/fixed height the whole flyout collapsed
      // down to just its header, which read as broken rather than merely
      // empty). `80vh` scales with the viewport (was `90vh` — confirmed
      // live that overflowed the screen on a normal-height display, since
      // this popover trigger sits fairly high up the record header, not
      // vertically centered — 80vh leaves enough margin above/below to
      // stay fully on-screen), and `max-h-[768px]` caps it from growing
      // arbitrarily tall on very large displays — per explicit spec.
      className="flex h-[80vh] max-h-[768px] w-[340px] flex-col overflow-hidden rounded-lyra-lg border border-lyra-border-soft bg-lyra-bg-surface-container-subtle shadow-lg"
    >
      <PanelHeader
        // Static "Customer Information" now (was the customer's own
        // name + record id) — per explicit request, this hover preview's
        // header no longer doubles as an identity readout; the name/id
        // are still available via the Overview tab's own fields below.
        //
        // While `matchState` is set (see that prop's own doc comment),
        // this reads "Create New Customer" (create step, with a back-arrow
        // `icon` ahead of it) or keeps "Customer Information" (search
        // step) with the possible-matches/search-results count as
        // `subhead` — same header treatment
        // `CustomerInformationSidePanel` uses for the docked panel, per
        // explicit request that the two never show different information
        // for the same interaction.
        title={matchState?.step === "create" ? "Create New Customer" : "Customer Information"}
        // Per a later explicit follow-up request ("add the customer name
        // subhead to the customer information panel when it is not
        // docked") — this hover preview IS that "not docked" panel
        // (`CustomerInformationSidePanel` is the docked one, which already
        // got this same `customerName` subhead per an earlier follow-up —
        // see that panel's own `headerSubhead` doc comment). Brings this
        // preview to parity with the docked panel rather than leaving it
        // as the one remaining place the name doesn't show in the header.
        // Same three-way branch as the docked panel's `headerSubhead`:
        // the match-search step keeps its own count subhead, the
        // match-create step has none (no confirmed customer yet), and the
        // ordinary case now shows `customerName`.
        subhead={
          matchState?.step === "search"
            ? matchSubhead
            : matchState?.step === "create"
              ? undefined
              : customerName
        }
        icon={
          matchState?.step === "create" ? (
            <ActionIconButton aria-label="Back to search" title="Back" onClick={matchState.onBackToSearch}>
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </ActionIconButton>
          ) : undefined
        }
        // `undefined` entirely while `matchState` is set — neither match
        // step has a tab list, same as the docked panel.
        tabs={
          matchState || bodyOverride ? undefined : (
          <TabList className="px-4" overflowMenu>
            {visibleTabs.map((label) => (
              <Tab
                key={label}
                active={activeTab === CUSTOMER_PANEL_TABS.indexOf(label)}
                onClick={() => setActiveTab(CUSTOMER_PANEL_TABS.indexOf(label))}
              >
                {label}
              </Tab>
            ))}
          </TabList>
          )
        }
      />
      <div className="flex-1 overflow-y-auto">
        {matchState ? (
          matchState.step === "search" ? (
            <CustomerMatchSearchBody
              query={matchState.query}
              onQueryChange={matchState.onQueryChange}
              matches={matchVisibleList}
              onLinkRecord={matchState.onLinkRecord}
            />
          ) : (
            // Same "reuse the Detail tab's own draft/form" approach as
            // `CustomerInformationSidePanel`'s identical branch — see that
            // render call site's own doc comment.
            <CustomerDetailTabContent
              fields={recordDraft.draft.overviewFields}
              draft={recordDraft.draft}
              onDraftChange={recordDraft.updateDraft}
            />
          )
        ) : bodyOverride ? (
          bodyOverride
        ) : (
          <CustomerInformationPanelBody
            activeTab={activeTab}
            customerName={customerName}
            latestInteraction={latestInteraction}
            latestNote={latestNote}
            copilotSummary={copilotSummary}
            copilotExtra={copilotExtra}
            // Was left unwired (Contacts rendered nothing here, same
            // stub treatment as Tasks/Notes/Accounts/Tickets) — but unlike
            // those genuinely-unimplemented tabs, this data is already
            // sitting right here in scope (this component's own required
            // `recordId`/`channels` props), so there's no real reason not to
            // show it. Per explicit follow-up request.
            recordId={recordId}
            channels={channels}
            // `undefined` (no button at all) when "Contacts" isn't one of
            // this preview's configured `tabs` — see `visibleTabs`'s own doc
            // comment on `CustomerInformationSidePanel` for why: without this
            // gate, Overview's "View All Contacts" button would jump
            // `activeTab` to a tab that isn't in the header at all.
            onViewAllInteractions={
              tabs.includes("Contacts")
                ? () => setActiveTab(CUSTOMER_PANEL_TABS.indexOf("Contacts"))
                : undefined
            }
            draft={recordDraft.draft}
            onDraftChange={recordDraft.updateDraft}
            onPhoneChange={recordDraft.updatePhone}
            onOverviewFieldChange={recordDraft.updateOverviewField}
            allowOverviewEdit
            overviewEditing={overviewEditing}
            onOverviewEditingChange={onOverviewEditingChange}
            // Per explicit request ("...make sure this is reflected in the
            // hover panel as well") — same `row`/`onStartInteraction` wiring
            // as `CustomerInformationSidePanel`'s own identical call site;
            // see this component's own `row` const above for how it's
            // derived.
            row={row}
            onStartInteraction={onStartInteraction}
          />
        )}
      </div>
      {/* Footer — while `matchState` is set, this is EITHER the search
          step's full-width "Create New Customer" button or the create
          step's Cancel/Save pair, checked ahead of everything else below —
          same priority/reasoning as `CustomerInformationSidePanel`'s own
          `footer` prop (see that render call site's own comment). */}
      {matchState ? (
        matchState.step === "search" ? (
          <PanelFooter className="shrink-0">
            <Button className="w-full" onClick={matchState.onStartCreate}>
              Create New Customer
            </Button>
          </PanelFooter>
        ) : (
          <CustomerRecordSaveFooter
            onSave={matchState.onSaveNewCustomer}
            onCancel={() => {
              recordDraft.cancel();
              matchState.onBackToSearch();
            }}
          />
        )
      ) : (
      /* Save/Cancel footer — checked FIRST, same priority/reasoning as
          `CustomerInformationSidePanel`'s own `footer` prop (see that call
          site's own comment): per explicit request this hover preview now
          has the exact same Customer Overview edit/save capability the two
          real panels do, so it needs the same footer, outranking the
          Copilot/AIInput branches below exactly like the real panels'
          Detail/Directory footer does. */
      recordDraft.isDirty || overviewEditing ? (
        <CustomerRecordSaveFooter
          onSave={() => {
            recordDraft.save();
            onOverviewEditingChange(false);
            onAddToast?.({
              variant: "success",
              title: "Success",
              message: customerName ? `${customerName} customer record saved` : "Customer record saved",
              duration: 4000,
            });
          }}
          onCancel={() => {
            recordDraft.cancel();
            onOverviewEditingChange(false);
          }}
        />
      ) : /* Same Overview-only `AIInput` footer as the real panel (see its own
          `footer` prop above) — kept here too for exact content parity,
          per this component's own doc comment. `SHOW_CUSTOMER_INFO_AI_INPUT`
          — see that flag's own doc comment — temporarily hides both this
          AND Copilot's own singleLine `AIInput` just below, per a later
          explicit follow-up request. `singleLine` (per an earlier explicit
          follow-up request) renders it as a single compact row — attach/
          input/submit all inline — instead of `AIInput`'s own default
          stacked textarea-above/toolbar-below layout; `helperText=""`
          suppresses that layout's own default caption text, since a
          single-row search-bar affordance reads better without one
          directly underneath it. */
      SHOW_CUSTOMER_INFO_AI_INPUT && activeTab === CUSTOMER_PANEL_TABS.indexOf("Copilot") ? (
        <PanelFooter className="shrink-0 justify-start">
          <AIInput singleLine helperText="" className="w-full" />
        </PanelFooter>
      ) : (
        SHOW_CUSTOMER_INFO_AI_INPUT &&
        activeTab === CUSTOMER_PANEL_TABS.indexOf("Overview") && (
          <PanelFooter className="relative shrink-0 justify-start">
            <div
              className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-b from-transparent to-lyra-bg-surface-container-subtle"
              aria-hidden="true"
            />
            <AIInput placeholder="Ask about this customer..." showAttach={false} className="w-full" />
          </PanelFooter>
        )
      )
      )}
    </div>
  );
}

/* ── Unknown-contact customer matching (Premium/Advanced only) ──
   Per explicit request: when an interaction on Premium/Advanced isn't
   backed by a real `CREATE_NEW_CUSTOMERS` directory record (the same
   `!activeInteractionIsRealCustomer` signal that already drives the no-tab
   header treatment — see that const's own doc comment on each page file),
   the docked Customer Information panel no longer just shows a blank
   Detail-tab form for a name nobody can confirm. Instead it runs a
   simulated "does this look like anyone already in the directory" check
   and shows the result — possible matches to link to, or a genuinely-new-
   contact empty state — with a "Create New Customer" escape hatch either
   way. Both pieces below are page-agnostic UI-support logic (not a
   page-specific BEHAVIOR rule each tier reinterprets its own way, unlike
   e.g. `resolveActiveChannelDateTimeLabel`), so they live here once rather
   than being duplicated verbatim into each page file — consistent with
   `buildCustomerInfoFields`/`splitCustomerName`/etc. already doing the
   same. */

/** Same plain string-hash approach `hashSeed` (agent-next-gen-shared-
 *  utils.ts) already uses to turn a record id into a stable pseudo-random
 *  number — kept as its own tiny function here (rather than importing that
 *  one) since this hashes a raw dialed/typed identifier string, not a
 *  `recordId`, and the two are conceptually different seeds even though
 *  the math is identical. */
function hashMatchSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Simulated "does this unknown caller/emailer/chatter potentially match
 * someone already in the customer directory" check. There's no real
 * matching backend here — no shared phone/email index to actually query —
 * so this derives a believable, DETERMINISTIC result from the raw dialed/
 * typed identifier itself via `hashMatchSeed`: the same identifier always
 * returns the same result (stable across re-renders and switching away and
 * back), roughly 3 in 10 identifiers come back with zero matches (a
 * genuinely first-time contact — the "0 Matches" empty state), and the
 * rest return 1-8 "possible" matches pulled deterministically out of
 * `pool` (a rotating window starting at a hash-derived index, not a real
 * similarity ranking).
 */
export function findPossibleCustomerMatches(
  identifier: string | undefined,
  pool: readonly CreateNewCustomerRecord[]
): CreateNewCustomerRecord[] {
  if (!identifier || pool.length === 0) return [];
  const seed = hashMatchSeed(identifier);
  if (seed % 10 < 3) return [];
  const matchCount = Math.min(pool.length, 1 + (seed % 8));
  const startIndex = seed % pool.length;
  const matches: CreateNewCustomerRecord[] = [];
  for (let i = 0; i < matchCount; i++) {
    matches.push(pool[(startIndex + i) % pool.length]);
  }
  return matches;
}

/** The "Search Customers" box's own manual filter — unlike
 *  `findPossibleCustomerMatches` above (which never reads what the agent
 *  actually typed), this is a plain case-insensitive substring match
 *  across name/customer id/phone/email, for an agent who wants to look up
 *  a specific record by hand rather than rely on the automatic check
 *  (e.g. it came back empty, or missed the right person). Empty query
 *  returns no results — the panel falls back to
 *  `findPossibleCustomerMatches`'s own list in that case (see the render
 *  call site). */
export function filterCustomersByQuery(
  query: string,
  pool: readonly CreateNewCustomerRecord[]
): CreateNewCustomerRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return pool.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.customerId.toLowerCase().includes(q) ||
      c.firstPhone.toLowerCase().includes(q) ||
      c.emailAddress.toLowerCase().includes(q)
  );
}

/** Shared "N Matches"/"N Possible Matches"/"0 Matches" header subhead text
 *  (plus which list is actually the one currently visible) for the search
 *  step of the unknown-contact matching UI — used by BOTH
 *  `CustomerInformationSidePanel` and `CustomerInfoHoverPreview`, per
 *  explicit request that the closed panel's hover preview show the exact
 *  same information the docked open panel does, so the two never disagree
 *  on how many matches there are or what to call them. `searchResults`
 *  (real typed-search results) wins over `possibleMatches` (the automatic
 *  check) the instant `query` has anything in it — see
 *  `findPossibleCustomerMatches`/`filterCustomersByQuery`'s own doc
 *  comments for what each list actually is. */
function buildCustomerMatchSubhead(
  query: string,
  possibleMatches: CreateNewCustomerRecord[],
  searchResults: CreateNewCustomerRecord[]
): { subhead: string; visibleList: CreateNewCustomerRecord[] } {
  const queryActive = !!query.trim();
  const visibleList = queryActive ? searchResults : possibleMatches;
  const count = visibleList.length;
  const subhead = queryActive
    ? `${count} Match${count === 1 ? "" : "es"}`
    : count === 0
      ? "0 Matches"
      : `${count} Possible Match${count === 1 ? "" : "es"}`;
  return { subhead, visibleList };
}

/** The search-step body for the unknown-contact Customer Information panel
 *  (see the doc comment above) — a `SearchInput` over whichever list is
 *  currently relevant (`matches`, already resolved by the caller to either
 *  the automatic possible-matches list or the manual search results — see
 *  `CustomerInformationSidePanel`'s own `matchState` render branch), each
 *  row hover-revealing a "Link To Record" button in place of its default
 *  chevron (`group`/`group-hover`, same reveal-on-hover mechanism already
 *  used elsewhere in this app, e.g. the Latest Interaction card's "View
 *  All Contacts" button). Empty list (whether that's a genuine "0
 *  Matches" or just no search results yet) shows the same centered
 *  placeholder text either way — the header subhead just above this body
 *  (built by the caller) is what actually distinguishes those two cases
 *  for the agent. */
function CustomerMatchSearchBody({
  query,
  onQueryChange,
  matches,
  onLinkRecord,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  matches: CreateNewCustomerRecord[];
  onLinkRecord: (customer: CreateNewCustomerRecord) => void;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 pt-3 pb-4">
      <SearchInput
        value={query}
        onValueChange={onQueryChange}
        placeholder="Search Customers"
        aria-label="Search Customers"
      />
      {matches.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-16 text-center lyra-body-sm text-lyra-fg-secondary">
          No Customers Match This Interaction
        </div>
      ) : (
        <div className="flex flex-col">
          {matches.map((customer) => (
            <div
              key={customer.id}
              className="group -mx-2 flex items-center justify-between gap-2 rounded-lyra-sm px-2 py-2.5 transition-colors hover:bg-lyra-bg-surface-container-subtle"
            >
              <div className="min-w-0">
                <p className="lyra-body-md text-lyra-fg-default truncate">{customer.name}</p>
                <p className="lyra-body-sm text-lyra-fg-secondary truncate">{customer.customerId}</p>
              </div>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-lyra-fg-secondary group-hover:hidden"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <Button
                variant="outline"
                size="sm"
                className="hidden shrink-0 group-hover:inline-flex"
                onClick={() => onLinkRecord(customer)}
              >
                Link To Record
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Per explicit request ("Files gets a placeholder"); text updated to
 *  match this section's later rename ("Files" → "Artifacts" in the
 *  Details panel) — constant name kept as-is (internal identifier, not
 *  user-facing) rather than churned for no reason. */
const FILES_EMPTY_TEXT = "No artifacts on this interaction yet.";

/* ── useSessionDetailsTabContent ──
   Per explicit request ("make session details its own tab in the view
   details panel"): the "Session Details" content, pulled OUT of
   `DetailsPanelAccordions` below (which used to render it as its own
   default-open `Accordion` item) into its own panel-tab content — each
   page's own "Details"/"Transcript" `headerTabs` row gains a "Session
   Details" tab alongside them (see each page's own render site) rather
   than nesting this inside the "Details" tab's accordion stack.

   A HOOK, not a plain component — same reasoning `useCustomerDetailsInteriorPanel`
   above already documents for itself: per further explicit follow-up
   request ("session detail cancel/save should be fixed to the bottom of
   the panel like in the customer information edits so they never leave
   the view of the user"), Save/Cancel need to render in the CALLER's own
   `SidePanel`'s `footer` slot (outside its scrolling body, so they stay
   pinned/visible at every scroll position) rather than inline at the
   bottom of the scrolling form the way they used to — a plain component
   returning one render tree has no way to split itself across two
   different slots on an element it doesn't own. Returning `{ body, footer
   }` as plain values lets the caller spread `footer` into its existing
   `SidePanel` call's own `footer` prop (only while THIS tab is showing —
   see each page's own render site) and `body` into that tab's content,
   exactly like `useCustomerDetailsInteriorPanel` already does one level up
   for the whole panel. Reuses the exact same `CustomerRecordSaveFooter`
   Save/Cancel footer the Customer Overview/Customer Information edits
   already use, for a visually identical "fixed to the bottom" treatment. */
export function useSessionDetailsTabContent({
  sessionContact,
  onEditClick,
}: {
  /** The actual session "View Details" was clicked on (or the current
   *  in-progress one for voice) — `null` while none has been picked yet
   *  (e.g. the first render or two after the panel mounts, before the
   *  transcript's own `onCurrentSessionChange` has fired even once): `body`
   *  falls back to a plain placeholder and `footer` stays `undefined`
   *  (nothing to save with no session loaded). */
  sessionContact: Contact | null;
  /** Fired (in addition to this hook's own internal `sessionEditing`
   *  becoming `true`) whenever the Edit button is clicked — for a caller
   *  that renders this hook's `body` in more than one place sharing the
   *  same hook instance (e.g. a docked panel AND a transient hover-preview
   *  popover of it), this is the hook to make sure the right one is
   *  actually visible/open when editing starts, since this hook has no
   *  idea which of its callers' renders the agent clicked "Edit" in. */
  onEditClick?: () => void;
}): { body: React.ReactNode; footer: React.ReactNode } {
  const viewAllLinkClassName = "lyra-body-sm-emphasis text-lyra-status-info-strong text-left hover:underline w-fit";

  // Per explicit request ("make the View All say 'Edit' and when edit is
  // clicked make the session details editable like the customer overview
  // accordion"): same Pencil-icon "Edit" button/vertical-Input-fields idiom
  // the Customer Overview accordion already established
  // (`allowOverviewEdit`/`overviewEditing`'s own render site, this file).
  // Deliberately self-contained LOCAL state here rather than lifted to
  // page-level state the way Customer Overview's `overviewEditing`/
  // `recordDraft` are: unlike a real customer record, a session's own
  // Contact ID/Date/Start/End/Channel/Skill/Agent/Status fields have no
  // backing store anywhere in this app to persist a change to
  // (`TRANSCRIPT_SESSIONS`/`_VOICE`/`_EMAIL`, agent-next-gen-transcript.tsx,
  // are static mock data) — so "Save" just commits the locally-edited draft
  // into this same local state, which the read-only view below renders
  // from too, rather than writing through to any real interaction/session
  // record.
  const [sessionEditing, setSessionEditing] = useState(false);
  const [sessionDraft, setSessionDraft] = useState(sessionContact);
  useEffect(() => {
    setSessionDraft(sessionContact);
    setSessionEditing(false);
    // Keyed on the session's own id, not the whole `sessionContact` object —
    // the caller rebuilds that object fresh on every render (e.g. the
    // `sessionWithCurrentStatus` patch in agent-next-gen-transcript.tsx), so
    // resetting on reference equality alone would wipe out an in-progress
    // edit the instant anything else on the page re-rendered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionContact?.id]);
  // Same eight fields `TranscriptSessionDetails` itself reads, just as a
  // {key, label} list this loop can walk to build one `Input` per field
  // while editing — `key` is a real `Contact` field name so `sessionDraft[
  // key]`/the `setSessionDraft` updater below stay type-safe without a
  // parallel hand-maintained union.
  const sessionEditFields: Array<{ key: keyof Pick<Contact, "contactId" | "date" | "startTime" | "endTime" | "channel" | "skill" | "agent" | "status">; label: string }> = [
    { key: "contactId", label: "Contact ID" },
    { key: "date", label: "Date" },
    { key: "startTime", label: "Start" },
    { key: "endTime", label: "End" },
    { key: "channel", label: "Channel" },
    { key: "skill", label: "Skill" },
    { key: "agent", label: "Agent" },
    { key: "status", label: "Status" },
  ];

  if (!sessionContact || !sessionDraft) {
    return {
      body: (
        <p className="lyra-body-md text-lyra-fg-secondary px-4 pt-3 pb-4">
          Select "View Details" on a session to see its details here.
        </p>
      ),
      footer: undefined,
    };
  }

  return {
    body: (
      <div className="flex flex-col gap-3 p-4 overflow-y-auto">
        {/* Hidden while editing — Save/Cancel (now in the panel's own fixed
            footer, not inline here) are the only way back out once editing
            starts. */}
        {!sessionEditing && (
          <button
            type="button"
            className={cn(viewAllLinkClassName, "inline-flex items-center gap-1.5")}
            onClick={() => {
              setSessionEditing(true);
              onEditClick?.();
            }}
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            Edit
          </button>
        )}
        {sessionEditing ? (
          <div className="flex flex-col gap-3">
            {/* Standard, vertical (label-above-field) form fields — same
                layout switch Customer Overview's own editing state uses in
                place of its read-only "label left, value right" row (see
                that accordion's own doc comment on `overviewEditing`). */}
            {sessionEditFields.map(({ key, label }) => (
              <Input
                key={key}
                label={label}
                value={sessionDraft[key]}
                onChange={(e) => setSessionDraft((prev) => (prev ? { ...prev, [key]: e.target.value } : prev))}
              />
            ))}
          </div>
        ) : (
          <TranscriptSessionDetails session={sessionDraft} plain />
        )}
      </div>
    ),
    footer: sessionEditing ? (
      <CustomerRecordSaveFooter
        onSave={() => setSessionEditing(false)}
        onCancel={() => {
          setSessionDraft(sessionContact);
          setSessionEditing(false);
        }}
      />
    ) : undefined,
  };
}

/* ── DetailsPanelAccordions ──
   What the "Details" tab of the "Session Details"/"Details"/"Transcript"
   `InteriorPanel` (voice's own header tabs, and the plain non-voice panel —
   see each page's own render site) shows once a session has actually been
   picked. Originally three stacked `Accordion`s (Session Details/Customer
   Details/Files); per explicit follow-up request ("add these to the
   details tab and make session details its own tab in the view details
   panel", with a screenshot of the Customer Profile/Customer Snapshot
   cards), Session Details moved out into its own tab (see
   `useSessionDetailsTabContent` above) and Customer Details' old raw
   Phone/Contact #/Email/Balance/Address/City/State/Zip field list was
   replaced with the SAME `CustomerContextOverview` (lyra-ui) cards the
   main transcript column's own Contact Overview already shows — real,
   Contact-History-grounded content (`buildCustomerContextOverviewInfo`,
   agent-next-gen-shared-utils.ts) instead of a flat synthesized field
   list, reusing whatever the caller already computed for its own Contact
   Overview rather than a second, parallel data source. `showNextBestAction
   ={false}` — Next Best Action already has its own, more prominent home at
   the top of the main transcript column; repeating it in this side panel
   would just be noise (see that prop's own doc comment,
   lyra-ui/contact-overview.tsx). The last section stays a plain stub
   `Accordion` — still no destination defined for its own "View All" link
   — renamed "Files" → "Artifacts" per a later explicit request (see that
   item's own inline comment, and `FILES_EMPTY_TEXT`'s doc comment). */
export function DetailsPanelAccordions({
  customerName,
  customerContextOverview,
  showCustomerContextOverview = true,
  showRealTimeSummary = false,
  realTimeSummaryUpdatedAtTick,
  onViewExperienceMemory,
  onViewCustomerInfo,
  onViewInteractionHistory,
  onLinkCustomer,
  artifacts,
  onOpenArtifact,
  onViewAllArtifacts,
}: {
  /** Fired by "View All" (only shown when more than 10 artifacts are listed). */
  onViewAllArtifacts?: () => void;
  /** Side panels the agent has opened on this interaction — listed as links in the Artifacts card; clicking re-opens one. */
  artifacts?: { id: string; label: string }[];
  onOpenArtifact?: (id: string) => void;
  customerName?: string;
  /** Same object each page already builds via `buildCustomerContextOverviewInfo`
   *  for its own main-column Contact Overview — passed straight through
   *  rather than recomputed here, so the two never disagree. */
  customerContextOverview?: CustomerContextOverviewInfo;
  /** Per explicit request ("replace the autosummary card in the contact
   *  details with the content depicted in the screenshot of the real time
   *  summary card"), then a follow-up clarification ("do not modify the
   *  autosummary card that is inline with the conversation - create a new
   *  card and call it 'Real-Time Summary'") — swaps this panel's own
   *  "Contact Snapshot"/"Autosummary" container for `CustomerContextOverview`'s
   *  own new "Real-Time Summary" one instead (see that prop's own doc
   *  comment, lyra-ui/contact-overview.tsx, for the full "why"). The main
   *  transcript column's OWN `customerContextOverview` render (each page's
   *  own render site) never passes this — that's the "inline with the
   *  conversation" card the follow-up said to leave untouched. Defaults to
   *  `false`: every existing `DetailsPanelAccordions` call site keeps
   *  showing the original "Autosummary" exactly as before. */
  showRealTimeSummary?: boolean;
  /** Page-clock tick the Real-Time Summary was last "updated" at. This
   *  component turns it into the `"Updated 8 seconds ago"`-style caption
   *  (`formatRealTimeSummaryUpdatedLabel`) passed to
   *  `CustomerContextOverview`'s `realTimeSummaryUpdatedLabel` (see that
   *  prop's own doc comment for the full "why"), inside a `<ClockValue>`
   *  so only that card re-renders as it ticks. Only meaningful alongside
   *  `showRealTimeSummary`. */
  realTimeSummaryUpdatedAtTick?: number;
  /** Adds a "View Experience Memory" link to the Real-Time Summary card. */
  onViewExperienceMemory?: () => void;
  /** Per explicit request ("remove the customer details accordion from
   *  phase 1") — hides the whole Customer Profile/Snapshot section (Phase
   *  1's own call sites pass `false`). Default `true`: every other
   *  consumer (Phase 2) is unaffected. Renamed from the old
   *  `showCustomerDetails` now that this section is `CustomerContextOverview`
   *  cards rather than the old field-list "Customer Details" accordion. */
  showCustomerContextOverview?: boolean;
  /** Wired to the SAME docked Customer Information panel the main Contact
   *  Overview's own "View customer info" link opens (see each page's own
   *  `onViewCustomerInfo` render-site doc comment) — omit to hide the link
   *  (same as `CustomerContextOverview` itself already does). */
  onViewCustomerInfo?: () => void;
  onViewInteractionHistory?: () => void;
  /** Per explicit request ("contact details panel for unmatched customers
   *  should match the hover popover. add a button above auto summary that
   *  says link to existing customer and then when that is clicked slide in
   *  a panel with the search customer / create new customer panel
   *  content") — renders a "Link to existing customer" button above the
   *  Autosummary/Customer Snapshot accordion, omit to hide it (every
   *  existing call site that doesn't pass this is unaffected). The caller
   *  owns what "clicked" actually does (Advanced's own docked panel opens
   *  its `matchState` search/create flow via `CustomerInformationSidePanel`'s
   *  own `matchStateOnBack`-paired toggle — see that render site's own doc
   *  comment), this component just surfaces the entry point next to the
   *  same accordions the hover popover already always shows regardless of
   *  match status. */
  onLinkCustomer?: () => void;
}) {
  // Plain `lyra-body-md` + `text-lyra-fg-link` — this accordion's own
  // "View All" link (only consumer of this local const) per two explicit
  // requests: "increase the font size in the ... artifact ... accordion
  // content to md" (this was `-sm-emphasis`), then "make sure the view all
  // matches the link font in the view customer info" (dropped the
  // `-emphasis` weight — `CustomerContextOverview`'s own "View customer
  // info" link, lyra-ui/contact-overview.tsx, is plain `lyra-body-md`, not
  // emphasized), and finally "remove the accent tint on view all" — this
  // link never had a color explicitly requested; `text-lyra-status-info-
  // strong` was pre-existing and is replaced here with the same plain
  // `text-lyra-fg-link` every other "View ..." link in this file/
  // lyra-ui/contact-overview.tsx already uses, rather than a special tint.
  const viewAllLinkClassName = "lyra-body-md text-lyra-fg-link text-left hover:underline w-fit";

  // Files joins the same staggered fade/slide-up entrance
  // `CustomerContextOverview` drives for its own Customer Profile/
  // Snapshot cards (lyra-ui/contact-overview.tsx: 200ms + i*260ms per
  // section, 700ms duration) — continuing that sequence at the next
  // index so Files fades in right after Customer Profile (i=0) and
  // Customer Snapshot (i=1) have, or at the first slot's own timing
  // when those are hidden (`showCustomerContextOverview={false}`,
  // Phase 1) since there's nothing ahead of it to follow.
  const filesEntranceIndex = showCustomerContextOverview && customerContextOverview ? 2 : 0;
  const [filesEntered, setFilesEntered] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setFilesEntered(true), 200 + filesEntranceIndex * 260);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-3 p-4 overflow-y-auto">
      {onLinkCustomer && (
        <Button variant="outline" className="w-full" onClick={onLinkCustomer}>
          Link to existing customer
        </Button>
      )}
      {showCustomerContextOverview && customerContextOverview && (
        // Only this card re-renders for the "Updated N seconds ago"
        // caption, and only when the label text changes (every second for
        // the first minute, then every minute) — see
        // `realTimeSummaryUpdatedAtTick`'s own doc comment.
        <ClockValue
          select={(clockTick) =>
            realTimeSummaryUpdatedAtTick === undefined
              ? undefined
              : formatRealTimeSummaryUpdatedLabel(clockTick - realTimeSummaryUpdatedAtTick)
          }
        >
          {(realTimeSummaryUpdatedLabel) => (
        <CustomerContextOverview
          customerName={customerName ?? ""}
          customerCard={customerContextOverview.customerCard}
          snapshot={customerContextOverview.snapshot}
          // Per explicit request ("put the customer summary content inside
          // the customer profile accordion") — see `detailedSummary`'s own
          // doc comment (lyra-ui/contact-overview.tsx) for what this renders.
          detailedSummary={customerContextOverview.detailedSummary}
          // See `showRealTimeSummary`'s own doc comment above —
          // `customerContextOverview.realTimeSummary` is the SAME
          // per-contact facts `snapshot` (just above) already carries,
          // joined into one paragraph by `buildCustomerContextOverviewInfo`
          // itself (agent-next-gen-shared-utils.ts), not separately
          // authored here.
          showRealTimeSummary={showRealTimeSummary}
          realTimeSummary={customerContextOverview.realTimeSummary}
          realTimeSummaryUpdatedLabel={realTimeSummaryUpdatedLabel}
          onViewExperienceMemory={onViewExperienceMemory}
          showNextBestAction={false}
          // Per explicit follow-up request ("if a new call is made or the
          // customer does not have any information, do not display the
          // customer profile") — see `renderContactOverviewBlock`'s
          // identical prop (agent-next-gen-transcript.tsx) for the full
          // reasoning; `customerCard` is only ever unset for that exact
          // case.
          showCustomerProfile={!!customerContextOverview.customerCard}
          onViewCustomerInfo={onViewCustomerInfo}
          onViewInteractionHistory={onViewInteractionHistory}
          className="pt-0"
        />
          )}
        </ClockValue>
      )}
      <Accordion
        // Open by default per explicit request — this is a single-item
        // `Accordion` (`type="single"`, the component's own default), so
        // its one item's own `id` ("files", kept from the pre-rename
        // internal identifier — see that field's own comment below) is
        // exactly the uncontrolled `defaultValue` that starts it expanded.
        // Paired with `key={activeInteractionId}` on `DetailsPanelAccordions`
        // itself (AgentWorkspaceAdvancedPage.tsx's two render sites) — an
        // uncontrolled `defaultValue` only applies on mount, so without that
        // key this component (and this prop) would only ever take effect
        // for the very first contact ever shown, not each new one opened
        // afterward. See bug report ("the artifacts is not open when I open
        // a new contact from contact history").
        defaultValue="files"
        className={cn(
          CUSTOMER_INFO_ACCORDION_CLASSNAME,
          "transition-all duration-700 ease-out",
          filesEntered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        )}
        items={[
          {
            // Per explicit request, renamed "Files" → "Artifacts" in this
            // Details panel — `id` kept as the old "files" internal
            // identifier (not user-facing, and nothing keys off the
            // string elsewhere) rather than churning it for no reason.
            id: "files",
            title: "Artifacts",
            // Per explicit follow-up request ("make the artifacts accordion
            // background white and the header the same purple as the
            // autosummary") — originally the same `lyra-accent-purple-
            // soft`/`-strong` pairing `CustomerContextOverview`'s own
            // Autosummary header used (lyra-ui/contact-overview.tsx), via
            // `Accordion`'s `headerClassName`/`contentClassName` props
            // rather than a bespoke hand-rolled accordion item — this is
            // still the shared, single-item `Accordion` every other
            // consumer of this component gets, just with this one item's
            // header/body tinted. Recolored per a LATER explicit request
            // ("make all the card headers in the contact details subtle
            // blue like the customer info card") to the exact same
            // `bg-lyra-status-info-subtle`/`text-lyra-status-info-strong`
            // pairing "Customer Info"'s own header now uses (`Customer
            // ContextOverview`'s "customer-profile" item, lyra-ui/contact-
            // overview.tsx) — plain `bg-lyra-status-info-subtle`, not a
            // `-fix` class, since (unlike the purple token this replaces)
            // its dark-mode value was never reported as an outlier.
            headerClassName: "bg-lyra-status-info-subtle",
            contentClassName: "bg-lyra-bg-surface-base",
            icon: (
              <Paperclip
                className="h-4 w-4 text-lyra-status-info-strong"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            ),
            content: (
              <div className="flex flex-col gap-3">
                {/* lyra-body-md, not -sm — see `viewAllLinkClassName`'s own
                    comment just above for the same request. */}
                {artifacts && artifacts.length > 0 ? (
                  <ul className="flex flex-col gap-1.5">
                    {artifacts.slice(0, 10).map((a) => (
                      <li key={a.id} className="flex min-w-0 items-center gap-2">
                        <Paperclip className="h-3.5 w-3.5 shrink-0 text-lyra-fg-secondary" strokeWidth={1.5} aria-hidden="true" />
                        <button
                          type="button"
                          onClick={() => onOpenArtifact?.(a.id)}
                          className="min-w-0 truncate text-left lyra-body-md text-lyra-fg-link hover:underline"
                        >
                          {a.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="lyra-body-md text-lyra-fg-secondary">{FILES_EMPTY_TEXT}</p>
                )}
                {/* "View All" sits below the artifact list (here, the empty-
                    state text above) per explicit request, rather than above
                    it. TODO: no destination defined yet for this link — see
                    this component's own top doc comment. */}
                {artifacts && artifacts.length > 10 && (
                  <button type="button" className={viewAllLinkClassName} onClick={onViewAllArtifacts}>
                    View All
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

/* ── useCustomerDetailsInteriorPanel ──
   Per explicit request ("when view all is clicked on the customer
   information — instead of opening the side panel, take the content in the
   customer information side panel and load it in the interior panel with a
   back arrow to the left of the customer name, the content should take
   over the entire interior panel and allow it to expand full screen"): the
   SAME tabbed content `CustomerInformationSidePanel` shows (Overview/
   Detail/Notes/etc. via `CustomerInformationPanelBody`), reused here so it
   can be swapped into the "Details" `InteriorPanel` (see each page file's
   own render site — the same panel that shows `DetailsPanelAccordions`)
   instead of opening the separate docked side panel.

   Deliberately a HOOK, not a component that renders its own `InteriorPanel`
   (unlike `CustomerRowInfoPanel`, which owns a whole panel of its own):
   this content lives inside an `InteriorPanel` the CALLER already renders
   for a different reason (the "Details" panel, shared with
   `DetailsPanelAccordions`), so `headerTabs` needs to reach that panel's
   own `headerTabs` prop (kept OUT of the scrolling body, same as every
   other tabbed panel in this file) while `body` reaches its `children` and
   `footer` its `footer` — three separate slots on one already-existing
   element the caller owns, not something this hook can return as a single
   render tree of its own. Returning them as plain values lets the caller
   just spread them into its existing `InteriorPanel` call's props
   (`headerIcon`/`headerTitle`/`headerSubhead`/`headerTabs`/`footer`/
   `children`, swapped in only while this view is showing).

   `recordDraft`/`overviewEditing`/`onOverviewEditingChange`/`onAddToast`/
   `onStartInteraction`/`onOpenHistoryConversation` are all the SAME lifted
   page-level state/handlers the real `CustomerInformationSidePanel`
   instance already takes (see that component's own doc comments) — passed
   straight through here too so an edit started in one view (this one, the
   docked side panel, or the record-header hover preview) shows up
   consistently in the others, exactly like today. `tabs`/`channels`/
   `recordId`/`customerName` are the same per-caller values already passed
   to that same side panel instance.

   `activeTab` resets to "Overview" only when `recordId` itself changes
   (a genuinely different customer) — not on `onBack`/reopen, matching
   `CustomerInformationSidePanel`'s own behavior (a `SidePanel` that's just
   hidden via `open`, not remounted, so its last-viewed tab persists across
   a close/reopen too). */
export function useCustomerDetailsInteriorPanel({
  customerName,
  recordId,
  channels,
  tabs,
  recordDraft,
  overviewEditing,
  onOverviewEditingChange,
  onAddToast,
  onStartInteraction,
  onOpenHistoryConversation,
  onBack,
  matchState,
  copilotExtra,
}: {
  customerName?: string;
  recordId: string;
  channels: Thread[];
  tabs: readonly CustomerPanelTabLabel[];
  recordDraft: ReturnType<typeof useCustomerRecordDraft>;
  overviewEditing: boolean;
  onOverviewEditingChange: (editing: boolean) => void;
  onAddToast?: (toast: Omit<ToastItem, "id">) => void;
  onStartInteraction: (contact: CreateNewOutboundContact, channel: ChannelType, phone: string, skillId: string) => void;
  onOpenHistoryConversation?: (entry: CustomerHistorySessionEntry) => void;
  /** Fired by the returned `headerIcon` (the back arrow) — the caller is
   *  expected to swap this view back off (e.g. `setCustomerDetailsOpen(false)`). */
  onBack: () => void;
  /** Per explicit follow-up request ("customer information, details and
   *  customer summary are all opening in separate panels, they should all
   *  open in one side panel..."): the SAME unknown-contact customer-
   *  matching UI `CustomerInformationSidePanel` already supports (see that
   *  component's own `matchState` prop doc comment) — this whole view
   *  branches on it being present the identical way that component does,
   *  so `AgentWorkspace2WithDeskPage.tsx` loses nothing by routing its
   *  standalone docked panel's content through this hook instead.
   *  `undefined` for every other consumer/interaction. */
  matchState?: {
    step: "search" | "create";
    query: string;
    onQueryChange: (query: string) => void;
    possibleMatches: CreateNewCustomerRecord[];
    searchResults: CreateNewCustomerRecord[];
    onLinkRecord: (customer: CreateNewCustomerRecord) => void;
    onStartCreate: () => void;
    onBackToSearch: () => void;
    onSaveNewCustomer: () => void;
  };
  /** Passed straight through to `CustomerInformationPanelBody`'s own same-
   *  named prop — see that prop's own doc comment. `undefined` for every
   *  interaction except the Marcus Webb scripted scenario
   *  (AgentWorkspace2WithDeskPage.tsx). */
  copilotExtra?: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState(() => CUSTOMER_PANEL_TABS.indexOf("Overview"));
  useEffect(() => {
    setActiveTab(CUSTOMER_PANEL_TABS.indexOf("Overview"));
  }, [recordId]);
  // Copilot always stripped, same as every other consumer of this body —
  // see `CustomerInformationSidePanel`'s own `visibleTabs` doc comment.
  const visibleTabs = tabs.filter((t) => t !== "Copilot");
  const latestInteraction = useMemo(() => buildLatestInteraction(customerName, recordId), [customerName, recordId]);
  const latestNote = useMemo(() => buildLatestNote(customerName, recordId), [customerName, recordId]);
  const copilotSummary = useMemo(() => buildCopilotSummary(customerName, recordId), [customerName, recordId]);
  const row = useMemo(() => resolveCustomerListRecord(recordId), [recordId]);
  // See `buildCustomerMatchSubhead`'s own doc comment — shared with
  // `CustomerInformationSidePanel`/`CustomerInfoHoverPreview` so every
  // surface that can show the unknown-contact match flow for the same
  // interaction never disagrees on the count/wording or which list shows.
  const { subhead: matchSubhead, visibleList: matchVisibleList } = matchState
    ? buildCustomerMatchSubhead(matchState.query, matchState.possibleMatches, matchState.searchResults)
    : { subhead: "", visibleList: [] };

  return {
    headerIcon: (
      <button
        type="button"
        onClick={matchState?.step === "create" ? matchState.onBackToSearch : onBack}
        aria-label={matchState?.step === "create" ? "Back to search" : "Back to Details"}
        className="flex h-6 w-6 items-center justify-center rounded-lyra-sm text-lyra-fg-secondary hover:bg-lyra-state-hover transition-colors"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
      </button>
    ),
    // While `matchState` is set (see that prop's own doc comment), the
    // title/subhead/tabs below all branch on it exactly the way
    // `CustomerInformationSidePanel` already does for its own identical
    // header — see that component's own doc comments for the full "why"
    // behind each branch.
    headerTitle: matchState
      ? matchState.step === "create"
        ? "Create New Customer"
        : "Customer Information"
      : customerName || "Customer",
    headerSubhead: matchState
      ? matchState.step === "search"
        ? matchSubhead
        : undefined
      : recordId,
    headerTabs: matchState ? undefined : (
      <TabList className="px-4" overflowMenu>
        {visibleTabs.map((label) => (
          <Tab
            key={label}
            active={activeTab === CUSTOMER_PANEL_TABS.indexOf(label)}
            onClick={() => setActiveTab(CUSTOMER_PANEL_TABS.indexOf(label))}
          >
            {label}
          </Tab>
        ))}
      </TabList>
    ),
    footer: matchState ? (
      matchState.step === "search" ? (
        <PanelFooter>
          <Button className="w-full" onClick={matchState.onStartCreate}>
            Create New Customer
          </Button>
        </PanelFooter>
      ) : (
        <CustomerRecordSaveFooter
          onSave={matchState.onSaveNewCustomer}
          onCancel={() => {
            recordDraft.cancel();
            matchState.onBackToSearch();
          }}
        />
      )
    ) : recordDraft.isDirty || overviewEditing ? (
      <CustomerRecordSaveFooter
        onSave={() => {
          recordDraft.save();
          onOverviewEditingChange(false);
          onAddToast?.({
            variant: "success",
            title: "Success",
            message: customerName ? `${customerName} customer record saved` : "Customer record saved",
            duration: 4000,
          });
        }}
        onCancel={() => {
          recordDraft.cancel();
          onOverviewEditingChange(false);
        }}
      />
    ) : undefined,
    body: matchState ? (
      matchState.step === "search" ? (
        <CustomerMatchSearchBody
          query={matchState.query}
          onQueryChange={matchState.onQueryChange}
          matches={matchVisibleList}
          onLinkRecord={matchState.onLinkRecord}
        />
      ) : (
        <CustomerDetailTabContent
          fields={recordDraft.draft.overviewFields}
          draft={recordDraft.draft}
          onDraftChange={recordDraft.updateDraft}
        />
      )
    ) : (
      <CustomerInformationPanelBody
        activeTab={activeTab}
        customerName={customerName}
        latestInteraction={latestInteraction}
        latestNote={latestNote}
        copilotSummary={copilotSummary}
        copilotExtra={copilotExtra}
        recordId={recordId}
        channels={channels}
        onOpenConversation={onOpenHistoryConversation}
        onViewAllInteractions={
          visibleTabs.includes("Contacts")
            ? () => setActiveTab(CUSTOMER_PANEL_TABS.indexOf("Contacts"))
            : undefined
        }
        draft={recordDraft.draft}
        onDraftChange={recordDraft.updateDraft}
        onPhoneChange={recordDraft.updatePhone}
        onOverviewFieldChange={recordDraft.updateOverviewField}
        overviewEditing={overviewEditing}
        onOverviewEditingChange={onOverviewEditingChange}
        allowOverviewEdit
        row={row}
        onStartInteraction={onStartInteraction}
      />
    ),
  };
}

/* ── CustomerInformationSidePanel ──
   Owns `activeTab` — the one piece of state both the header's `TabList`
   (via `SidePanel`'s `headerTabs`) and the scrolling body below it
   (`CustomerInformationPanelBody`) need, which is why this wraps both
   instead of `CustomerInformationPanelBody` owning that state itself the
   way it used to when the tabs still lived inside it.

   Also where the field list and Latest Interaction summary are actually
   computed (`buildCustomerInfoFields`/`buildLatestInteraction`, each
   memoized on `customerName`/`recordId`/`channels`) — takes the raw
   interaction fields instead of a pre-joined `headerSubhead` string so it
   has what it needs to build the header text and both panel-body pieces
   from the same source, rather than the caller assembling one string this
   component has to parse back apart.

   Docked via the generic `SidePanel` primitive (originally LEFT, matching
   an early reference screenshot; now RIGHT — `side="right"` below — per a
   later explicit request to move it, alongside the render site's own move
   to the row's other end) rather than the right-docked `InteriorPanel` this
   was previously built on — pin/hover-preview state lives in the parent
   (mirrors `AgentNextGenTemplate.stories.tsx`'s own `CustomerInformation-
   Panel` usage), since that's a `SidePanel`-only concept `InteriorPanel`
   never had. `allowFullScreen`/`exitFullScreenSignal`/`onOverlayModeChange`
   don't carry over — `SidePanel` has no "full screen" or "floating
   overlay" concept of its own; an unpinned panel simply shows/hides on
   hover instead.

   Full-screen (per explicit follow-up request) is built entirely here,
   without adding a real "full screen" concept to `SidePanel` itself: the
   caller passes `pinned={false}` (always an unpinned/floating overlay
   while full-screen — pushing the main column over via docked/pinned mode
   wouldn't read as "overlay full screen within its parent container") and
   `width` equal to the parent `Container`'s own measured width
   (`sidePanelContainerWidth`, already tracked for the narrow-container
   guard) instead of the normal drag-resized width, so the panel's own
   existing unpinned/absolute rendering branch (side-panel.tsx) covers the
   whole container edge to edge — animated by the same CSS width
   transition every other resize already uses, so expanding/collapsing
   full-screen isn't an instant jump cut. That animation needed one small
   fix in the shared `usePanelDragResize` hook (use-panel-drag-resize.ts):
   it used to latch onto whatever width a manual drag last set and ignore
   further external `width` prop changes afterward, which (a) silently
   broke this full-screen toggle for a panel that had been manually
   resized even once before, and (b) meant this component used to have to
   force a full remount on every full-screen toggle just to reset that
   stale internal state, which skipped the transition entirely (a fresh
   DOM node has no prior frame to animate from). The hook now resets its
   own internal drag state whenever its `initialWidth` prop changes, so it
   stays properly reactive to external width changes and no remount is
   needed here anymore. */
export function CustomerInformationSidePanel({
  open,
  pinned,
  onClose,
  fullScreen,
  onToggleFullScreen,
  onMouseEnter,
  onMouseLeave,
  customerName,
  recordId,
  channels,
  startedFresh,
  tabs,
  width,
  containerWidth,
  maxWidthRatio,
  onWidthChange,
  onResizeStateChange,
  onOpenHistoryConversation,
  onAddToast,
  recordDraft,
  overviewEditing,
  onOverviewEditingChange,
  matchState,
  matchStateOnBack,
  copilotExtra,
  onStartInteraction,
  focusTabOverride,
  bodyOverride,
  footerOverride,
  headerTitleOverride,
  headerTabsOverride,
  headerIconOverride,
  headerSubheadOverride,
  onViewCustomerInfo,
}: {
  open: boolean;
  pinned: boolean;
  /** Forwarded to `CustomerInformationPanelBody`'s `onOpenConversation` —
   *  see that prop's own doc comment. */
  onOpenHistoryConversation?: (entry: CustomerHistorySessionEntry) => void;
  /** Hides the panel WITHOUT unpinning it — rendered as a `PanelLeftClose`-
   *  iconed `PanelPinButton` in the header via `headerActions` below, NOT
   *  `SidePanel`'s own built-in pin button (that one has no way to
   *  override its default `Pin` icon, and this is a real close action now,
   *  not a pin/unpin toggle — see `handleSidePanelClose`'s own doc
   *  comment). `SidePanel`'s `onPinToggle` prop is deliberately left unset
   *  below so its internal default button doesn't also render. */
  onClose?: () => void;
  /** Whether the panel is currently overlaying the whole parent Container
   *  edge to edge — purely a rendering choice the caller makes (see this
   *  component's own doc comment above); only used here to pick the
   *  Maximize2/Minimize2 icon and label on the toggle button below. */
  fullScreen?: boolean;
  onToggleFullScreen?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  customerName?: string;
  recordId: string;
  channels: Thread[];
  /** This interaction's own `Interaction.startedFresh` — see that
   *  field's own doc comment (agent-next-gen-interaction-dashboard.tsx).
   *  Previously fed the now-removed `copilotAvailable` gate ("hasn't the
   *  customer said anything yet, so Copilot has nothing to summarize") —
   *  Copilot itself is unconditionally hidden now (per explicit request,
   *  see `visibleTabs`' own doc comment below), so this prop currently has
   *  no live consumer in this component; kept as-is (not removed) since
   *  every call site already passes it and it costs nothing to keep. */
  startedFresh?: boolean;
  /**
   * Which tabs this panel supports at all, in order — per explicit
   * request, Agent Workspace 2.0 passes `AGENT_WORKSPACE_CUSTOMER_PANEL_TABS`
   * (Overview/Copilot/Detail/Notes only); Agent Workspace 2.0 With Desk
   * passes the full `CUSTOMER_PANEL_TABS` unchanged. "Copilot" being
   * listed here only means this consumer supports it AT ALL — whether it
   * actually renders as a tab button also depends on `copilotAvailable`
   * below (see `visibleTabs`), so a consumer that includes "Copilot" here
   * still won't show it until the conversation has actually started.
   */
  tabs: readonly CustomerPanelTabLabel[];
  width: number;
  /** The parent Container's own currently measured width
   *  (`sidePanelContainerWidth`, already tracked for the narrow-container
   *  guard) — per explicit request, this panel must never render wider
   *  than that, docked or full-screen, so both `width` and `maxWidth`
   *  below are clamped against it. */
  containerWidth: number;
  /** Caps the drag-resize max width at this fraction of `containerWidth`
   *  instead of the flat 425px every other consumer still gets — see
   *  `clampedMaxWidth`'s own doc comment for the full "why". Optional;
   *  omit to keep the old flat-425px cap. */
  maxWidthRatio?: number;
  onWidthChange: (width: number) => void;
  onResizeStateChange?: (isResizing: boolean) => void;
  /** Fires a toast into the shared stack `AgentNextGenPage` (or whichever
   *  page owns this instance) owns via `useToast`/`<ToastContainer>` — same
   *  "lift the toast call up, don't spin up a second independent toast
   *  stack" reasoning `InteractionsListView`'s own `onAddToast` uses (see
   *  that prop's doc comment). Fired on a successful Customer Overview
   *  save below (`recordDraft.save()`). Optional so this panel still
   *  renders standalone without a crash if some future caller omits it. */
  /** The Detail/Directory/Customer Overview draft for this interaction's
   *  customer — LIFTED to the caller (previously this component's own
   *  `useCustomerRecordDraft` instance) per explicit request: an agent who
   *  starts an edit, hovers off the record header's `CustomerInfoHoverPreview`
   *  (which used to own a totally separate, Popover-unmounted-on-close
   *  instance), or toggles this docked panel closed and back open should
   *  still see the exact same pending edit, not a freshly reset one. The
   *  caller (`AgentNextGenPage`/`AgentWorkspace2WithDeskPage`) now owns ONE
   *  `useCustomerRecordDraft` instance per active interaction and passes it
   *  to BOTH this panel and `CustomerInfoHoverPreview`, so the two also stay
   *  in sync with each other — an edit started in one shows up in the
   *  other. Still resets to a fresh draft when `recordId` changes (that
   *  reset lives inside `useCustomerRecordDraft` itself, unchanged) and is
   *  discarded entirely once the interaction is actually dismissed (the
   *  caller's own instance goes away with it) — only those two things
   *  clear it, not merely closing/hovering off this panel. */
  recordDraft: ReturnType<typeof useCustomerRecordDraft>;
  /** Whether the Overview tab's field list is showing real inputs — also
   *  lifted to the caller alongside `recordDraft` above, for the identical
   *  "must survive hover-off/panel-close, not just field-level edits"
   *  reason. */
  overviewEditing: boolean;
  onOverviewEditingChange: (editing: boolean) => void;
  onAddToast?: (toast: Omit<ToastItem, "id">) => void;
  /** When set, this panel shows the unknown-contact customer-matching UI
   *  (see the doc comment above `findPossibleCustomerMatches`/
   *  `CustomerMatchSearchBody`) INSTEAD of its normal tabs+body — header
   *  title/subhead/tabs, body, and footer below all branch on this being
   *  present rather than on `tabs`/`recordDraft` alone. `undefined` for
   *  every other consumer (`CustomerRowInfoPanel`/`CustomerInfoHoverPreview`
   *  never pass this) and for a real-customer interaction on Premium/
   *  Advanced — only an unknown-contact interaction on those two tiers
   *  ever sets this (see each page file's own render call site). */
  matchState?: {
    step: "search" | "create";
    query: string;
    onQueryChange: (query: string) => void;
    /** Shown instead of `searchResults` whenever `query` is empty — see
     *  `findPossibleCustomerMatches`'s own doc comment. */
    possibleMatches: CreateNewCustomerRecord[];
    /** Shown instead of `possibleMatches` the moment `query` has anything
     *  typed into it — see `filterCustomersByQuery`'s own doc comment. */
    searchResults: CreateNewCustomerRecord[];
    onLinkRecord: (customer: CreateNewCustomerRecord) => void;
    onStartCreate: () => void;
    onBackToSearch: () => void;
    onSaveNewCustomer: () => void;
  };
  /** Passed straight through to `CustomerInformationPanelBody`'s own same-
   *  named prop — see that prop's own doc comment. `undefined` for every
   *  interaction except the Marcus Webb scripted scenario. */
  copilotExtra?: React.ReactNode;
  /** Per explicit request ("put the customer available channels in the
   *  Customer Overview in the same row as the edit... for all Customer
   *  Information panels") — feeds `CustomerInformationPanelBody`'s own
   *  `row`/`onStartInteraction` props (see `resolveCustomerListRecord`'s own
   *  doc comment above for how `row` itself gets derived from `recordId`
   *  right below). Every real page-file call site already has a working
   *  `handleStartCall`-backed handler of this exact shape — see
   *  `CustomerRowInfoPanel`'s own identically-named, non-optional prop for
   *  the established wiring pattern this mirrors. */
  onStartInteraction: (contact: CreateNewOutboundContact, channel: ChannelType, phone: string, skillId: string) => void;
  /**
   * External one-shot "jump to this tab" command — for the Contact
   * Overview's own "View customer info"/"View interaction history" links
   * (`ContactOverview`'s `onViewCustomerInfo`/`onViewInteractionHistory`,
   * wired at each page file's call site), which need to command this
   * panel's internally-owned `activeTab` from outside without making it a
   * fully controlled prop (this component's own tab-button clicks still
   * just call `setActiveTab` directly, same as always). Same nonce/version
   * pattern as `InteractionNavItem`'s own `channelsExpandedOverride` (see
   * that prop's doc comment, interaction-nav-item.tsx) — `version` is a
   * nonce to re-apply `tab` even if it's identical to the last time (e.g.
   * clicking "View customer info" twice in a row with nothing else
   * changing `activeTab` in between). */
  focusTabOverride?: { tab: CustomerPanelTabLabel; version: number };
  /**
   * When set, replaces this panel's normal tabbed body
   * (`CustomerInformationPanelBody`) with this element instead, AND hides
   * `headerTabs` entirely (there's nothing for a tab row to switch
   * between once the body isn't tab content anymore) — used by
   * `AgentWorkspaceAdvancedPage.tsx`'s docked "Customer Information"
   * panel to show the same Customer Profile/Contact Snapshot/Files
   * accordion content (`DetailsPanelAccordions`, below) the voice
   * "Details" panel used to show exclusively, per explicit request
   * ("swap the actual content rendered inside each panel" — see that
   * panel's own render site doc comment, and `CustomerInfoHoverPreview`'s
   * identical prop, for the fuller "why"). Checked AFTER `matchState` — an
   * unknown-contact interaction still gets the customer-matching UI, never
   * the accordions — but INSTEAD of the normal tab body otherwise.
   * `undefined` for every other consumer (Phase 1/Premium never pass this,
   * so their own instances of this panel are completely unaffected).
   */
  bodyOverride?: React.ReactNode;
  /**
   * Replaces this panel's normal footer chain (the record Save/Cancel
   * footer, the Copilot/Overview `AIInput`, or nothing) with this element
   * instead — same "override" idea as `bodyOverride` just above, and
   * checked at the same priority (right after `matchState`'s own footer,
   * ahead of everything else), since a `bodyOverride`'d body (e.g. the
   * Session tab's editable content, `useSessionDetailsTabContent`) needs
   * its OWN Save/Cancel footer to win regardless of whatever the normal
   * Overview tab's record-edit state happens to be. `undefined` (the
   * default) leaves the existing footer chain completely unaffected.
   */
  footerOverride?: React.ReactNode;
  /**
   * Replaces the fixed "Customer Information" header title (used whenever
   * `matchState` isn't set) — per later explicit request ("put the
   * transcript and session tabs into the new customer information side
   * panel and rename the side panel Session Details"), Advanced's own
   * instance of this panel now reads "Session Details" instead, since it
   * shows more than just customer info once `bodyOverride`/`headerTabsOverride`
   * are also in play. `undefined` for every other consumer, which keeps
   * the original "Customer Information" title unchanged.
   */
  headerTitleOverride?: string;
  /**
   * Replaces the normal Overview/Detail/Notes `headerTabs` row with this
   * instead (still hidden entirely while `matchState` is set, same as
   * always) — per the same later explicit request as `headerTitleOverride`
   * above: Advanced's own instance shows a Details/Transcript/Session
   * Details row here instead, since `bodyOverride` now switches on that
   * same external tab state rather than this component's own internal
   * `activeTab`. Checked BEFORE the `bodyOverride`-implies-"no tabs" rule
   * `headerTabs` otherwise follows — passing this is how a caller gets
   * tabs back while ALSO using `bodyOverride`. `undefined` for every other
   * consumer, unaffected.
   */
  headerTabsOverride?: React.ReactNode;
  /**
   * Replaces the normal back-arrow-or-nothing `headerIcon` (only ever
   * rendered today during the `matchState` search/create flow) — lets a
   * caller show its own back arrow for a DIFFERENT drill-in view that
   * isn't `matchState` (e.g. the "Customer Info" view `bodyOverride`/
   * `headerTabsOverride`/`headerTitleOverride`/`headerSubheadOverride`
   * switch this panel into — see `AgentWorkspaceAdvancedPage.tsx`'s own
   * call site). Checked AFTER `matchState`'s own back arrow (unaffected,
   * still takes priority), so the two can never collide — an agent is
   * never in both flows on the same panel instance at once. `undefined`
   * for every other consumer, unaffected.
   */
  headerIconOverride?: React.ReactNode;
  /**
   * Replaces the normal `headerSubhead` (the customer's name, or the
   * clickable-name link below once `onViewCustomerInfo` is passed — see
   * that prop's own doc comment) — same "override" idea as
   * `headerTitleOverride` just above, for the SAME "Customer Info"
   * drill-in view (shows the record id there instead of the name).
   * `undefined` leaves the normal name/link subhead untouched.
   */
  headerSubheadOverride?: string;
  /**
   * Per explicit request ("the view customer info button can be the
   * customer name in the Contact Details subhead as a link with a
   * tooltip"): while set (and neither `matchState` nor
   * `headerSubheadOverride` is in play), the normal `headerSubhead` is no
   * longer plain text — it becomes the customer's name rendered as a
   * clickable link, wrapped in a "View Customer Info" `Tooltip`, calling
   * this. Reuses the exact link styling (`text-lyra-fg-link hover:underline
   * focus-visible:outline-none`) Marcus Webb's own clickable-name link
   * already uses (agent-next-gen-marcus-webb-next-best-action-card.tsx) for
   * visual consistency, rather than adding a new, separate button. The
   * caller is expected to open its own "Customer Info" drill-in view (same
   * one `headerIconOverride`'s back arrow returns out of) — `undefined`
   * (every other consumer) leaves `headerSubhead` as plain, non-interactive
   * text exactly as before.
   */
  onViewCustomerInfo?: () => void;
  /**
   * Per explicit request ("add a button above auto summary that says link
   * to existing customer and then when that is clicked slide in a panel
   * with the search customer / create new customer panel content") — when
   * set, the match flow's "search" step (this panel's own `matchState.step
   * === "search"`) gets a back arrow in `headerIcon`, same slot/treatment
   * the "create" step's own back-to-search arrow already uses, except this
   * one calls the caller's own handler instead of `matchState.onBackToSearch`
   * — Advanced's own docked panel call site uses it to close the on-demand
   * search/create overlay it opens from a button, back to its normal
   * `DetailsPanelAccordions` `bodyOverride` content. `undefined` for every
   * other consumer (unaffected — matches the search step's long-standing
   * no-back-arrow look exactly as before).
   */
  matchStateOnBack?: () => void;
}) {
  const latestInteraction = useMemo(
    () => buildLatestInteraction(customerName, recordId),
    [customerName, recordId]
  );
  const latestNote = useMemo(
    () => buildLatestNote(customerName, recordId),
    [customerName, recordId]
  );
  // See `resolveCustomerListRecord`'s own doc comment above for why this
  // panel — an already-open interaction, never fed a `row` from a
  // Customers-table row click — still has one to look up.
  const row = useMemo(() => resolveCustomerListRecord(recordId), [recordId]);
  const copilotSummary = useMemo(() => buildCopilotSummary(customerName, recordId), [customerName, recordId]);
  // Per explicit request ("stop launching copilot - hide it completely"):
  // Copilot is now unconditionally excluded below (`visibleTabs`), same
  // treatment `CustomerRowInfoPanel`/`AllContactsProfileView` already give
  // it (see either one's own `visibleTabs` doc comment) — this panel was
  // the last of the three still showing it conditionally
  // (`copilotAvailable`, previously). `copilotSummary`/`buildCopilotSummary`
  // above stay computed regardless — `ContactOverview`'s own
  // `journeySummary` prop (this file's page-level callers, not this
  // component) now reuses that exact same deterministic recap in its new
  // home, so the underlying data still has a real consumer even with the
  // Copilot tab itself gone.
  const [activeTab, setActiveTab] = useState(() => CUSTOMER_PANEL_TABS.indexOf("Overview"));
  // Applies `focusTabOverride` (see its own doc comment above) the moment
  // its `version` changes — same "adjust state during render, not inside a
  // `useEffect`" pattern `InteractionNavItem`'s own
  // `channelsExpandedOverride` uses (interaction-nav-item.tsx), so a
  // Contact Overview link click jumps this panel's tab in the SAME render
  // the new version arrives in rather than one render late.
  const lastAppliedFocusTabVersionRef = useRef(focusTabOverride?.version);
  if (focusTabOverride && focusTabOverride.version !== lastAppliedFocusTabVersionRef.current) {
    lastAppliedFocusTabVersionRef.current = focusTabOverride.version;
    const targetIndex = CUSTOMER_PANEL_TABS.indexOf(focusTabOverride.tab);
    if (targetIndex !== -1 && activeTab !== targetIndex) {
      setActiveTab(targetIndex);
    }
  }
  // `tabs` (this consumer's configured support list) minus "Copilot"
  // unconditionally now — see this block's own top comment.
  const visibleTabs = tabs.filter((t) => t !== "Copilot");

  // Per explicit follow-up request ("I want the session details side panel
  // to still animate in and out when docked on toggle, just not animate
  // when it goes full screen") — this component fakes "full screen" by
  // flipping `pinned`/`width` together at the call site (AgentWorkspace*
  // Page.tsx's own `pinned={fullScreen ? false : ...}`/`width={fullScreen ?
  // containerWidth : ...}`), rather than `InteriorPanel`'s own dedicated
  // `allowFullScreen` toggle — so `SidePanel` itself (side-panel.tsx) has no
  // way to tell "entering/exiting full screen" apart from a normal `open`
  // toggle on its own. Same `prevRef`/`justToggled` ref-comparison pattern
  // `InteriorPanel` uses for its own `fullScreenJustToggled` (see that
  // component's own doc comment) — computed with a plain assignment during
  // render (not `useEffect`) is what that fix settled on for InteriorPanel,
  // but THIS ref update needs to happen strictly AFTER the render that
  // reads `fullScreenJustToggled`, same reasoning as `InteriorPanel`'s own
  // `useEffect`-based update (not `useLayoutEffect`) — otherwise the ref
  // would already reflect the NEW value by the time this same render
  // computes `fullScreenJustToggled`, and the instant-transition render
  // would never actually fire.
  const prevFullScreenRef = useRef(fullScreen);
  const fullScreenJustToggled = prevFullScreenRef.current !== fullScreen;
  useEffect(() => {
    prevFullScreenRef.current = fullScreen;
  }, [fullScreen]);

  // Never render wider than the parent Container actually is, docked or
  // full-screen — see `containerWidth`'s own doc comment. `Math.max(0, ...)`
  // guards the pathological case of a container narrower than any usable
  // width at all; `SidePanel` itself already treats a 0/near-0 width
  // sanely (see its own `open ? currentWidth : 0` branches).
  const clampedWidth = Math.max(0, Math.min(width, containerWidth));
  // `maxWidthRatio` — per explicit request ("allow the interior panel to
  // have a max-width 50% when dragging resize"), Agent Workspace 2.0/2.0
  // With Desk now pass `0.5` here so a manual drag can't exceed half the
  // parent Container's own width, not the flat 425px every OTHER consumer
  // (Advanced) still gets — optional, defaulting to `undefined` so a
  // caller that doesn't pass it keeps the exact old flat-425px behavior
  // unchanged.
  const clampedMaxWidth =
    maxWidthRatio != null
      ? Math.max(0, Math.min(containerWidth * maxWidthRatio, containerWidth))
      : Math.max(0, Math.min(425, containerWidth));

  // See `buildCustomerMatchSubhead`'s own doc comment — shared with
  // `CustomerInfoHoverPreview` so the docked panel and its hover preview
  // never disagree on the match count/wording or which list is showing.
  const { subhead: matchSubhead, visibleList: matchVisibleList } = matchState
    ? buildCustomerMatchSubhead(matchState.query, matchState.possibleMatches, matchState.searchResults)
    : { subhead: "", visibleList: [] };

  return (
    <SidePanel
      // Docks on the RIGHT now (was "left") — per explicit request, moved
      // alongside relocating this component's own wrapper to render AFTER
      // the main content column instead of before it (see the render
      // site's own doc comment). `SidePanel`'s `side` prop drives its
      // border (`border-l` instead of `border-r`), unpinned/floating
      // position (`right-0` instead of `left-0`), and drag-resize handle
      // side — all three flip correctly just from this one prop (side-
      // panel.tsx), no other changes needed inside `SidePanel` itself.
      side="right"
      open={open}
      pinned={pinned}
      // See `fullScreenJustToggled`'s own doc comment above — instant only
      // for the render(s) where `fullScreen` itself just flipped; a normal
      // `open` toggle (still docked, not entering/exiting full screen)
      // keeps `SidePanel`'s own default animated width transition.
      instantWidthChange={fullScreenJustToggled}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      // Static "Customer Information" title (was the customer's own name +
      // record id in the TITLE, `headerSubhead={recordId}` below) — per
      // explicit request. The name/id already show again in the page
      // header above this panel (see `PageHeader`'s own `title`/`subtitle`
      // at the record header render site) and in this panel's own
      // Overview tab, so the TITLE doesn't need to repeat them a third
      // time.
      //
      // Per a later explicit follow-up request ("add a subhead to the
      // customer information panel in an interaction that is {Firstname
      // Lastname} of the customer"), the subhead itself is back — just the
      // plain name this time, not name+id the way it briefly was before
      // this got flattened to static text. Only for the ordinary case
      // (real customer, no `matchState` search/create flow in progress):
      // `matchState`'s own two steps keep their own subhead treatment
      // exactly as before (`matchSubhead` mid-search; none at all while
      // creating a brand-new record, since there's no confirmed customer
      // yet for a name to describe).
      //
      // While `matchState` is set (see that prop's own doc comment), this
      // whole header instead reads either "Customer Information" (search
      // step — matches every other consumer) or "Create New Customer"
      // (create step, per explicit request) with a back arrow ahead of it
      // (`headerIcon` below) instead of a normal `TabList` (`headerTabs`
      // below is `undefined` in both match steps — neither reference
      // screenshot shows any tabs).
      headerTitle={matchState?.step === "create" ? "Create New Customer" : headerTitleOverride ?? "Customer Information"}
      headerSubhead={
        matchState?.step === "search"
          ? matchSubhead
          : matchState?.step === "create"
            ? undefined
            : headerSubheadOverride !== undefined
              ? headerSubheadOverride
              : onViewCustomerInfo && customerName
                ? (
                  <Tooltip content="View Customer Info" placement="bottom">
                    <button
                      type="button"
                      onClick={onViewCustomerInfo}
                      className="lyra-body-sm text-lyra-fg-link hover:underline focus-visible:outline-none"
                    >
                      {customerName}
                    </button>
                  </Tooltip>
                )
                : customerName
      }
      headerIcon={
        matchState?.step === "create" ? (
          <ActionIconButton aria-label="Back to search" title="Back" onClick={matchState.onBackToSearch}>
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </ActionIconButton>
        ) : matchState?.step === "search" && matchStateOnBack ? (
          <ActionIconButton aria-label="Back" title="Back" onClick={matchStateOnBack}>
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </ActionIconButton>
        ) : headerIconOverride
      }
      // `PanelLeftClose`-iconed `PanelPinButton`, standing in for
      // `SidePanel`'s own default `Pin`-iconed one (suppressed by leaving
      // `onPinToggle` unset above) — same shared atom, just a different
      // icon/labels/handler, per explicit request. `pinned` is hardcoded
      // `false` here (NOT this panel's real `pinned` prop) — per explicit
      // follow-up request to drop the "currently active" highlighted
      // background `PanelPinButton` normally shows while pinned (see its
      // own `icon && pinned` branch): this is a momentary close action, not
      // a toggle with a persistent on/off state to reflect.
      headerActions={
        <>
          {/* Full-screen toggle — same `PanelPinButton` atom as the close
              button below (just another icon/label/handler over the shared
              "small icon button in a panel header" shape), per explicit
              request. `pinned={false}` here too, for the same reason the
              close button hardcodes it: this toggles between two distinct
              states (full-screen on/off) but isn't a pin, so it shouldn't
              wear `PanelPinButton`'s "currently active" highlight either. */}
          {onToggleFullScreen && (
            <PanelPinButton
              pinned={false}
              onToggle={onToggleFullScreen}
              icon={
                fullScreen ? (
                  <Minimize2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                ) : (
                  <Maximize2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                )
              }
              pinnedLabel={fullScreen ? "Exit Full Screen" : "Full Screen"}
              unpinnedLabel={fullScreen ? "Exit Full Screen" : "Full Screen"}
            />
          )}
          {onClose && (
            <PanelPinButton
              pinned={false}
              onToggle={onClose}
              // `PanelRightClose` (was `PanelLeftClose`) — matches the
              // panel's own new right-side dock (see `SidePanel`'s own
              // `side="right"` above); the glyph itself depicts which edge
              // the panel collapses toward, so it needs to flip along with
              // the panel's actual position.
              icon={<PanelRightClose className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
              pinnedLabel="Close Customer Information"
              unpinnedLabel="Close Customer Information"
            />
          )}
        </>
      }
      // Plain default `"wide"` mode (no `overflowBreakpoint` override) —
      // same behavior as every other `TabList` in the app; see the
      // previous `InteriorPanel`-based version's identical reasoning for
      // why `"wide"` (not `"compact"`) is the deliberate choice here.
      // `undefined` entirely while `matchState` is set — neither match
      // step has a tab list (see `headerTitle`'s own doc comment above).
      headerTabs={
        matchState
          ? undefined
          : headerTabsOverride !== undefined
          ? headerTabsOverride
          : bodyOverride
          ? undefined
          : (
            <TabList className="px-4" overflowMenu>
              {visibleTabs.map((label) => (
                <Tab
                  key={label}
                  active={activeTab === CUSTOMER_PANEL_TABS.indexOf(label)}
                  onClick={() => setActiveTab(CUSTOMER_PANEL_TABS.indexOf(label))}
                >
                  {label}
                </Tab>
              ))}
            </TabList>
          )
      }
      width={clampedWidth}
      // Hides the drag-resize handle while full-screen — its width is
      // fully caller-controlled in that state (see this component's own
      // doc comment), not something the agent should be able to drag.
      resizable={!fullScreen}
      // 325 — explicit min-width for this panel's drag-resize handle, per
      // explicit request. `SidePanel`'s own default (`minWidth = 200`,
      // side-panel.tsx) is too narrow for this panel's own content
      // (field labels/values, Latest Interaction card, etc.) to stay
      // legible once dragged all the way down.
      minWidth={325}
      // 425 was `SidePanel`'s own implicit default max-width (never passed
      // explicitly before) — now clamped against `containerWidth` too, so
      // a manual drag can't resize past the parent Container's own current
      // width either (see `clampedMaxWidth`'s own doc comment above).
      maxWidth={clampedMaxWidth}
      onWidthChange={onWidthChange}
      onResizeStateChange={onResizeStateChange}
      // AI Input pinned to the bottom of the Overview tab only — `footer`
      // renders as a `shrink-0` sibling AFTER `PanelContent` (see
      // side-panel.tsx), so it's already outside the scroll region and
      // naturally stays fixed to the bottom without any extra CSS.
      // Temporarily hidden — see `SHOW_CUSTOMER_INFO_AI_INPUT`'s own doc
      // comment, which now also covers Copilot's own `AIInput` just below
      // (per a later explicit follow-up — "hide the ask anything input in
      // copilot for now"), uses this exact same "shrink-0 sibling after
      // PanelContent" mechanism for its own fixed-to-bottom placement,
      // checked FIRST since the Save/Cancel footer below needs to outrank
      // it whenever the record is actually dirty. The Save/Cancel footer
      // (`recordDraft.isDirty || overviewEditing` — appears the instant
      // EITHER a field actually changes OR the Customer Overview edit
      // button is clicked, per explicit request) is checked BEFORE either
      // of those — per explicit request it stays open regardless of which
      // tab is active, so it needs to outrank both the Copilot- and
      // Overview-scoped footers rather than only showing while Detail/
      // Directory happens to be the active tab.
      footer={
        // While `matchState` is set, this footer is EITHER the search
        // step's full-width "Create New Customer" button or the create
        // step's Cancel/Save pair — checked first, ahead of even the
        // generic Save/Cancel footer below, since the create step's own
        // `recordDraft` is very likely dirty too (the agent is actively
        // typing a new record's fields) but needs the match-aware Save
        // handler (`onSaveNewCustomer`, which also promotes this
        // interaction to a real customer — see the page file's own
        // doc comment on that handler), not the generic one.
        matchState ? (
          matchState.step === "search" ? (
            <PanelFooter>
              {/* No `variant` — `Button`'s own default IS the filled
                  primary style (`bg-lyra-bg-primary`, button.tsx); this
                  design system has no separate `"primary"` variant name
                  (that was this button's original, incorrect value — it
                  silently fell back to the base, unstyled classes since
                  `cva` has no matching entry for it, per explicit bug
                  report). Same "just omit variant" convention
                  `CustomerRecordSaveFooter`'s own Save button already
                  uses, just below. */}
              <Button className="w-full" onClick={matchState.onStartCreate}>
                Create New Customer
              </Button>
            </PanelFooter>
          ) : (
            <CustomerRecordSaveFooter
              onSave={matchState.onSaveNewCustomer}
              onCancel={() => {
                recordDraft.cancel();
                matchState.onBackToSearch();
              }}
            />
          )
        ) : footerOverride !== undefined ? (
          footerOverride
        ) : recordDraft.isDirty || overviewEditing ? (
          <CustomerRecordSaveFooter
            onSave={() => {
              recordDraft.save();
              onOverviewEditingChange(false);
              onAddToast?.({
                variant: "success",
                title: "Success",
                message: customerName ? `${customerName} customer record saved` : "Customer record saved",
                duration: 4000,
              });
            }}
            onCancel={() => {
              recordDraft.cancel();
              onOverviewEditingChange(false);
            }}
          />
        ) : SHOW_CUSTOMER_INFO_AI_INPUT && activeTab === CUSTOMER_PANEL_TABS.indexOf("Copilot") ? (
          <PanelFooter className="justify-start">
            <AIInput singleLine helperText="" className="w-full" />
          </PanelFooter>
        ) : SHOW_CUSTOMER_INFO_AI_INPUT && activeTab === CUSTOMER_PANEL_TABS.indexOf("Overview") ? (
          <PanelFooter className="relative justify-start">
            {/* Soft fade instead of a hard border-top — same treatment as
                `InteractionComposer`'s transcript-to-composer transition
                (see that component's own comment above) — reads as the
                Overview content scrolling *under* the input rather than
                stopping at a line. Positioned outside this div's own box
                (negative top), overlaying the last ~32px of the scrollable
                content sitting directly above it. */}
            <div
              className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-b from-transparent to-lyra-bg-surface-container-subtle"
              aria-hidden="true"
            />
            <AIInput placeholder="Ask about this customer..." showAttach={false} className="w-full" />
          </PanelFooter>
        ) : undefined
      }
    >
      {matchState ? (
        matchState.step === "search" ? (
          <CustomerMatchSearchBody
            query={matchState.query}
            onQueryChange={matchState.onQueryChange}
            matches={matchVisibleList}
            onLinkRecord={matchState.onLinkRecord}
          />
        ) : (
          // The create step's own form — literally the same "Detail" tab
          // content/draft this panel already shows for an unknown-contact
          // interaction today (fields seeded from the interaction's own
          // case number/dialed identifier — see `CustomerDetailTabContent`'s
          // own doc comment), just reached via the search step instead of
          // a tab click, and saved via `matchState.onSaveNewCustomer`
          // (footer above) instead of the generic Save/Cancel footer.
          <CustomerDetailTabContent
            fields={recordDraft.draft.overviewFields}
            draft={recordDraft.draft}
            onDraftChange={recordDraft.updateDraft}
          />
        )
      ) : bodyOverride ? (
        bodyOverride
      ) : (
        <CustomerInformationPanelBody
          activeTab={activeTab}
          customerName={customerName}
          latestInteraction={latestInteraction}
          latestNote={latestNote}
          copilotSummary={copilotSummary}
          copilotExtra={copilotExtra}
          recordId={recordId}
          channels={channels}
          onOpenConversation={onOpenHistoryConversation}
          // `undefined` (no button at all) when "Contacts" isn't one of
          // this panel's configured `tabs` — see `visibleTabs`'s own doc
          // comment above for why: without this gate, Overview's "View All
          // Contacts" button would jump `activeTab` to a tab that isn't
          // in the header at all (Agent Workspace 2.0's own reduced tab set).
          onViewAllInteractions={
            tabs.includes("Contacts")
              ? () => setActiveTab(CUSTOMER_PANEL_TABS.indexOf("Contacts"))
              : undefined
          }
          draft={recordDraft.draft}
          onDraftChange={recordDraft.updateDraft}
          onPhoneChange={recordDraft.updatePhone}
          onOverviewFieldChange={recordDraft.updateOverviewField}
          overviewEditing={overviewEditing}
          onOverviewEditingChange={onOverviewEditingChange}
          // Per explicit request — this is one of the two real panels, so it
          // offers the Customer Overview edit button.
          allowOverviewEdit
          // Per explicit request ("put the customer available channels in
          // the Customer Overview in the same row as the edit... for all
          // Customer Information panels") — `row` (derived above, see
          // `resolveCustomerListRecord`'s own doc comment) feeds the same
          // `CustomerAddChannelButton` channel-icon row `CustomerRowInfoPanel`/
          // `CustomerFullScreenTabContent` already show; `null` (an ad-hoc/
          // unknown contact) simply renders no channel icons, same as those
          // two consumers already do for their own `row`-less case.
          row={row}
          onStartInteraction={onStartInteraction}
        />
      )}
    </SidePanel>
  );
}

/* ── CustomerRowInfoPanel ──
   Right-docked `InteriorPanel` opened by clicking a row in the Customers
   list view (`CustomersListView`'s `onRowClick`) — reuses the exact same
   "Customer Information" content (`CustomerInformationPanelBody`, and the
   `buildCustomerInfoFields`/`buildLatestInteraction`/`buildLatestNote`
   helpers that feed it) `CustomerInformationSidePanel` already shows for an
   active interaction, rather than a second hand-built copy of that same
   Overview/Detail/Directory content. Two real differences from that
   component, both per explicit request: docked RIGHT via `InteriorPanel`
   (that one is left-docked via `SidePanel`, for an unrelated reason — see
   its own doc comment), and no `AIInput` at all — this panel is read-only
   reference info about whichever customer row was clicked, not the seat
   of an active conversation to ask the AI assistant about. It DOES now
   get its own `footer`, though (per a later explicit request): the same
   Save/Cancel footer `CustomerInformationSidePanel` shows for pending
   Detail/Directory edits — see `useCustomerRecordDraft`'s own doc
   comment. "Read-only reference info" described the panel's own identity
   fields (never editable, no AI assistant), not the Detail/Directory
   forms nested inside it, which were always editable here too.

   `channels: []` passed to `buildCustomerInfoFields` below — that param
   only exists so a real *active* interaction's actually-open voice/email
   channel can override the synthesized phone/email fallback (see that
   function's own doc comment); a Customers-table row was never opened as
   an interaction, so there's no such channel to prefer over the
   synthesized one. */
export function CustomerRowInfoPanel({
  row,
  onClose,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  onStartInteraction,
  tabs,
  onAddToast,
  onOpenFullScreenTab,
  hideFullScreenToggle,
  hidePrevNext,
}: {
  /** The clicked customer row, or `null` when the panel is closed. Kept as
   *  the single source of both "is it open" (`open={row !== null}`) and
   *  "whose info to show" — same pattern the Dashboard's own queue
   *  drill-down `InteriorPanel` already uses (`selectedQueueId`) a bit
   *  further down this file. */
  row: CustomerListRecord | null;
  onClose: () => void;
  /** Step to the previous/next customer in `AgentNextGenPage`'s
   *  `customerSortedRows` — the exact same filtered+sorted order the table
   *  itself is currently showing (see that state's own doc comment) — not
   *  a separate, potentially-different order this panel would otherwise
   *  have to recompute on its own. */
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  onStartInteraction: (contact: CreateNewOutboundContact, channel: ChannelType, phone: string, skillId: string) => void;
  /** Which tabs this panel supports at all, in order — same `tabs` concept
   *  `CustomerInformationSidePanel` takes (see that prop's own doc
   *  comment); Agent Workspace 2.0 passes its own reduced
   *  `AGENT_WORKSPACE_CUSTOMER_PANEL_TABS`, Agent Workspace 2.0 With Desk
   *  passes the full `CUSTOMER_PANEL_TABS`. Unlike that component, though,
   *  "Copilot" is ALWAYS stripped out here regardless of what's passed
   *  (see `visibleTabs` below) — per explicit request, a Customers-table
   *  row is read-only reference info about a customer, never the seat of
   *  an actual conversation, so Copilot never has anything to summarize
   *  here and should never be offered as an option, unlike
   *  `CustomerInformationSidePanel`'s own merely-conditional gating. */
  tabs: readonly CustomerPanelTabLabel[];
  /** Fires a toast into the shared stack the caller owns — same prop/
   *  reasoning as `CustomerInformationSidePanel`'s own `onAddToast` (see
   *  that prop's doc comment); fired on a successful Customer Overview
   *  save below. */
  onAddToast?: (toast: Omit<ToastItem, "id">) => void;
  /**
   * Per explicit request ("in agent workspace 2.0 premium, when an agent
   * clicks the Full Screen [button], instead of toggling to a full screen
   * mode, open a new tab..."): when set, this panel's Full Screen button
   * fires this callback with the currently-open `row` instead of expanding
   * `InteriorPanel`'s own built-in `isFullScreen` overlay — the caller is
   * expected to open/activate a `CustomerFullScreenTabContent` tab
   * elsewhere (see that component's own doc comment) rather than this
   * panel growing in place. Omitted (the default) preserves the original
   * real-fullscreen-toggle behavior verbatim — scoped to whichever
   * consumer explicitly opts in (Agent Workspace 2.0 Premium only, per the
   * request's own wording) rather than changing this panel's default
   * behavior for every tier. */
  onOpenFullScreenTab?: (row: CustomerListRecord) => void;
  /**
   * Per explicit request ("remove the pop out icon to make it a tab") —
   * suppresses `InteriorPanel`'s own built-in full-screen toggle
   * entirely, on top of `onOpenFullScreenTab`'s existing suppression (see
   * that prop's own doc comment): where `onOpenFullScreenTab` swaps the
   * built-in toggle for a custom "Open Tab" button, this instead renders
   * NEITHER — no expand/pop-out affordance of any kind, just a plain
   * docked panel (prev/next/Add Channel/kebab/close). Built for Agent
   * Workspace Advanced's own Search panel Customers sub-tab (see that
   * call site, agent-next-gen-search-panel.tsx) — that tier has no
   * customer full-screen tabs to open (`onOpenFullScreenTab` is Premium-
   * only) and no in-place full-screen mode wanted either, so this row's
   * detail panel should just stay a fixed, right-docked panel. Default
   * `false` — every other existing consumer keeps its current
   * `allowFullScreen={!onOpenFullScreenTab}` behavior unchanged.
   */
  hideFullScreenToggle?: boolean;
  /**
   * Per explicit request ("hide the next/prev in the customer info cards
   * for advanced and premium in the customer table view") — hides the
   * Previous/Next customer chevron buttons in the header actions row
   * below. Originally scoped to just the desk-tab Customers table's own
   * `CustomerRowInfoPanel` call sites in `AgentWorkspace2WithDeskPage.tsx`
   * (Premium) and `AgentWorkspaceAdvancedPage.tsx` (Advanced); per an
   * immediate follow-up ("they are still there in advanced"), also passed
   * from the Search panel's own Customers sub-tab call site (Advanced
   * only, agent-next-gen-search-panel.tsx) — so in practice every
   * `CustomerRowInfoPanel` instance in Advanced now hides prev/next, and
   * Premium's one desk-tab instance does too (Premium's Search panel has
   * no Customers tab at all). Default `false` — every other existing
   * consumer keeps showing prev/next unchanged.
   */
  hidePrevNext?: boolean;
}) {
  const [activeTab, setActiveTab] = useState(() => CUSTOMER_PANEL_TABS.indexOf("Overview"));
  // Hard filter, not conditional like `CustomerInformationSidePanel`'s own
  // `copilotAvailable` gate — see `tabs`'s own doc comment above for why
  // Copilot is unconditionally excluded here no matter what's passed in.
  const visibleTabs = tabs.filter((t) => t !== "Copilot");

  // `InteriorPanel` forwards its own outer wrapper's ref (see interior-
  // panel.tsx — `ref={stableOuterRef}`, whose element's own inline `width`
  // style IS the panel's true current rendered width: 0 while closed,
  // otherwise its resized/default docked width — capped at `maxWidth`
  // (425 here, the default) — or "100%" of the main container while full-
  // screen). Observed here (rather than re-deriving `isFullScreen`/
  // `currentWidth`, both internal/uncontrolled state this component has no
  // access to) so the header's Add Channel/Refresh/Delete actions know
  // whether there's room to stay inline or need to collapse into a kebab —
  // same "measure the real box, don't guess" approach `TableToolbar` uses
  // for its own action-button collapse (table.tsx's `isWide`).
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState(9999);
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    setPanelWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => setPanelWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // 480px sits comfortably above `InteriorPanel`'s own 425px `maxWidth` (the
  // widest this panel can ever reach while normally docked/resized) and
  // comfortably below any realistic full-screen width (the main content
  // column, easily 800px+) — so this reliably reads "docked" as narrow and
  // "full screen" as wide, with no in-between flapping.
  const isNarrowActions = panelWidth < 480;

  // Back to the Overview tab every time a *different* row is opened — same
  // reasoning `CustomerChannelPopoverButton`'s own reset effects use
  // elsewhere in this file: reopening this panel on the previous row's
  // last-viewed tab would be a mildly confusing default. `row?.contactNumber`
  // (not `row` itself, a fresh object reference every render) is what this
  // actually keys off, so this doesn't also fire on every unrelated re-render
  // while the same row's panel is already open. `CUSTOMER_PANEL_TABS.
  // indexOf("Overview")`, not a hardcoded `0` — confirmed live as a real
  // bug once "Copilot" moved to global index 0 (§73's reorder): this
  // effect kept resetting straight onto Copilot's content on every row
  // open even though `visibleTabs` above always strips "Copilot" from the
  // tab row entirely for this read-only, non-conversational panel — no
  // tab button ever looked selected, but Copilot's info box/Journey
  // Summary rendered anyway.
  useEffect(() => {
    if (row) setActiveTab(CUSTOMER_PANEL_TABS.indexOf("Overview"));
  }, [row?.contactNumber]);

  const customerName = row ? `${row.firstName} ${row.lastName}` : undefined;
  const recordId = row?.contactNumber ?? "";
  const fields = useMemo(() => buildCustomerInfoFields(customerName, recordId, []), [customerName, recordId]);
  const latestInteraction = useMemo(() => buildLatestInteraction(customerName, recordId), [customerName, recordId]);
  const latestNote = useMemo(() => buildLatestNote(customerName, recordId), [customerName, recordId]);
  const copilotSummary = useMemo(() => buildCopilotSummary(customerName, recordId), [customerName, recordId]);
  // Own instance of the Detail/Directory draft — see `useCustomerRecordDraft`'s
  // own doc comment. `isDirty`/`save`/`cancel` drive the Save/Cancel footer
  // rendered in this panel's own `footer` slot below.
  const recordDraft = useCustomerRecordDraft(fields, customerName, recordId);
  // Whether the Overview tab's field list is showing real inputs — owned
  // here for the same reason `CustomerInformationSidePanel` owns its own
  // copy (see that component's own doc comment on its own `overviewEditing`):
  // this panel's `footer` below needs to know about it too, so the
  // Save/Cancel footer can appear the instant the edit button is clicked,
  // not only once a field has actually changed. Reset alongside `activeTab`
  // (same `row?.contactNumber` keying, own effect right below) — unlike
  // `CustomerInformationSidePanel`, this component does NOT remount on a
  // different row (prev/next chevrons reuse the same instance), so this
  // reset is load-bearing here, not just a defensive belt-and-suspenders.
  const [overviewEditing, setOverviewEditing] = useState(false);
  useEffect(() => {
    if (row) setOverviewEditing(false);
  }, [row?.contactNumber]);

  // Refresh/Delete — no `onClick` (no-op stubs), matching this exact
  // prototype's existing precedent for these two actions: the Customers
  // table's own toolbar `actionDefs` ("Refresh"/"Delete", a few hundred
  // lines up in `CustomersListView`) are the same bare label+icon with no
  // handler wired up yet.
  const recordActionItems: MenuEntry[] = [
    { id: "refresh", label: "Refresh Record", icon: <RefreshCw className="h-4 w-4" strokeWidth={1.5} />, disabled: !row },
    { id: "delete", label: "Delete Record", icon: <Trash2 className="h-4 w-4" strokeWidth={1.5} />, disabled: !row, destructive: true },
  ];

  return (
    <InteriorPanel
      ref={panelRef}
      side="right"
      open={row !== null}
      onClose={onClose}
      // Per a LATER explicit follow-up request ("update the toggle close
      // icon for interior panels to be an 'x' icon") — reverts the
      // `PanelRightClose` swap an earlier request (quoted above this
      // comment's own history) made here, back to `InteriorPanel`'s/
      // `ContainerHeader`'s own plain `X` default (simply omitting
      // `closeIcon` now gets that default). `CustomerFullScreenTabContent`
      // (Premium's "open as a desk tab" variant) was never touched by
      // either request either way — its own hand-rolled close button
      // already reads as a plain `X`.
      // Per explicit request ("make the customer info panel z-index
      // higher than the z-index of the launch channel buttons in the
      // rows of the customer tables for both premium and advanced") —
      // `InteriorPanel`'s own built-in outer wrapper is `z-[5]` by
      // default (interior-panel.tsx), which sat BELOW the Customers
      // table row's own hover-reveal launch-channel buttons (Call/Email/
      // WhatsApp — `agent-next-gen-customers-table.tsx`'s `z-10`
      // leading-channel-stack overlay), so that overlay visibly bled on
      // top of this panel once docked open (see the attached screenshot).
      // `className` here is merged via `cn`/`tailwind-merge`, which
      // resolves same-property Tailwind class conflicts by keeping the
      // last one — `z-20` cleanly overrides the built-in `z-[5]` without
      // needing to touch `InteriorPanel` itself, and comfortably clears
      // the row overlay's `z-10` in every tier this panel renders in
      // (both desk-tab Customers tables, Premium and Advanced, plus
      // Advanced's Search panel Customers sub-tab instance).
      className="z-20"
      // Lets the agent manually expand to full screen via `InteriorPanel`'s
      // own built-in toggle button (rendered next to the close button in
      // its header, self-contained `isFullScreen` state — see interior-
      // panel.tsx's own doc comment on `allowFullScreen`) — per explicit
      // request: opens as a normal docked flyout by default, with full
      // screen as an option, not the default.
      //
      // Per a later explicit follow-up request (Agent Workspace 2.0
      // Premium only — see `onOpenFullScreenTab`'s own doc comment), that
      // built-in toggle is suppressed here whenever a caller opts into tab
      // mode — a custom Full Screen button rendered in `headerActions`
      // below takes over instead, since `InteriorPanel`'s own toggle has no
      // way to be told "call this instead of touching your own internal
      // state."
      //
      // Per a further explicit follow-up (see `hideFullScreenToggle`'s own
      // doc comment), that suppression now also covers callers who want NO
      // full-screen affordance at all rather than a swapped-in tab button —
      // `hideFullScreenToggle` short-circuits this to `false` regardless of
      // `onOpenFullScreenTab`.
      allowFullScreen={!onOpenFullScreenTab && !hideFullScreenToggle}
      headerTitle={customerName ?? "Customer"}
      headerSubhead={recordId}
      // Sequential prev/next through the same filtered+sorted order the
      // Customers table itself is showing (`customerSortedRows`, lifted to
      // `AgentNextGenPage` — see that state's own doc comment). Plain
      // `ActionIconButton`s, not `PanelPinButton`: these are momentary
      // one-shot actions with no on/off state to reflect, unlike the
      // pin/full-screen/close buttons elsewhere that reuse `PanelPinButton`.
      // Rendered via `headerActions` so they appear BEFORE `InteriorPanel`'s
      // own automatic full-screen-toggle/close buttons (its `actions={<>
      // {headerActions}{fullScreenToggle}</>}` composition order). Ordered
      // AFTER Refresh/Delete (the "trash icon") rather than leading the
      // cluster, per explicit request.
      headerActions={
        <>
          {/* Add Channel moved out of this header entirely — per explicit
              follow-up request ("move the contact icon buttons into the
              customer overview and put them next to the edit button in a
              row above the other information"), it now lives inside the
              Customer Overview accordion's own top row instead (see
              `CustomerInformationPanelBody`'s `row`/`onStartInteraction`
              props, wired below at this panel's own body call site). This
              header keeps only Refresh/Delete/prev/next/kebab/Open-Tab —
              the momentary record-level actions that were never Add
              Channel's own narrow/wide-mode concern to begin with. */}
          {isNarrowActions ? (
            // `KebabMenuButton`'s own default trigger is a fixed h-6 w-6
            // (24px) — visibly smaller than every other icon button in
            // this row (Add Channel/prev/next/the built-in fullscreen-
            // toggle+close, all 32px+). `className` bumps it up to h-8 w-8
            // (32px, matching prev/next's own `icon-md` and the built-in
            // toggle/close buttons) and the glyph up to the same h-4 w-4
            // every neighboring icon here uses, per explicit request.
            <KebabMenuButton
              items={recordActionItems}
              ariaLabel="Record actions"
              className="h-8 w-8"
              icon={<MoreVertical className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
            />
          ) : (
            <>
              <ActionIconButton title="Refresh record" disabled={!row}>
                <RefreshCw className="h-4 w-4" />
              </ActionIconButton>
              <ActionIconButton title="Delete record" disabled={!row}>
                <Trash2 className="h-4 w-4" />
              </ActionIconButton>
            </>
          )}
          {/* Back in this same header-actions row regardless of width (per
              explicit follow-up request reverting the earlier "own row
              below the title" layout) — `Button variant="ghost"` (was
              `variant="outline"`, reverted per later explicit request) so
              these read as plain quick actions alongside Refresh/Delete/
              Add Channel's own `ActionIconButton`s rather than standing out
              as bordered controls. `size="icon-md"` (32px, one step below
              `ActionIconButton`'s own default "icon-lg"/36px — see
              `ACTION_ICON_BUTTON_SIZE_MAP` in actions.tsx) per earlier
              explicit request to size these down a notch from the rest of
              the cluster — kept as-is, that sizing request is independent
              of the outline→ghost variant change. */}
          {!hidePrevNext && (
            <>
              <Button variant="ghost" size="icon-md" title="Previous customer" disabled={!hasPrevious} onClick={onPrevious}>
                <ChevronLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon-md" title="Next customer" disabled={!hasNext} onClick={onNext}>
                <ChevronRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              </Button>
            </>
          )}
          {/* Stand-in for `InteriorPanel`'s own built-in fullScreenToggle
              (suppressed above via `allowFullScreen={!onOpenFullScreenTab}`)
              — same size/tooltip-placement/position (right after prev/next,
              immediately before the panel's own close button) so swapping
              which behavior this fires is visually seamless, but its own
              icon/label per later explicit follow-up request: `Maximize2`
              (this button never toggles an "exit" state of its own the way
              a real fullscreen button would — clicking it hands off to a
              desk tab instead of changing anything about THIS panel, so
              that icon read as misleading) → `SquareArrowOutUpRight`, the
              conventional "open in new tab/window" glyph, matching what
              this button actually does now. Title "Open Tab" (was "Full
              Screen") to match. */}
          {onOpenFullScreenTab && row && (
            <Button
              variant="ghost"
              size="icon-md"
              title="Open Tab"
              onClick={() => onOpenFullScreenTab(row)}
            >
              <SquareArrowOutUpRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </Button>
          )}
        </>
      }
      headerTabs={
        <TabList className="px-4" overflowMenu>
          {visibleTabs.map((label) => (
            <Tab
              key={label}
              active={activeTab === CUSTOMER_PANEL_TABS.indexOf(label)}
              onClick={() => setActiveTab(CUSTOMER_PANEL_TABS.indexOf(label))}
            >
              {label}
            </Tab>
          ))}
        </TabList>
      }
      // Save/Cancel footer for pending Detail/Directory edits — per a later
      // explicit request, this panel now gets one too (see this component's
      // own top-of-file doc comment for why that doesn't contradict its
      // original "read-only" framing). Stays open regardless of which tab
      // is active, same as `CustomerInformationSidePanel`'s own version —
      // an edit made on Detail shouldn't quietly vanish from view just
      // because the agent clicked over to Notes before saving it.
      footer={
        recordDraft.isDirty || overviewEditing ? (
          <CustomerRecordSaveFooter
            onSave={() => {
              recordDraft.save();
              setOverviewEditing(false);
              onAddToast?.({
                variant: "success",
                title: "Success",
                message: row ? `${row.firstName} ${row.lastName} customer record saved` : "Customer record saved",
                duration: 4000,
              });
            }}
            onCancel={() => {
              recordDraft.cancel();
              setOverviewEditing(false);
            }}
          />
        ) : undefined
      }
    >
      <CustomerInformationPanelBody
        activeTab={activeTab}
        customerName={customerName}
        latestInteraction={latestInteraction}
        latestNote={latestNote}
        copilotSummary={copilotSummary}
        // `recordId`/`channels` — per explicit follow-up request, the
        // Contacts tab now shows real (synthesized) history here too,
        // instead of rendering nothing (see `CustomerInformationPanelBody`'s
        // own `recordId`/`channels` doc comments, which this call site's
        // omission of both used to match — that reasoning is now out of
        // date and updated there too). `channels: []` for the same reason
        // `buildCustomerInfoFields` above already gets it: this row was
        // never opened as a real interaction, so there's no actually-open
        // `Thread[]` to prefer over the synthesized history —
        // `buildCustomerHistoryEntries` (the function this data actually
        // feeds) already treats a missing/empty `channels` as "use the
        // synthesized fallback for everything," which is exactly right
        // here.
        recordId={recordId}
        channels={[]}
        // Conditional per explicit request: this consumer's `tabs` prop
        // may or may not include "Contacts" (Agent Workspace 2.0 hides
        // it here entirely) — jumping to a hidden tab's index would leave
        // no tab visually active while its content still rendered, same
        // reasoning `CustomerInformationSidePanel`/`CustomerInfoHoverPreview`
        // already apply to their own `onViewAllInteractions`.
        onViewAllInteractions={
          visibleTabs.includes("Contacts")
            ? () => setActiveTab(CUSTOMER_PANEL_TABS.indexOf("Contacts"))
            : undefined
        }
        draft={recordDraft.draft}
        onDraftChange={recordDraft.updateDraft}
        onPhoneChange={recordDraft.updatePhone}
        onOverviewFieldChange={recordDraft.updateOverviewField}
        overviewEditing={overviewEditing}
        onOverviewEditingChange={setOverviewEditing}
        // Per explicit request — this is the other real panel, so it also
        // offers the Customer Overview edit button.
        allowOverviewEdit
        // Feeds the Customer Overview accordion's own new top row of
        // channel-launch buttons — see `CustomerInformationPanelBody`'s
        // `row`/`onStartInteraction` doc comments. Was rendered in this
        // panel's OWN header via `CustomerAddChannelButton` before (see
        // `headerActions` above); moved here per explicit follow-up
        // request. Always the "wide" one-button-per-channel shape now
        // (not `isNarrowActions`-dependent like the old header placement
        // was) — the Customer Overview card has its own fixed width
        // regardless of whether this panel itself is docked or full
        // screen, so there's no narrow/wide distinction left to make.
        row={row}
        onStartInteraction={onStartInteraction}
      />
    </InteriorPanel>
  );
}

/* ── CustomerFullScreenTabContent ──
   Per explicit request ("in agent workspace 2.0 premium, when an agent
   clicks the Full Screen [button on `CustomerRowInfoPanel`], instead of
   toggling to a full screen mode, open a new tab... put it to the far right
   of the tabs in the home screen container"): the content of one such
   desk-level tab — a customer's full profile (Overview/Detail/Notes/etc.,
   the exact same `CustomerInformationPanelBody` every other consumer of
   this file renders), stretched across the full desk-tab content column
   instead of docked/floating beside the Customers table.

   Deliberately NOT built by reusing `CustomerRowInfoPanel` (above) with
   `InteriorPanel`'s own `isFullScreen` state forced permanently on:
   `isFullScreen` is genuinely internal/uncontrolled state inside
   `InteriorPanel` (no prop exists to force it on from outside — see that
   component's own doc comment on `allowFullScreen`), and `InteriorPanel`
   itself is fundamentally a FLYOUT (open/close slide animation, drag-resize
   handle, docked-vs-overlay positioning) — repurposing it to sit
   permanently inline as an ordinary block would mean fighting all of that
   machinery rather than using it. Instead, this composes the same lower-
   level pieces `InteriorPanel` itself is built from — `PanelHeader` (=
   `ContainerHeader`), `PanelContent`, `PanelFooter` — directly, exactly the
   same way `CustomerRowInfoPanel` and `CustomerInformationSidePanel` both
   already do internally (see interior-panel.tsx / side-panel.tsx) — so this
   renders pixel-identical chrome (title/subhead row, tab strip, scrollable
   body, Save/Cancel footer) with none of the flyout-only behavior this
   context doesn't need.

   Owns its own `activeTab`/`recordDraft`/`overviewEditing` state (same
   shape `CustomerRowInfoPanel` keeps for its own instance) rather than
   sharing state with whichever `CustomerRowInfoPanel` row might currently
   be open on the Customers tab — the two are genuinely independent views
   once this tab exists (the docked panel can be closed, or moved to a
   different row, without disturbing this tab's own content), matching how
   the caller keeps every open customer tab mounted independently (see
   `openCustomerTabs`'s own doc comment, AgentWorkspace2WithDeskPage.tsx).

   No `onClose`/header X button — closing happens via the desk tab's own
   trailing remove control (the same `Tab` `onRemove` affordance every other
   removable tab in this app already uses), not a second close control
   duplicated inside the content itself. No prev/next chevrons either
   (`CustomerRowInfoPanel`'s own, for stepping through the Customers
   table's current sort order) — those are specific to that docked-panel
   workflow; this tab is anchored to one specific customer, not a walkable
   position in a list. */
export function CustomerFullScreenTabContent({
  row,
  tabs,
  onStartInteraction,
  onAddToast,
  onClose,
}: {
  row: CustomerListRecord;
  /** Same `tabs` concept every other consumer in this file takes — see
   *  `CustomerRowInfoPanel`'s own doc comment on its matching param. */
  tabs: readonly CustomerPanelTabLabel[];
  onStartInteraction: (contact: CreateNewOutboundContact, channel: ChannelType, phone: string, skillId: string) => void;
  onAddToast?: (toast: Omit<ToastItem, "id">) => void;
  /**
   * Per explicit request ("keep the 'x' button in the top right of the
   * record so agents can close it there or in the tab if they want") —
   * this tab already has its own close control on the `Tab` itself
   * (`removeIcon`/`onRemove`, the record-header `TabList` call site), but
   * that's easy to miss once a customer's full-screen tab is the ACTIVE
   * one and the agent is looking at this content, not the tab strip above
   * it. Mirrors the closable pattern every other panel header in this
   * file already has (`CustomerInformationSidePanel`'s `onClose`,
   * `CustomerRowInfoPanel`'s `onClose`) — same "there's more than one
   * reasonable place to close this from" precedent, just newly extended
   * to this tab-content variant. Optional/undefined renders no close
   * button at all (not every future consumer of this component need be
   * closable this way).
   */
  onClose?: () => void;
}) {
  const [activeTab, setActiveTab] = useState(() => CUSTOMER_PANEL_TABS.indexOf("Overview"));
  // Same unconditional "Copilot" strip as `CustomerRowInfoPanel` — see that
  // component's own doc comment on its matching `visibleTabs`: a customer
  // profile view (real interaction or not) never has anything for Copilot
  // to summarize here.
  const visibleTabs = tabs.filter((t) => t !== "Copilot");

  const customerName = `${row.firstName} ${row.lastName}`;
  const recordId = row.contactNumber;
  const fields = useMemo(() => buildCustomerInfoFields(customerName, recordId, []), [customerName, recordId]);
  const latestInteraction = useMemo(() => buildLatestInteraction(customerName, recordId), [customerName, recordId]);
  const latestNote = useMemo(() => buildLatestNote(customerName, recordId), [customerName, recordId]);
  const copilotSummary = useMemo(() => buildCopilotSummary(customerName, recordId), [customerName, recordId]);
  const recordDraft = useCustomerRecordDraft(fields, customerName, recordId);
  const [overviewEditing, setOverviewEditing] = useState(false);

  const recordActionItems: MenuEntry[] = [
    { id: "refresh", label: "Refresh Record", icon: <RefreshCw className="h-4 w-4" strokeWidth={1.5} /> },
    { id: "delete", label: "Delete Record", icon: <Trash2 className="h-4 w-4" strokeWidth={1.5} />, destructive: true },
  ];

  return (
    <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
      <PanelHeader
        title={customerName}
        subhead={recordId}
        actions={
          <>
            {/* Add Channel moved out of this header — per explicit follow-up
                request ("move the contact icon buttons into the customer
                overview and put them next to the edit button in a row above
                the other information"), it now lives inside the Customer
                Overview accordion's own top row instead (see
                `CustomerInformationPanelBody`'s `row`/`onStartInteraction`
                props, wired below at this component's own body call site). */}
            <KebabMenuButton
              items={recordActionItems}
              ariaLabel="Record actions"
              className="h-8 w-8"
              icon={<MoreVertical className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
            />
            {onClose && (
              <ActionIconButton aria-label={`Close ${customerName}`} title={`Close ${customerName}`} onClick={onClose}>
                <X className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              </ActionIconButton>
            )}
          </>
        }
        tabs={
          <TabList className="px-4" overflowMenu>
            {visibleTabs.map((label) => (
              <Tab
                key={label}
                active={activeTab === CUSTOMER_PANEL_TABS.indexOf(label)}
                onClick={() => setActiveTab(CUSTOMER_PANEL_TABS.indexOf(label))}
              >
                {label}
              </Tab>
            ))}
          </TabList>
        }
      />
      <PanelContent>
        <CustomerInformationPanelBody
          activeTab={activeTab}
          customerName={customerName}
          latestInteraction={latestInteraction}
          latestNote={latestNote}
          copilotSummary={copilotSummary}
          recordId={recordId}
          channels={[]}
          onViewAllInteractions={
            visibleTabs.includes("Contacts")
              ? () => setActiveTab(CUSTOMER_PANEL_TABS.indexOf("Contacts"))
              : undefined
          }
          draft={recordDraft.draft}
          onDraftChange={recordDraft.updateDraft}
          onPhoneChange={recordDraft.updatePhone}
          onOverviewFieldChange={recordDraft.updateOverviewField}
          overviewEditing={overviewEditing}
          onOverviewEditingChange={setOverviewEditing}
          allowOverviewEdit
          // Feeds the Customer Overview accordion's own new top row of
          // channel-launch buttons — see `CustomerInformationPanelBody`'s
          // `row`/`onStartInteraction` doc comments, and this component's
          // own `actions` above (where `CustomerAddChannelButton` used to
          // render before this follow-up request moved it here).
          row={row}
          onStartInteraction={onStartInteraction}
        />
      </PanelContent>
      {(recordDraft.isDirty || overviewEditing) && (
        <PanelFooter>
          <CustomerRecordSaveFooter
            onSave={() => {
              recordDraft.save();
              setOverviewEditing(false);
              onAddToast?.({
                variant: "success",
                title: "Success",
                message: `${row.firstName} ${row.lastName} customer record saved`,
                duration: 4000,
              });
            }}
            onCancel={() => {
              recordDraft.cancel();
              setOverviewEditing(false);
            }}
          />
        </PanelFooter>
      )}
    </div>
  );
}

/** Full artifacts list shown in the docked Contact Details panel after "View All". */
export function ArtifactsListBody({
  artifacts,
  onOpenArtifact,
}: {
  artifacts: { id: string; label: string }[];
  onOpenArtifact: (id: string) => void;
}) {
  return (
    <ul className="flex flex-col divide-y divide-lyra-border-subtle px-4">
      {artifacts.map((a) => (
        <li key={a.id}>
          <button
            type="button"
            onClick={() => onOpenArtifact(a.id)}
            className="flex w-full items-center gap-2 py-3 text-left hover:bg-lyra-state-hover"
          >
            <Paperclip className="h-4 w-4 shrink-0 text-lyra-fg-secondary" strokeWidth={1.5} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate lyra-body-md text-lyra-fg-link">{a.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
