// Contact History card (home tab, below Performance/Productivity) — see
// agent-next-gen-shared-utils.ts and sibling agent-next-gen-*.ts(x) files
// for everything AgentNextGenPage.tsx itself no longer declares — split out
// once that file crossed Babel's 500KB code-generator threshold.
import { useState, useMemo, useEffect, type ComponentType, type ReactNode } from "react";
import {
  type TagVariant,
  type ChannelType,
  Tooltip,
  Popover,
  RadioGroup,
  RadioGroupItem,
  Button,
  filterChipVariants,
  DashboardCard,
  Icon,
  SearchInput,
  Badge,
  Tag,
  Label,
  WhatsAppIcon,
  ChatMessage,
  TableFooter,
  VoiceDirectionIcon,
  SmsDirectionIcon,
  formatPhoneForDisplay,
} from "@nicecxone/lyra-ui";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { type Interaction } from "@/components/agent-next-gen-interaction-dashboard";
import { formatElapsedTime, CURRENT_AGENT_NAME, initialsFor } from "@/components/agent-next-gen-shared-utils";
import { OUTCOME_DISPOSITION_OPTIONS } from "@/components/agent-next-gen-transcript";
import { cn } from "@/lib/utils";
import {
  type LucideIcon,
  Phone,
  MessageCircle,
  MessageSquare,
  Mail,
  ChevronDown,
  MoreVertical,
  History,
  Inbox,
} from "lucide-react";

// Per explicit request ("for phase 1 we will not have the transcript
// available"), then an explicit follow-up ("don't entirely remove
// transcript, just hide it") — same "hide, don't destroy" pattern this
// app already uses elsewhere (`SHOW_CHANNEL_TOGGLE_GROUP`/
// `SHOW_END_CALL_IN_INTERACTION_NAV_ROWS`, AgentWorkspaceAdvancedPage.tsx):
// `ContactHistoryEntryDetail`'s own synthesized "Transcript" section
// (`buildContactHistoryMessages` — there's no REAL recorded transcript for
// a voice call in this app) stays fully implemented, just gated off by
// this flag for voice specifically. Restoring it is a one-line flip, not
// re-authoring.
const SHOW_VOICE_TRANSCRIPT_IN_CONTACT_HISTORY = false;

/* ── Contact History card (home tab, below Performance/Productivity) ──
   A recent-customer-contacts summary — name, resolution status, a one-line
   case summary, case ID, and (right-aligned) the channel + how long ago it
   happened, plus the handle time. The base 5 rows (`CONTACT_HISTORY`) are
   from a screenshot of exactly this content, so those values are that
   screenshot's own data, not derived from any other part of the app.
   Composed entirely from existing lyra-ui atoms — `DashboardCard` for the
   card shell (`headerActions` holding this card's own
   `ContactHistoryDateFilterChip` — a separate, 3-option "Today / Last 48
   Hours / Last 72 Hours" control, not the shared `DateFilterChip` the
   Performance/Productivity cards' headers use, since this card's range
   options and cumulative-window semantics are its own — see
   `ContactHistoryDateFilterValue`'s own doc comment for why), and `Badge`
   (`shape="circle" dot`) + plain text for the status indicator
   (critical=red/Escalated, info=blue/In Progress, success=green/Resolved,
   neutral=gray/New) — no hand-rolled badge/pill markup.

   Per explicit request: clicking a row no longer reopens the contact
   directly. It instead opens this same entry's summary
   (`ContactHistoryEntryDetail` below) in `AgentNextGenPage`'s shared
   right-docked `InteriorPanel` slot — the same panel type the home tab's
   Queue widgets already drill into (`selectedQueueId`), just a third job
   for that one slot (see that file's own doc comment on why one slot
   serves multiple jobs). "Redial" (voice contacts only, reusing the same
   `PhoneOutgoing` icon `InteractionRowActions`' kebab menu already uses for
   its own "Redial" action) and "Re-open" (reusing the same `RotateCcw` icon
   that same menu's own "Reopen" entry uses) now live as footer buttons on
   that panel instead of directly on the row — clicking either is what
   actually reopens the contact as a live assignment in the left nav (the
   row's own previous click behavior), read the summary first.

   Row set is driven by the selected date range (`buildContactHistoryByRange`):
   "Today" starts EMPTY on login — there's no real backend here to have
   loaded any actual prior-contact history from, so this app no longer
   pretends otherwise with hand-authored placeholder rows the way it used
   to (a `TODAY_CONTACT_HISTORY` fixture, since removed). "Today" instead
   fills in for real, as the agent actually works: "Unassign & Dismiss"ing
   a whole assignment (`handleDismissInteraction`, main component) is what
   counts as a completed contact in this demo, and appends a genuine
   `ContactHistoryEntry` (`buildDismissedContactHistoryEntry`) onto
   `dismissedContactHistory` state — the one truly live piece of this
   card's data. Dismissing does NOT change that entry's status, though: it
   logs at the same neutral "Resolved" default every hand-authored
   `CONTACT_HISTORY` row's own closed-the-loop case uses, never a forced
   "Closed"/read-only one — an earlier pass tried that and it conflated
   leaving an assignment (a LeftNav/UI action) with the assignment's own
   status (a real-world fact about the case); per explicit follow-up,
   dismissing must never itself decide or change that. "Last 48 Hours"
   adds the 5 hand-authored `CONTACT_HISTORY` rows on top of whatever's
   been dismissed so far; "Last 72 Hours" adds 5 more
   (`EXTENDED_CONTACT_HISTORY`) pulled from the shared customer "database"
   (`CREATE_NEW_CUSTOMERS`, the same fixture `OUTBOUND_CUSTOMERS` above
   already sources from) rather than inventing unrelated names. Each range
   is a strict superset of the one before it — today's own (dismissed)
   rows never disappear just because a wider range is selected. */

/** Case-status color — "critical" (red, Escalated), "info" (blue, Pending),
 *  "warning" (orange, Open), "success" (green, Resolved), "neutral" (gray,
 *  New/Closed). Reuses `Badge`'s own `BadgeCircleVariant` names directly
 *  (see the status badge's own rendering below) rather than a separate
 *  string union, so there's no separate mapping table that could drift out
 *  of sync with what `Badge` actually accepts. Gained "warning" alongside
 *  `SESSION_STATUS_TO_CONTACT_HISTORY_VARIANT` below — until then this only
 *  ever needed to represent the 4 statuses this card's own fixtures used
 *  (Escalated/Resolved/New, "In Progress" never actually used), not the
 *  full 5-status vocabulary `TRANSCRIPT_SESSION_STATUS_OPTIONS` offers. */
export type ContactHistoryStatusVariant = "critical" | "info" | "warning" | "success" | "neutral";

/** Maps a session status (`TRANSCRIPT_SESSION_STATUS_OPTIONS`' labels —
 *  Open/Pending/Escalated/Resolved/Closed) onto this card's own
 *  `ContactHistoryStatusVariant`, so `buildDismissedContactHistoryEntry`
 *  can log whatever status was actually last assigned to a dismissed
 *  interaction's primary channel (`Interaction.channelStatuses`) with a matching dot
 *  color, instead of a hardcoded "Resolved"/"success" regardless. "Closed"
 *  maps to "neutral" (gray) rather than reusing "critical" — a closed
 *  contact isn't a negative outcome the way "Escalated" is, and reusing red
 *  for both would read as if every closed row were also escalated. Falls
 *  back to "neutral" for any status not listed (defensive only — every
 *  value `TRANSCRIPT_SESSION_STATUS_OPTIONS` can actually produce is
 *  covered). */
export const SESSION_STATUS_TO_CONTACT_HISTORY_VARIANT: Record<string, ContactHistoryStatusVariant> = {
  Open: "warning",
  Pending: "info",
  Escalated: "critical",
  Resolved: "success",
  Closed: "neutral",
};

export interface ContactHistoryEntry {
  id: string;
  name: string;
  statusLabel: string;
  statusVariant: ContactHistoryStatusVariant;
  /** Voice contacts only — shows a "Redial" footer button (alongside
   *  "Re-open") on this entry's summary panel, see this file's own
   *  "Contact History card" doc comment above. */
  redial: boolean;
  description: string;
  caseId: string;
  /**
   * The routing skill this contact was handled under (e.g. "Technical
   * Support", "Billing") — per explicit follow-up, with a screenshot of the
   * Contact History card's row list: "instead of using the Customer ID in
   * the third row - use the Skill Name." `caseId` itself is untouched
   * (still the real customer-id lookup key everything from redial/reopen to
   * `agent-next-gen-case-database.ts` keys off — see that field's own doc
   * comment) — this is purely a second, display-only field for that one
   * row. Not one of `OUTBOUND_CONFIG.skillOptions`'s own option OBJECTS
   * (importing from agent-next-gen-outbound-data.tsx here would be
   * circular — that file already imports `ContactHistoryEntry`/
   * `CONTACT_HISTORY` from this one), just a plain string matching one of
   * that same picker's labels for cosmetic consistency with the rest of the
   * app's skill-routing vocabulary.
   */
  skillName: string;
  /**
   * This row's real originating channel — every `ChannelType` value is
   * possible here (voice/chat/sms/whatsapp/email), NOT a narrowed display
   * grouping. Previously this collapsed sms/whatsapp down into "chat" (via
   * a since-removed `contactHistoryChannelType` helper) — a real, shipped
   * bug: a dismissed SMS interaction's history row showed a "Chat" tag,
   * and reopening it rebuilt a literal `chat`-type `Thread` instead of an
   * `sms` one, which in turn left the real SMS channel un-flagged as
   * "already open" so it wrongly still showed as addable. Fixed per
   * explicit bug report — this field (and everything keyed by it —
   * `channelLabel`, `CONTACT_HISTORY_CHANNEL_ICON`/`_LABEL`/
   * `_TAG_VARIANT`, `CHANNEL_TYPE_ICON_COLOR_CLASS`) must always carry the
   * real channel type through losslessly.
   */
  channelType: ChannelType;
  channelLabel: string;
  timeAgo: string;
  duration: string;
  /** Resolved disposition label (e.g. "Issue Resolved") and tag labels the
   *  agent picked in the Outcome popover before dismissing — see
   *  `buildDismissedContactHistoryEntry`'s own `channelOutcomeSelections`
   *  parameter. `undefined` for every entry that didn't come from that
   *  flow (hand-authored rows, `buildContactHistoryFromCustomers`, or a
   *  dismissal where the agent never opened Outcome) — the gray card
   *  simply doesn't show these rows then. */
  dispositionLabel?: string;
  tags?: string[];
  /** The real `CREATE_NEW_CUSTOMERS` record id backing this row, when this
   *  entry was built from that fixture (see `buildContactHistoryFromCustomers`
   *  below) — undefined for the hand-authored `CONTACT_HISTORY` rows above,
   *  which have no real customer record behind their invented names/case
   *  IDs. `handleRedial` uses this (when present) as the redialed
   *  interaction's own id instead of a synthetic `redial:` one, so the
   *  resulting card's id resolves in `useAddChannelButton`'s contact
   *  lookup the exact same way a card started from the Outbound picker
   *  does — see `handleRedial`'s own doc comment for why a synthetic id
   *  silently broke that card's "+" (Add Channel) button. */
  customerId?: string;
  /** Every OUTBOUND-startable channel this customer can be reached on —
   *  same field/purpose as `CreateNewOutboundContact.channels`, and, for
   *  the 5 hand-authored rows above with no real `customerId`, the ONLY
   *  place that data exists at all (a `CREATE_NEW_CUSTOMERS`-backed row
   *  gets this for free via that record's own `channels` field instead —
   *  see `buildContactHistoryOutboundContacts`, agent-next-gen-outbound-
   *  data.tsx, which is what actually reads this). Per explicit request:
   *  reopening/redialing one of these 5 rows used to leave the record
   *  header's "+" (Add Channel) row completely empty — `useAddChannelButton`
   *  had no contact record to look up under `history:${id}`/`redial:${id}`
   *  (the synthetic ids these rows fall back to with no `customerId`), so
   *  `getAvailableChannels` always came back `[]` even for a customer who
   *  plainly has other channels on file. Voice/Chat/Email aren't
   *  necessarily included even when `channelType` is one of them — Chat in
   *  particular never is, since a website chat widget has no "start one
   *  outbound" concept for `useAddChannelButton` to offer regardless of
   *  who the customer is (same reason `CUSTOMER_CHANNEL_ORDER`, agent-
   *  next-gen-customers-table.tsx, never includes "chat" either). */
  channels?: ChannelType[];
  /**
   * True for a row that represents a genuinely closed/over conversation —
   * NOT set by "Unassign & Dismiss" (`buildDismissedContactHistoryEntry`
   * logs a normal "Resolved" row, per explicit follow-up: dismissing must
   * never itself decide or change an assignment's status; see this file's
   * own "Contact History card" doc comment above), only ever hand-authored
   * on a `ContactHistoryEntry` directly if a future row needs it. Every
   * status this app's own rows actually use (New/Open/Pending/Escalated/
   * Resolved — the hand-authored `CONTACT_HISTORY`/`EXTENDED_CONTACT_HISTORY`
   * rows, and every dismissed row, all use "Resolved"/"Escalated") is still
   * an active, appendable conversation once reopened; none of them set
   * this. `closed` drives `handleReopenContactHistoryEntry` →
   * `Interaction.closed`: a closed interaction reopens read-only (an
   * inline "You are viewing a closed interaction." banner, no
   * `InteractionComposer`, no per-channel kebab actions) instead of a
   * normal, reply-able one. A plain boolean rather than checking
   * `statusLabel === "Closed"` by string — display text shouldn't double as
   * the thing behavior branches on. */
  closed?: boolean;
  /**
   * The `Interaction.interactionId` this row was logged from, when this
   * entry was built by `buildDismissedContactHistoryEntry` (i.e. "Unassign
   * & Dismiss" ended a real, live `Interaction`) — undefined for every
   * hand-authored `CONTACT_HISTORY`/`EXTENDED_CONTACT_HISTORY` row, since
   * those never existed as a live `Interaction` in the first place. Purely
   * a traceability breadcrumb (not read by any handler today): once an
   * `Interaction` ends, this is the only place its own id survives, so a
   * dismissed journey stays identifiable in history instead of being
   * discarded outright.
   */
  interactionId?: string;
  /**
   * This row's real email address, when known — populated for every
   * `CREATE_NEW_CUSTOMERS`-backed row (`customer.emailAddress`) and every
   * dismissed row whose primary `Thread` was itself an email channel
   * (`primaryChannel.addressLabel`/`.value`). Read by
   * `contactHistoryDisplayIdentity` (below) for `channelType === "email"`
   * rows once names are hidden — see that function's own doc comment for
   * why. Undefined wherever no real address is known, in which case that
   * function falls back to `name` rather than showing nothing.
   */
  email?: string;
  /**
   * This row's real phone number, when known — same populate/consume
   * pattern as `email` above, but for `channelType === "voice"`/`"sms"`
   * rows (`customer.firstPhone`, or the dismissed row's primary `Thread`
   * address).
   */
  phone?: string;
  /**
   * This row's real WhatsApp handle, when known — same pattern again, for
   * `channelType === "whatsapp"` rows. Synthesized as `@${name}` for
   * `CREATE_NEW_CUSTOMERS`-backed rows, matching lyra-ui's own
   * `resolveOutboundDetailField` convention (create-new.tsx) for a
   * contact with no dedicated `whatsappHandle`-style field on file yet.
   */
  whatsappHandle?: string;
  /**
   * The real message thread this row's own conversation actually had, when
   * known — populated by `buildDismissedContactHistoryEntry` from the
   * dismissed `Interaction`'s own `liveMessages` (the same real transcript
   * data the record view's live "Conversation" panel reads — see
   * `TranscriptMessage`, agent-next-gen-transcript.tsx), converted into this
   * file's own `ContactHistoryMessage` shape. Per explicit bug report, with
   * a screenshot of a Marcus Webb Contact History row's own detail panel
   * showing generic wrap-up chatter that never actually happened in his
   * real chat: "contact history of Marcus Webb should reflect the actual
   * conversation in the right conversation area of the interior panel."
   *
   * Also hand-authored directly, per a later explicit follow-up ("author
   * the real per-entry message[s]"), on 4 of the 5 `CONTACT_HISTORY` fixture
   * rows below (every voice/chat one — Nathan Cole, Priya Shah, Lauren
   * Briggs, Mei Tanaka; Omar Farooq's row is email, which uses `emailBody`
   * below instead, `ContactHistoryEntryDetail`'s own message-thread section
   * doesn't apply to it) — this and `entry.description` used to be the only
   * two places a hand-authored row's own case showed up at all, and they
   * never agreed: `description` read as, say, Priya Shah's real "Duplicate
   * charge dispute — $89.99 refund issued," while this panel's own
   * conversation fell back to `buildContactHistoryMessages`'s generic,
   * hash-selected pool text with no relation to that case at all. Every
   * OTHER hand-authored row (`EXTENDED_CONTACT_HISTORY`,
   * `CONTACT_HISTORY_STRESS_BATCH`) and every `CREATE_NEW_CUSTOMERS`-backed
   * row (`buildContactHistoryFromCustomers`) still leaves this undefined —
   * authoring real content only makes sense for a small, fixed, named set of
   * rows, not a batch generated at scale — so `ContactHistoryEntryDetail`
   * still falls back to `buildContactHistoryMessages` for those, unchanged.
   * Also undefined for a real dismissed row whose primary channel never
   * actually accumulated any `liveMessages` (e.g. a voice call, where
   * `InteractionComposer`'s typed-message flow doesn't apply) — same
   * fallback applies there too.
   */
  messages?: ContactHistoryMessage[];
  /**
   * This row's real email "Body" text, when hand-authored — same idea as
   * `messages` just above, but for an email-channel row: `messages`'s own
   * `ContactHistoryEntryDetail` section doesn't apply to email (see
   * `isMessageChannel` at that component's own call site), which instead
   * shows a "Body" section built by `buildContactHistoryEmailBody` — a
   * generic, hash-selected paragraph with no relation to `entry.description`
   * either, the exact same mismatch `messages` fixes for voice/chat/sms/
   * whatsapp rows. Populated only for Omar Farooq's row (`CONTACT_HISTORY`'s
   * one email entry) — every other row leaves this undefined and keeps
   * falling back to `buildContactHistoryEmailBody`, unchanged.
   */
  emailBody?: string;
  /** Whether this row's channel was customer-initiated ("inbound") or
   *  agent-initiated ("outbound") — per explicit request (Agent Workspace
   *  2.0 Phase 1 & Phase 2 only), drives the direction-aware voice/SMS icon
   *  swap at both `ContactHistoryCard`'s row list and
   *  `ContactHistoryEntryDetail`'s own summary line (see
   *  `CONTACT_HISTORY_CHANNEL_ICON`'s own doc comment for the icon lookup
   *  this augments). For a row built from a real dismissed live
   *  `Interaction`/`Thread` (`buildDismissedContactHistoryEntry`), carried
   *  straight through from that Thread's own `direction` (agent-next-gen-
   *  interaction-dashboard.tsx) rather than re-derived. `redial` above is
   *  NOT a usable stand-in for this — it's true for every voice row
   *  regardless of which way that call actually went. Omit for a channel
   *  type this feature doesn't cover (chat/email/whatsapp) — the icon
   *  lookup falls back to its plain, pre-existing glyph in that case. */
  direction?: "inbound" | "outbound";
}

/**
 * Per-`channelType` display identity for a Contact History row — real
 * reach-back address instead of the customer's name: WhatsApp shows the
 * row's `whatsappHandle`, Voice/SMS shows `phone`, Email shows `email`.
 * Chat still shows the customer's name (no separate "chat handle" concept
 * exists to show instead). Falls back to `name` wherever the specific
 * field this row would need isn't populated (e.g. a dismissed quick-dialed
 * row with no captured `Thread.value`), so a row never renders with no
 * identity at all.
 *
 * Two call sites, two different reasons: `ContactHistoryCard` uses this
 * only when its own `hideCustomerNames` prop is set (Agent Workspace 2.0
 * only — see that prop's doc comment) — masking real names entirely.
 * `ContactHistoryEntryDetail` uses this unconditionally, in every tier —
 * see that component's own doc comment — to avoid restating the name its
 * caller's `InteriorPanel` `headerTitle` already shows just above it.
 */
export function contactHistoryDisplayIdentity(entry: ContactHistoryEntry): string {
  if (entry.channelType === "chat") return entry.name;
  // `formatPhoneForDisplay` normalizes `whatsappHandle`/`phone` for display
  // regardless of which of this app's several coexisting raw mock-data
  // formats (E.164 with/without spaces, bare US-formatted) produced the
  // underlying value — see that function's own doc comment. It's a no-op
  // for a non-phone-shaped WhatsApp handle, so this is safe unconditionally.
  if (entry.channelType === "whatsapp") return formatPhoneForDisplay(entry.whatsappHandle) || entry.name;
  if (entry.channelType === "email") return entry.email ?? entry.name;
  return formatPhoneForDisplay(entry.phone) || entry.name;
}

/** One turn in a Contact History row's synthesized chat/SMS/WhatsApp
 *  message thread — see `buildContactHistoryMessages` below for where this
 *  gets built. Deliberately a separate, file-local type from
 *  `CustomerHistoryConversationMessage` (agent-next-gen-customer-info-
 *  panel.tsx) even though the shape is identical — importing it here would
 *  be circular (that file already imports `ContactHistoryStatusVariant`
 *  from this one). */
export interface ContactHistoryMessage {
  sender: "customer" | "agent";
  text: string;
  timestampDisplay: string;
}

// Per explicit follow-up request, with a screenshot of the summary panel:
// "please display the transcript/email body content/chat below the info
// box in the contact history interior panel." This app has no real
// backend/transcript data for any Contact History row (same caveat this
// file's own top-of-file doc comment already makes for its other dummy
// data), so what shows below the info box is synthesized rather than
// looked up — generic, plausible-reading content, not scripted to each
// row's own `description`, picked deterministically per row
// (`hashContactHistoryId`, not `Math.random()`) so the same row always
// renders the same content on every open.
//
// Per a further explicit follow-up on a voice row's own screenshot ("for
// voice can you have a fake transcript?"), voice rows get one too — a
// synthesized call transcript, same bubble UI as chat/SMS/WhatsApp's own
// message thread, just with call-appropriate pool wording and its own
// "Transcript" section label instead of "Conversation" (see
// `buildContactHistoryMessages`/`ContactHistoryEntryDetail` below). This
// supersedes an earlier version of this feature that deliberately left
// voice rows with nothing extra here, reasoning the info box's own "Call
// Notes" already covered a call's content — per this follow-up, that
// wasn't actually what "transcript" meant in the original request.
const CONTACT_HISTORY_CHAT_CUSTOMER_MESSAGE_POOL = [
  "Hi, I wanted to follow up on this.",
  "Thanks for taking a look — let me know what you find.",
  "Sorry, one more question before we wrap up.",
  "That makes sense, thank you for explaining!",
];
const CONTACT_HISTORY_CHAT_AGENT_MESSAGE_POOL = [
  "Of course — let me pull up your account.",
  "I can see that here now, one moment.",
  "You're all set. Is there anything else I can help with?",
  "Happy to help — have a great rest of your day!",
];

// Same idea as the chat pools above, worded to read as spoken dialogue
// rather than typed messages — a voice row's "Transcript" section picks
// from these instead (see `buildContactHistoryMessages` below).
const CONTACT_HISTORY_VOICE_CUSTOMER_MESSAGE_POOL = [
  "Hi, I'm calling about the issue on my account.",
  "Okay, that's right, thanks for confirming.",
  "Sorry, could you repeat that last part?",
  "Got it, that answers my question — thank you.",
];
const CONTACT_HISTORY_VOICE_AGENT_MESSAGE_POOL = [
  "Thanks for calling — can I get your name and verify a couple details first?",
  "Perfect, I have your account pulled up now.",
  "Sure, let me walk you through that again.",
  "You're all set. Is there anything else I can help you with today?",
];

// Fuller, generic paragraphs for the email "Body" section — deliberately
// distinct wording from `entry.description` (the info box's own short
// one-line summary, labeled "Email Summary"), so the two sections don't
// just repeat each other.
const CONTACT_HISTORY_EMAIL_BODY_POOL = [
  "Thanks for reaching out. I've reviewed your account and confirmed the details below — let me know if anything looks off and I'll follow up right away.",
  "Following up on our conversation — everything's been updated on our end. You should see the change reflected within the next billing cycle.",
  "Wanted to make sure you had this in writing for your records. Please reach back out if you have any other questions in the meantime.",
  "Thanks for your patience while we looked into this. Here's a summary of what we found and the steps we took to resolve it.",
];

/** Deterministic (`id`-keyed, not `Math.random()`) pool index — same "no
 *  real backend" dummy-data convention as the rest of this file's fixtures,
 *  kept local to this section since nothing else needs it. */
function hashContactHistoryId(id: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 999979;
  return Math.abs(hash) % mod;
}

/** The message thread shown below `ContactHistoryEntryDetail`'s info box
 *  for a voice/chat/SMS/WhatsApp row — 3-4 lines, alternating customer/
 *  agent, starting with the customer. Voice rows pick from the
 *  call-worded pools (`CONTACT_HISTORY_VOICE_*`); every other channel type
 *  here picks from the typed-message pools (`CONTACT_HISTORY_CHAT_*`). See
 *  the pools' own doc comment above for why none of this is case-specific.
 *  Times are synthesized too (no real captured timestamps exist for these
 *  rows), stepping forward a couple minutes per turn from a deterministic
 *  starting time. */
function buildContactHistoryMessages(entry: ContactHistoryEntry): ContactHistoryMessage[] {
  const count = 3 + hashContactHistoryId(entry.id, 2); // 3 or 4 turns
  const startHour = 9 + hashContactHistoryId(`${entry.id}-h`, 3); // 9-11
  const startMinute = hashContactHistoryId(`${entry.id}-m`, 60);
  const isVoice = entry.channelType === "voice";
  const customerPool = isVoice ? CONTACT_HISTORY_VOICE_CUSTOMER_MESSAGE_POOL : CONTACT_HISTORY_CHAT_CUSTOMER_MESSAGE_POOL;
  const agentPool = isVoice ? CONTACT_HISTORY_VOICE_AGENT_MESSAGE_POOL : CONTACT_HISTORY_CHAT_AGENT_MESSAGE_POOL;
  return Array.from({ length: count }, (_, i) => {
    const isCustomer = i % 2 === 0;
    const pool = isCustomer ? customerPool : agentPool;
    const totalMinutes = startMinute + i * 2;
    const hour = (startHour + Math.floor(totalMinutes / 60)) % 24;
    const minute = totalMinutes % 60;
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return {
      sender: isCustomer ? "customer" : "agent",
      text: pool[hashContactHistoryId(`${entry.id}-${i}`, pool.length)],
      timestampDisplay: `${displayHour}:${minute.toString().padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`,
    } satisfies ContactHistoryMessage;
  });
}

/** The "Body" text shown below `ContactHistoryEntryDetail`'s info box for
 *  an email row — see `CONTACT_HISTORY_EMAIL_BODY_POOL`'s own doc comment
 *  for why this is separate content from `entry.description`, not a reuse
 *  of it. */
function buildContactHistoryEmailBody(entry: ContactHistoryEntry): string {
  return CONTACT_HISTORY_EMAIL_BODY_POOL[hashContactHistoryId(entry.id, CONTACT_HISTORY_EMAIL_BODY_POOL.length)];
}

/** One read-only customer/agent bubble for `ContactHistoryEntryDetail`'s
 *  own synthesized message thread (chat/SMS/WhatsApp rows only) — was a
 *  hand-rolled copy of the live-transcript bubble markup (nearly identical
 *  to `CustomerHistoryConversationMessageBubble`, agent-next-gen-customer-
 *  info-panel.tsx's own equivalent), now just a thin adapter over lyra-ui's
 *  shared `ChatMessage` — same component the real, in-progress transcript
 *  uses (`TranscriptMessageBubble` above). No `onCopy`/`tagOptions` passed
 *  — this is closed history, nothing to copy/tag in-progress, and
 *  `ChatMessage`'s own toolbar stays hidden entirely when those are
 *  omitted. `customerName`/`agentName` — this component doesn't know either
 *  on its own (`ContactHistoryMessage` carries no name field), so
 *  `ContactHistoryEntryDetail` passes both down from `entry`/
 *  `CURRENT_AGENT_NAME`. */
function ContactHistoryMessageBubble({
  message,
  customerName,
  agentName,
}: {
  message: ContactHistoryMessage;
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

/** One turn in a voice row's synthesized call transcript
 *  (`ContactHistoryEntryDetail`'s own "Transcript" section, voice rows
 *  only) — per explicit follow-up, with a reference screenshot: a plain
 *  "Name  timestamp" header line (bold name, secondary-colored time) with
 *  the spoken line below it, stacked top-to-bottom for every turn
 *  regardless of speaker — NOT `ContactHistoryMessageBubble`'s own chat-
 *  style avatar/bubble/left-right layout, which the reference screenshot
 *  explicitly doesn't use for a call transcript. Speaker name is the real
 *  logged-in agent (`CURRENT_AGENT_NAME`, agent-next-gen-shared-utils.ts —
 *  matches the reference screenshot's own "John Smith") for an agent turn,
 *  this row's own customer name (`entry.name`) for a customer turn — not
 *  generic "Agent"/"Customer" labels. */
function ContactHistoryTranscriptLine({
  message,
  customerName,
}: {
  message: ContactHistoryMessage;
  customerName: string;
}) {
  const speakerName = message.sender === "customer" ? customerName : CURRENT_AGENT_NAME;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span className="lyra-body-md-emphasis text-lyra-fg-default">{speakerName}</span>
        <span className="lyra-body-sm text-lyra-fg-secondary">{message.timestampDisplay}</span>
      </div>
      <p className="lyra-body-md text-lyra-fg-default">{message.text}</p>
    </div>
  );
}

export const CONTACT_HISTORY_CHANNEL_ICON: Record<
  ContactHistoryEntry["channelType"],
  LucideIcon | ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  voice:    Phone,
  chat:     MessageCircle,
  sms:      MessageSquare,
  whatsapp: WhatsAppIcon,
  email:    Mail,
};

/** Direction-aware channel icon for a Contact History row/detail — per
 *  explicit request (Agent Workspace 2.0 Phase 1 & Phase 2 only): voice/sms
 *  rows swap to `VoiceDirectionIcon`/`SmsDirectionIcon` (lyra-ui, channel-
 *  row.tsx) once `entry.direction` is known, landing on the exact same
 *  `PhoneIncoming`/`PhoneOutgoing`/arrow-badge treatment `InteractionNavItem`
 *  and the transcript's own session row use, so all three surfaces read as
 *  one consistent system. Falls back to the plain `CONTACT_HISTORY_CHANNEL_
 *  ICON` lookup for every other channel type (and for voice/sms with no
 *  `direction` set) — every existing caller/entry without a `direction`
 *  renders exactly as before. */
export function contactHistoryChannelIcon(entry: ContactHistoryEntry, className = "h-3 w-3") {
  if (entry.channelType === "voice") return <VoiceDirectionIcon direction={entry.direction} className={className} />;
  if (entry.channelType === "sms") return <SmsDirectionIcon direction={entry.direction} className={className} />;
  const ChannelIcon = CONTACT_HISTORY_CHANNEL_ICON[entry.channelType];
  return <ChannelIcon className={className} strokeWidth={1.5} />;
}

/** Per explicit request ("when hovering on the channel chips - add a
 *  tooltip that is {channel name} ie. inbound voice / outbound voice /
 *  sms / chat / whatsapp / etc.", then follow-up: "make sure this is
 *  added to all channel chips - I noticed contact history chips do not
 *  have the tooltip") — same direction-aware-for-voice-only text
 *  `ChannelRow`'s own chip tooltip uses (`ChannelRowProps.tooltipLabel`,
 *  channel-row.tsx), computed here for this file's own separate Contact
 *  History `Tag` pill (`CONTACT_HISTORY_CHANNEL_LABEL`/
 *  `CONTACT_HISTORY_CHANNEL_TAG_VARIANT`, not `channel-row.tsx`'s own
 *  `CHANNEL_TYPE_META` — this file keeps its own parallel set, see
 *  `CONTACT_HISTORY_CHANNEL_TAG_VARIANT`'s own doc comment). */
export function contactHistoryChannelTooltipLabel(entry: ContactHistoryEntry): string {
  if (entry.channelType === "voice") {
    return entry.direction === "inbound"
      ? "Inbound Voice"
      : entry.direction === "outbound"
      ? "Outbound Voice"
      : "Voice";
  }
  return entry.channelLabel;
}

// Per explicit follow-up request ("author the real per-entry message[s]"):
// each of these 5 rows' own `messages`/`emailBody` below is hand-authored to
// actually match that row's own `description`/`statusLabel` — previously
// undefined on every one of them (see `messages`'s own doc comment for the
// full "why"), which left `ContactHistoryEntryDetail`'s own Conversation/
// Transcript/Body section always showing `buildContactHistoryMessages`'/
// `buildContactHistoryEmailBody`'s generic, hash-selected filler with no
// relation to the row it was supposedly the transcript of.
export const CONTACT_HISTORY: ContactHistoryEntry[] = [
  {
    id: "ch1", name: "Nathan Cole", statusLabel: "Resolved", statusVariant: "success", redial: true,
    description: "Customer was locked out after 5 failed attempts. Verified identity via KBA, reset credentials, and confirmed access restored.",
    caseId: "CST-22841", skillName: "Technical Support", channelType: "voice", channelLabel: "Voice", timeAgo: "8m ago", duration: "8m 14s",
    direction: "inbound",
    // Per explicit request ("add these contacts to the database ... tied
    // to the database instead of a one-off") — the real backing
    // `CREATE_NEW_CUSTOMERS` record's own `id` (create-new-customers-data.ts,
    // lyra-ui), not this row's `caseId` — see that record's own doc comment
    // for the full "why" and for the previously-real bug this fixes
    // (redialing/reopening this same case via different entry points used
    // to compute different fallback ids and open a second, wrong card).
    customerId: "nathan-cole-history",
    channels: ["voice", "sms", "email"],
    phone: "(704) 555-0142", email: "nathan.cole@example.com", whatsappHandle: "@Nathan Cole",
    messages: [
      { sender: "customer", text: "Hi, I'm locked out of my account — I think I've tried logging in too many times.", timestampDisplay: "9:02 AM" },
      { sender: "agent", text: "Sorry to hear that, Nathan. Let's get you back in — can I verify a couple of details on the account first?", timestampDisplay: "9:03 AM" },
      { sender: "customer", text: "Sure, go ahead.", timestampDisplay: "9:05 AM" },
      { sender: "agent", text: "Great, that checks out. I've reset your credentials and sent a new temporary password to your email on file.", timestampDisplay: "9:07 AM" },
      { sender: "customer", text: "Got it, that worked — I'm back in now. Thank you!", timestampDisplay: "9:09 AM" },
      { sender: "agent", text: "You're all set. Let me know if you run into any more trouble.", timestampDisplay: "9:10 AM" },
    ],
  },
  {
    id: "ch2", name: "Priya Shah", statusLabel: "Resolved", statusVariant: "success", redial: false,
    description: "Duplicate charge dispute — $89.99 refund issued",
    caseId: "CST-30164", skillName: "Billing", channelType: "chat", channelLabel: "Chat", timeAgo: "34m ago", duration: "12m 02s",
    // See "ch1"'s identical `customerId` comment just above for the full
    // "why" — same fix, same real backing record (PRIYA_SHAH_CUSTOMER_RECORD,
    // create-new-customers-data.ts).
    customerId: "priya-shah-history",
    channels: ["email", "sms"],
    phone: "(415) 555-0178", email: "priya.shah@example.com", whatsappHandle: "@Priya Shah",
    messages: [
      { sender: "customer", text: "Hi, I noticed I was charged $89.99 twice on my last statement.", timestampDisplay: "10:14 AM" },
      { sender: "agent", text: "Thanks for flagging that, Priya — let me pull up your billing history.", timestampDisplay: "10:16 AM" },
      { sender: "customer", text: "I appreciate it, it looked odd so I wanted to check.", timestampDisplay: "10:18 AM" },
      { sender: "agent", text: "You're right, that was a duplicate charge on your plan renewal. I've submitted a refund for the extra $89.99.", timestampDisplay: "10:21 AM" },
      { sender: "customer", text: "Perfect, thank you so much for sorting that out quickly.", timestampDisplay: "10:24 AM" },
      { sender: "agent", text: "Of course — you should see the refund back on your card within 3-5 business days.", timestampDisplay: "10:26 AM" },
    ],
  },
  {
    id: "ch3", name: "Omar Farooq", statusLabel: "Resolved", statusVariant: "success", redial: false,
    description: "Plan upgrade confirmation & feature overview",
    caseId: "CST-16823", skillName: "Sales", channelType: "email", channelLabel: "Email", timeAgo: "2h ago", duration: "6m 30s",
    // See "ch1"'s identical `customerId` comment above for the full "why" —
    // same fix, same real backing record (OMAR_FAROOQ_CUSTOMER_RECORD,
    // create-new-customers-data.ts).
    customerId: "omar-farooq-history",
    channels: ["email", "whatsapp"],
    phone: "(212) 555-0193", email: "omar.farooq@example.com", whatsappHandle: "@Omar Farooq",
    emailBody:
      "Hi Omar, thanks for upgrading to the Pro plan today! Your account has already been updated and the new usage limits are in effect. Along with higher usage caps, Pro also unlocks priority support, advanced reporting, and additional team seats — happy to walk you through any of these on a quick call if that would help. Let me know if you have any questions in the meantime.",
  },
  {
    id: "ch4", name: "Lauren Briggs", statusLabel: "Escalated", statusVariant: "critical", redial: true,
    description: "Escalated fraud investigation — 4 suspicious transactions",
    caseId: "CST-27760", skillName: "Escalations", channelType: "voice", channelLabel: "Voice", timeAgo: "5h ago", duration: "22m 47s",
    direction: "outbound",
    // See "ch1"'s identical `customerId` comment above for the full "why" —
    // same fix, same real backing record (LAUREN_BRIGGS_CUSTOMER_RECORD,
    // create-new-customers-data.ts).
    customerId: "lauren-briggs-history",
    channels: ["voice", "email"],
    phone: "(312) 555-0164", email: "lauren.briggs@example.com", whatsappHandle: "@Lauren Briggs",
    messages: [
      { sender: "agent", text: "Hi Lauren, this is a follow-up on the fraud alert we flagged on your account — do you have a few minutes?", timestampDisplay: "8:10 AM" },
      { sender: "customer", text: "Yes, I've actually been worried about that. What did you find?", timestampDisplay: "8:13 AM" },
      { sender: "agent", text: "We identified four transactions that look inconsistent with your usual activity. Do you recognize any of these charges?", timestampDisplay: "8:16 AM" },
      { sender: "customer", text: "No, none of those are mine — I haven't used my card anywhere near those places.", timestampDisplay: "8:19 AM" },
      { sender: "agent", text: "Understood. I've locked the card and opened a formal fraud investigation — our Escalations team will follow up with next steps.", timestampDisplay: "8:24 AM" },
      { sender: "customer", text: "Okay, thank you for catching this so quickly.", timestampDisplay: "8:30 AM" },
    ],
  },
  {
    id: "ch5", name: "Mei Tanaka", statusLabel: "Resolved", statusVariant: "success", redial: false,
    description: "Shipping delay — expedited replacement dispatched",
    caseId: "CST-31045", skillName: "General Support", channelType: "chat", channelLabel: "Chat", timeAgo: "1d ago", duration: "9m 15s",
    // See "ch1"'s identical `customerId` comment above for the full "why" —
    // same fix, same real backing record (MEI_TANAKA_CUSTOMER_RECORD,
    // create-new-customers-data.ts).
    customerId: "mei-tanaka-history",
    channels: ["sms", "whatsapp", "email"],
    phone: "(206) 555-0157", email: "mei.tanaka@example.com", whatsappHandle: "@Mei Tanaka",
    messages: [
      { sender: "customer", text: "Hi, my order was supposed to arrive last week and it still hasn't shown up.", timestampDisplay: "2:05 PM" },
      { sender: "agent", text: "I'm sorry about that, Mei — let me check the tracking on your order.", timestampDisplay: "2:06 PM" },
      { sender: "customer", text: "Thanks, I was starting to worry it got lost.", timestampDisplay: "2:08 PM" },
      { sender: "agent", text: "It looks like it's stuck at a shipping hub. I've gone ahead and dispatched a replacement with expedited shipping at no extra cost.", timestampDisplay: "2:10 PM" },
      { sender: "customer", text: "That's great, thank you for taking care of it so fast!", timestampDisplay: "2:12 PM" },
      { sender: "agent", text: "Happy to help — you should see tracking for the new shipment in your email shortly.", timestampDisplay: "2:14 PM" },
    ],
  },
];

export const CONTACT_HISTORY_CHANNEL_LABEL: Record<ContactHistoryEntry["channelType"], string> = {
  voice: "Voice",
  chat: "Chat",
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "Email",
};

/** Channel-type tag color — Voice/Email keep `Tag`'s fixed "purple"/"pink"
 *  accent variants (see CONTRIBUTING.md's "Channel type colors"
 *  convention); Chat/SMS/WhatsApp reuse lyra-ui's own established
 *  "teal"/"neutral"/"default" trio (`CHANNEL_TYPE_TAG_VARIANT`,
 *  channel-row.tsx) rather than a one-off mapping here, so a dismissed
 *  SMS/WhatsApp interaction's history tag reads distinctly from a Chat one
 *  the exact same way the record-header's own `ChannelTab` chips already
 *  do (see that file's own doc comment for why the three read as
 *  genuinely distinct channels, not one grouping). */
export const CONTACT_HISTORY_CHANNEL_TAG_VARIANT: Record<ContactHistoryEntry["channelType"], TagVariant> = {
  voice: "purple",
  chat: "teal",
  sms: "neutral",
  whatsapp: "default",
  email: "pink",
};

/** Same channel → color mapping as `CONTACT_HISTORY_CHANNEL_TAG_VARIANT`
 *  above, as plain icon-color classes instead of a `Tag` variant — for
 *  spots like `InteractionsTable`'s per-row type icon, where the channel
 *  indicator is a bare icon (no room for a pill in a 48px column) but
 *  should still tint consistently rather than sitting flat gray.
 *  SMS/WhatsApp reuse the same neutral/"active" text tones `Tag`'s own
 *  "neutral"/"default" variants render with (`tag.tsx`'s `tagVariants`)
 *  rather than inventing new accent hues those two variants don't have. */
export const CHANNEL_TYPE_ICON_COLOR_CLASS: Record<ContactHistoryEntry["channelType"], string> = {
  voice: "text-lyra-accent-purple-strong",
  chat: "text-lyra-accent-teal-strong",
  sms: "text-lyra-fg-secondary",
  whatsapp: "text-lyra-fg-active-strong",
  email: "text-lyra-accent-pink-strong",
};

/** Shared per-row content shape for every customer-derived (as opposed to
 *  hand-authored, like `CONTACT_HISTORY` above) Contact History row —
 *  everything except what's already on the `CREATE_NEW_CUSTOMERS` record
 *  itself (name/caseId) or derived from it (channelType/channelLabel/
 *  redial). */
export interface ContactHistoryTemplate {
  statusLabel: string;
  statusVariant: ContactHistoryStatusVariant;
  description: string;
  timeAgo: string;
  duration: string;
  skillName: string;
  /** See `ContactHistoryEntry.direction`'s own doc comment. Spread straight
   *  through onto the built entry by `buildContactHistoryFromCustomers`
   *  below — harmless to set even when this row's real (customer-derived)
   *  `channelType` turns out not to be voice/sms, since `contactHistory
   *  ChannelIcon` only ever reads it for those two types. */
  direction?: "inbound" | "outbound";
}

/** Builds a set of Contact History rows from real `CREATE_NEW_CUSTOMERS`
 *  fixture records — same "deterministic indexes, not `Math.random()`"
 *  convention as the rest of this file's dummy data. `customerIndexes[i]`
 *  pairs with `templates[i]`; `idPrefix` keeps each range's ids from
 *  colliding with another range's (e.g. "Today" vs. "Last 7 days" picking
 *  overlapping customer indexes would otherwise produce duplicate React
 *  keys if both ever rendered in the same list). */
export function buildContactHistoryFromCustomers(
  customerIndexes: number[],
  templates: ContactHistoryTemplate[],
  idPrefix: string
): ContactHistoryEntry[] {
  return customerIndexes.map((customerIndex, i) => {
    const customer = CREATE_NEW_CUSTOMERS[customerIndex];
    // Voice takes priority (it's what "Redial" needs — see `redial` below),
    // otherwise just the first channel this customer record happens to list
    // — a plain, lossless pick rather than the since-removed
    // `contactHistoryChannelType` helper's old "collapse every text channel
    // down into Chat" behavior (see `ContactHistoryEntry.channelType`'s own
    // doc comment for the real, shipped bug that caused).
    const channelType = customer.channels.includes("voice") ? "voice" : customer.channels[0] ?? "email";
    return {
      id: `${idPrefix}-${customer.id}`,
      name: customer.name,
      // `customer.customerId` is already "CST-…"-prefixed — use it as-is
      // rather than re-prefixing into "CST-CST-…".
      caseId: customer.customerId,
      channelType,
      channelLabel: CONTACT_HISTORY_CHANNEL_LABEL[channelType],
      redial: channelType === "voice",
      // The real `CREATE_NEW_CUSTOMERS` id (e.g. "customer-9") — see
      // `ContactHistoryEntry.customerId`'s own doc comment for why
      // `handleRedial` needs this.
      customerId: customer.id,
      // `email`/`phone`/`whatsappHandle` — see `ContactHistoryEntry`'s own
      // doc comments for these three. `whatsappHandle` is synthesized as
      // `@${name}`, matching lyra-ui's own `resolveOutboundDetailField`
      // convention (create-new.tsx) for a contact with no dedicated
      // WhatsApp-handle field on file.
      email: customer.emailAddress,
      phone: customer.firstPhone,
      whatsappHandle: `@${customer.name}`,
      ...templates[i],
    };
  });
}

export function buildDismissedContactHistoryEntry(
  interaction: Interaction,
  clockTick: number,
  // Per explicit request ("add disposition to the gray box... add tags
  // below call notes"): whatever the agent picked in the Outcome popover
  // for this interaction's channels before dismissing (`AgentWorkspace
  // AdvancedPage.tsx`'s own `channelOutcomeSelections` state) — keyed the
  // same `${interactionId}:${channelKey}` way that state already is, so
  // this just looks up the one entry matching whichever thread
  // `primaryChannel` below resolves to, rather than duplicating that
  // "which channel is primary" logic at the call site. Optional/defaulted
  // to `{}` — Phase 1 only for now (`AgentWorkspaceAdvancedPage.tsx`);
  // `AgentWorkspace2WithDeskPage.tsx`'s own call site doesn't pass this
  // yet, and an empty object here just means every lookup misses, same
  // as today (no `dispositionLabel`/`tags` on the resulting entry).
  channelOutcomeSelections: Record<string, { tags: string[]; dispositionCode: string }> = {}
): ContactHistoryEntry {
  // Voice takes priority (it's what "Redial" needs — see `redial` below)
  // when this interaction has a voice thread among its (rare, multi-
  // channel) open threads; otherwise whichever thread is actually current
  // — falling back to the first one — stands in as "primary." Either way,
  // `channelType` below is that thread's own REAL type, never collapsed —
  // see `ContactHistoryEntry.channelType`'s own doc comment for the real,
  // shipped bug a since-removed `contactHistoryChannelType` helper caused
  // by lumping sms/whatsapp into "chat" here (a dismissed SMS interaction's
  // history row showed a "Chat" tag, and reopening it rebuilt a literal
  // `chat`-type `Thread` instead of an `sms` one).
  const primaryChannel =
    interaction.threads.find((c) => c.type === "voice") ??
    interaction.threads.find((c) => c.id === interaction.currentThreadId) ??
    interaction.threads[0];
  const channelType = primaryChannel?.type ?? "chat";
  // Same `${interactionId}:${channelKey}` scheme `channelOutcomeSelections`
  // is already keyed by (AgentWorkspaceAdvancedPage.tsx's own `outcomeKey`/
  // `activeChannelOutcomeKey`) — `undefined` whenever the agent dismissed
  // without ever opening the Outcome popover for this channel.
  const primaryChannelOutcome =
    channelOutcomeSelections[`${interaction.id}:${primaryChannel?.id ?? primaryChannel?.type ?? ""}`];
  const dispositionLabel = primaryChannelOutcome?.dispositionCode
    ? OUTCOME_DISPOSITION_OPTIONS.find((o) => o.value === primaryChannelOutcome.dispositionCode)?.label
    : undefined;
  const earliestStart =
    interaction.threads.length > 0 ? Math.min(...interaction.threads.map((c) => c.startTick)) : clockTick;
  const statusLabel = interaction.threadStatuses?.[primaryChannel?.id ?? ""] ?? "Resolved";
  // The real captured address (email/phone/WhatsApp handle) this row's
  // primary Thread was opened on, if any — `addressLabel` (human-readable,
  // e.g. "(456) 383-3329") preferred over the raw `value` (e.g.
  // "+14563833329"), same preference `ChannelToggle`'s own face already
  // uses (see `Thread.addressLabel`'s own doc comment). Undefined for a
  // quick-dialed/redialed thread with no captured address at all — in
  // which case `contactHistoryDisplayIdentity` (above) falls back to
  // `name` rather than showing nothing.
  const channelAddress = primaryChannel?.addressLabel ?? primaryChannel?.value;
  // This row's own real `messages` (see that field's own doc comment) —
  // `interaction.liveMessages` is keyed by `Thread.id ?? .type`, same
  // scheme `primaryChannel` itself was resolved with above, so the same key
  // reads back the exact turns the agent/customer actually exchanged on
  // this thread. `undefined` (not `[]`) when there's nothing real to show —
  // `ContactHistoryEntryDetail` treats an empty/`undefined` `messages` the
  // same, falling back to its own synthesized content, but `undefined` here
  // keeps this field's own semantics ("no real transcript exists") distinct
  // from "a real, but genuinely empty, transcript."
  const primaryChannelMessages = interaction.liveMessages?.[primaryChannel?.id ?? primaryChannel?.type ?? ""];
  // Nothing on `Interaction` tracks which skill it was originally routed
  // under (channels/threads carry no such field — see `Interaction`'s own
  // type), so a dismissed row falls back to this generic label rather than
  // guessing. Every other `ContactHistoryEntry` construction site (the
  // hand-authored rows above, `buildContactHistoryFromCustomers`'s
  // templates) has a real authored value instead. Declared as its own
  // constant (rather than inlined below) so `description`'s own dedupe
  // check just below can compare against the exact same string used for
  // the `skillName` field, per the follow-up doc comment on `description`.
  const skillName = "General Support";
  return {
    id: `dismissed-${interaction.id}-${Date.now()}`,
    name: interaction.customerName ?? "Customer",
    statusLabel,
    statusVariant: SESSION_STATUS_TO_CONTACT_HISTORY_VARIANT[statusLabel] ?? "success",
    redial: channelType === "voice",
    // Per explicit follow-up, with a screenshot of a dismissed dial-pad row
    // reading "General Support — resolved and dismissed by agent" (this
    // line) directly above a third line ALSO reading "General Support"
    // (`skillName`, just below): "remove the redundant skill in the
    // description." `primaryChannel.preview` is set to the real routing
    // skill's label for a skill/agent quick-dialed `Thread` (see
    // `Thread.preview`'s own call sites, e.g. `preview: skillLabel` at this
    // channel's creation) — when it happens to equal this row's own
    // (generic, hardcoded) `skillName` above, prefixing the description
    // with it is pure duplication of the very next line down. Only
    // suppressed in that exact case — a `preview` holding something
    // genuinely different (a real message snippet, a distinct skill name)
    // still shows normally, since that's actually new information.
    description:
      primaryChannel?.preview && primaryChannel.preview !== skillName
        ? `${primaryChannel.preview} — ${statusLabel.toLowerCase()} and dismissed by agent`
        : `${statusLabel} and dismissed by agent`,
    caseId: interaction.customerId,
    skillName,
    channelType,
    channelLabel: CONTACT_HISTORY_CHANNEL_LABEL[channelType],
    // Carried straight through from the primary Thread's own `direction`
    // (set once at Thread-creation time — see that field's own doc comment,
    // agent-next-gen-interaction-dashboard.tsx) rather than re-derived: this
    // row's real direction was already decided the moment that channel was
    // opened, dismissing it here doesn't change how it came to exist.
    direction: primaryChannel?.direction,
    timeAgo: "Just now",
    duration: formatElapsedTime(clockTick - earliestStart),
    customerId: /^customer-\d+$/.test(interaction.id) ? interaction.id : undefined,
    // `ContactHistoryEntry.channels`'s own doc comment: for a row with no
    // real `customerId` (any interaction that isn't itself
    // `CREATE_NEW_CUSTOMERS`-backed — e.g. a redialed/quick-dialed number,
    // or one of the 5 hand-authored `CONTACT_HISTORY` rows reopened and
    // then dismissed again), this is the ONLY place
    // `buildContactHistoryOutboundContacts` has to learn which channels
    // this customer can be reached on at all — without it, a dismissed
    // interaction's own `CreateNewOutboundContact.channels` falls back to
    // `entry.channels ?? []`, an empty list, and the record header's "+"
    // (Add Channel) row goes back to showing NO buttons at all once
    // reopened a second time. Deduped (`Set`) since `interaction.channels`
    // can have more than one open channel of the same `type` (e.g. two SMS
    // threads on different numbers) — `CreateNewOutboundContact.channels`
    // only needs each type once, not one entry per open thread.
    channels: [...new Set(interaction.threads.map((c) => c.type))],
    interactionId: interaction.interactionId,
    // `email`/`phone`/`whatsappHandle` — see `ContactHistoryEntry`'s own
    // doc comments for these three. Only the one matching this row's real
    // `channelType` is populated from `channelAddress` above; the other two
    // stay undefined (`contactHistoryDisplayIdentity` never reads them for
    // a row of this type). WhatsApp falls back to a synthesized `@${name}`
    // handle (same convention `buildContactHistoryFromCustomers` and
    // lyra-ui's own `resolveOutboundDetailField` use) when no real captured
    // address exists for this thread.
    email: channelType === "email" ? channelAddress : undefined,
    phone: channelType === "voice" || channelType === "sms" ? channelAddress : undefined,
    whatsappHandle:
      channelType === "whatsapp" ? channelAddress ?? `@${interaction.customerName ?? "Customer"}` : undefined,
    messages:
      primaryChannelMessages && primaryChannelMessages.length > 0
        ? primaryChannelMessages.map(
            (m): ContactHistoryMessage => ({ sender: m.sender, text: m.text, timestampDisplay: m.timestamp })
          )
        : undefined,
    dispositionLabel,
    tags: primaryChannelOutcome?.tags && primaryChannelOutcome.tags.length > 0 ? primaryChannelOutcome.tags : undefined,
  };
}

// Fixed customer indexes + content templates for the 5 extra rows that
// appear once "Last 72 Hours" is selected (on top of "Last 48 Hours"'s own
// today+yesterday rows) — deterministic (not `Math.random()`), matching
// the rest of this file's dummy-data convention. Names/case IDs come from
// the real `CREATE_NEW_CUSTOMERS` records at these indexes; only the
// description/status/timing are authored here. `timeAgo` is capped at
// "2d ago" (hour 49-72 of the window: today=hours 0-24, yesterday=hours
// 24-48, this batch=hours 48-72) so nothing in "Last 72 Hours" reads as
// older than its own label.
export const EXTENDED_CONTACT_HISTORY_CUSTOMER_INDEXES = [5, 12, 19, 26, 33];
export const EXTENDED_CONTACT_HISTORY_TEMPLATES: ContactHistoryTemplate[] = [
  { statusLabel: "Resolved", statusVariant: "success", description: "Password reset — identity verified via KBA, access restored", timeAgo: "1d ago", duration: "7m 40s", skillName: "Technical Support", direction: "inbound" },
  { statusLabel: "Resolved", statusVariant: "success", description: "Billing question — walked through recent charges, no refund needed", timeAgo: "1d ago", duration: "5m 18s", skillName: "Billing", direction: "inbound" },
  { statusLabel: "Escalated", statusVariant: "critical", description: "Product setup issue escalated to Tier 2 for configuration support", timeAgo: "2d ago", duration: "14m 05s", skillName: "Escalations", direction: "outbound" },
  { statusLabel: "Resolved", statusVariant: "success", description: "Subscription cancellation request — retention offer accepted", timeAgo: "2d ago", duration: "10m 52s", skillName: "Sales", direction: "inbound" },
  { statusLabel: "Resolved", statusVariant: "success", description: "Shipping delay follow-up — updated delivery window provided", timeAgo: "2d ago", duration: "4m 27s", skillName: "General Support", direction: "outbound" },
];
export const EXTENDED_CONTACT_HISTORY: ContactHistoryEntry[] = buildContactHistoryFromCustomers(
  EXTENDED_CONTACT_HISTORY_CUSTOMER_INDEXES,
  EXTENDED_CONTACT_HISTORY_TEMPLATES,
  "ch-ext"
);

// Deterministic content pools for `CONTACT_HISTORY_STRESS_BATCH` below —
// same "index-modulo, not `Math.random()`" convention as the rest of this
// file's dummy data, just cycling shorter pools instead of one row-per-
// template (115 rows is too many to hand-author individually).
const CONTACT_HISTORY_STRESS_SKILLS = ["Technical Support", "Billing", "Sales", "Escalations", "General Support"];
const CONTACT_HISTORY_STRESS_STATUS: { statusLabel: string; statusVariant: ContactHistoryStatusVariant }[] = [
  { statusLabel: "Resolved", statusVariant: "success" },
  { statusLabel: "Resolved", statusVariant: "success" },
  { statusLabel: "Resolved", statusVariant: "success" },
  { statusLabel: "Escalated", statusVariant: "critical" },
  { statusLabel: "Pending", statusVariant: "info" },
];
const CONTACT_HISTORY_STRESS_DESCRIPTIONS = [
  "Password reset — identity verified, access restored",
  "Billing inquiry — reviewed recent charges, no action needed",
  "Product setup walkthrough — configuration completed",
  "Subscription question — plan details clarified",
  "Shipping status check — delivery window confirmed",
  "Technical issue — reproduced and resolved same call",
  "Account update — contact details refreshed",
  "Feature request — logged for product team follow-up",
  "Payment method update — new card on file",
  "General inquiry — resolved without escalation",
];
const CONTACT_HISTORY_STRESS_DURATIONS = ["4m 12s", "6m 45s", "9m 03s", "3m 58s", "11m 20s", "7m 34s", "5m 15s", "8m 47s"];

export const CONTACT_HISTORY_STRESS_COUNT = 115;

/** Simulated bulk batch for "Last 72 Hours" — per explicit request, to
 *  demonstrate real footer pagination (see `ContactHistoryCard` below)
 *  rather than the card's old `max-h-[600px]` body scroll, this range needs
 *  ~125 total contacts. 125 = the 5 hand-authored `CONTACT_HISTORY` rows +
 *  5 `EXTENDED_CONTACT_HISTORY` rows already shown under "Last 72 Hours" +
 *  this 115-row batch (see `buildContactHistoryByRange` below).
 *
 *  Cycles through all 60 `CREATE_NEW_CUSTOMERS` records
 *  (`i % CREATE_NEW_CUSTOMERS.length`) rather than a fixed index list like
 *  `EXTENDED_CONTACT_HISTORY_CUSTOMER_INDEXES` above, since 115 rows need
 *  every customer reused roughly twice over. `buildContactHistoryFromCustomers`
 *  itself isn't reused here because its `id` is derived from the customer's
 *  own id (`${idPrefix}-${customer.id}`) — that collides the moment the same
 *  customer index repeats within one batch. `id` here is derived from the
 *  loop index instead (`ch-stress-${i}`), so every row stays a guaranteed-
 *  unique React key even with the 60-customer pool wrapping around twice.
 *  `timeAgo` stays flat at "2d ago" for the whole batch, same reasoning as
 *  `EXTENDED_CONTACT_HISTORY` above (hour 48-72 of the window). */
export const CONTACT_HISTORY_STRESS_BATCH: ContactHistoryEntry[] = Array.from(
  { length: CONTACT_HISTORY_STRESS_COUNT },
  (_, i): ContactHistoryEntry => {
    const customer = CREATE_NEW_CUSTOMERS[i % CREATE_NEW_CUSTOMERS.length];
    const channelType = customer.channels.includes("voice") ? "voice" : customer.channels[0] ?? "email";
    const status = CONTACT_HISTORY_STRESS_STATUS[i % CONTACT_HISTORY_STRESS_STATUS.length];
    return {
      id: `ch-stress-${i}`,
      name: customer.name,
      caseId: customer.customerId,
      channelType,
      channelLabel: CONTACT_HISTORY_CHANNEL_LABEL[channelType],
      redial: channelType === "voice",
      customerId: customer.id,
      email: customer.emailAddress,
      phone: customer.firstPhone,
      whatsappHandle: `@${customer.name}`,
      statusLabel: status.statusLabel,
      statusVariant: status.statusVariant,
      description: CONTACT_HISTORY_STRESS_DESCRIPTIONS[i % CONTACT_HISTORY_STRESS_DESCRIPTIONS.length],
      timeAgo: "2d ago",
      duration: CONTACT_HISTORY_STRESS_DURATIONS[i % CONTACT_HISTORY_STRESS_DURATIONS.length],
      skillName: CONTACT_HISTORY_STRESS_SKILLS[i % CONTACT_HISTORY_STRESS_SKILLS.length],
      // Deterministic alternation (not `Math.random()`), same convention as
      // every other field in this batch — harmless when `channelType` isn't
      // voice/sms (see `ContactHistoryTemplate.direction`'s own doc comment).
      direction: i % 2 === 0 ? "inbound" : "outbound",
    };
  }
);

/** Contact History's own date filter — deliberately a separate type/value
 *  set from the shared `DateFilterValue` (Today/Yesterday/Last 7 days/
 *  Custom) the Productivity/Performance cards' `DateFilterChip` uses: this
 *  card only ever wants 3 cumulative, "as of now" windows, no custom range
 *  picker. Reusing `DateFilterValue` here would either force those other
 *  two cards' filter to change too (they weren't asked to) or require
 *  awkwardly repurposing "yesterday"/"last7" values to mean something else
 *  than their names say. */
export type ContactHistoryDateFilterValue = "today" | "last48h" | "last72h";

export const CONTACT_HISTORY_DATE_FILTER_OPTIONS: { value: ContactHistoryDateFilterValue; label: string }[] = [
  { value: "today",   label: "Today" },
  { value: "last48h", label: "Last 48 Hours" },
  { value: "last72h", label: "Last 72 Hours" },
];

/* Each range is cumulative (a superset of the one before it) — "Last 48
   Hours" is today's rows plus yesterday's, "Last 72 Hours" adds the day
   before that on top — rather than each range being its own disjoint
   bucket the way the old Today/Yesterday/Last 7 days setup was (selecting
   "Last 7 days" there dropped today's own rows entirely, which read as a
   bug once the range names started actually promising "the last N hours"
   instead of a single day or a disjoint window).

   "Today" is `dismissedContactHistory` (main component) — real, agent-
   dismissed assignments (`buildDismissedContactHistoryEntry`), empty until
   the agent actually dismisses one; there's no real backend here to have
   loaded any actual prior-contact history from, so it starts genuinely
   empty rather than pretending otherwise with hand-authored placeholder
   rows the way it used to (a `TODAY_CONTACT_HISTORY` fixture, since
   removed). A function, not a static object, so it can be recomputed as
   that state grows — called from `AgentNextGenPage` inside a `useMemo`
   keyed on `dismissedContactHistory`. */
export function buildContactHistoryByRange(
  dismissedContactHistory: ContactHistoryEntry[]
): Record<ContactHistoryDateFilterValue, ContactHistoryEntry[]> {
  return {
    today: dismissedContactHistory,
    last48h: [...dismissedContactHistory, ...CONTACT_HISTORY],
    last72h: [
      ...dismissedContactHistory,
      ...CONTACT_HISTORY,
      ...EXTENDED_CONTACT_HISTORY,
      ...CONTACT_HISTORY_STRESS_BATCH,
    ],
  };
}

/* Same trigger/popover chrome as `DateFilterChip` above (filterChipVariants
   "default" trigger, RadioGroup popover) but for `ContactHistoryDateFilterValue`
   specifically and with no "Custom" branch/DateRangePicker — kept as its own
   small component rather than genericizing `DateFilterChip` itself, since
   the two have different value sets and this one is intentionally simpler
   (no custom-range case to handle). */
export function ContactHistoryDateFilterChip({
  onValueChange,
  defaultValue = "last48h",
}: {
  onValueChange?: (value: ContactHistoryDateFilterValue) => void;
  /** Per explicit request, Phase 1 (Advanced) only — ("default the phase 1
   *  contact history filter to last 72 hours"): `ContactHistoryCard`
   *  passes `"last72h"` here so this chip's own trigger label starts in
   *  sync with that card's now-also-`"last72h"` initial `dateFilter`.
   *  Defaults to `"last48h"`, unchanged for every other consumer/tier. See
   *  `ContactHistoryCard`'s own identically-named prop below for the fuller
   *  "why must these two stay matched" reasoning. */
  defaultValue?: ContactHistoryDateFilterValue;
}) {
  const [open, setOpen] = useState(false);
  // Seeded from `defaultValue` (default "Last 48 Hours") — must match
  // `ContactHistoryCard`'s own `dateFilter` initial state below, since
  // that's a second, independent piece of state this chip doesn't own
  // (kept in sync only via `onValueChange`); a mismatched default here
  // would show the wrong label in the trigger while the card was actually
  // filtered to a different window underneath it.
  const [value, setValue] = useState<ContactHistoryDateFilterValue>(defaultValue);

  const selectedLabel = CONTACT_HISTORY_DATE_FILTER_OPTIONS.find((o) => o.value === value)?.label ?? "";

  const handleValueChange = (v: ContactHistoryDateFilterValue) => {
    setValue(v);
    onValueChange?.(v);
  };

  return (
    // See `DateFilterChip`'s identical Tooltip-wraps-Popover composition
    // above (CONTRIBUTING.md §16) for why this is structured outside-in.
    <Tooltip content={`Date filter: ${selectedLabel}`} placement="bottom" disabled={open}>
      <span className="inline-flex">
        <Popover
          open={open}
          onOpenChange={setOpen}
          placement="bottom"
          content={
            <div className="flex flex-col gap-3 p-3 w-[260px]">
              <RadioGroup value={value} onValueChange={(v) => handleValueChange(v as ContactHistoryDateFilterValue)}>
                {CONTACT_HISTORY_DATE_FILTER_OPTIONS.map((option) => (
                  <RadioGroupItem key={option.value} value={option.value} label={option.label} />
                ))}
              </RadioGroup>
            </div>
          }
        >
          <Button
            variant="ghost"
            aria-label={open ? "Close date filter" : `Date filter: ${selectedLabel}`}
            className={cn(filterChipVariants({ variant: "default" }), "rounded-lyra-md lyra-container-header-filter-trigger")}
          >
            {/* Full label — hidden below 480px of the header's own width (see
                lyra-tokens.css's "Filter chip icon collapse" family) in favor
                of the compact kebab icon below, both wired to this same
                Popover trigger/open state. */}
            <span className="lyra-container-header-filter-full inline-flex items-baseline gap-1">
              <span className="lyra-body-md-emphasis whitespace-nowrap">Date:</span>
              <span className="lyra-body-md truncate">{selectedLabel}</span>
            </span>
            <ChevronDown className={cn("lyra-container-header-filter-full h-3.5 w-3.5 flex-shrink-0 transition-transform", open && "rotate-180")} strokeWidth={1.5} aria-hidden="true" />
            <MoreVertical className="lyra-container-header-filter-compact h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </Button>
        </Popover>
      </span>
    </Tooltip>
  );
}

export function ContactHistoryCard({
  onSelectEntry,
  selectedEntryId,
  historyByRange,
  hideCustomerNames,
  onOpenAllContacts,
  defaultDateFilter,
}: {
  /** Fired by clicking anywhere on a row — opens this entry's summary in
   *  `AgentNextGenPage`'s shared right-docked `InteriorPanel` slot (main
   *  component's own `selectedContactHistoryEntry` state), rather than
   *  reopening the contact directly. Redial/Re-open (this same entry's own
   *  actual reopen actions) now live as buttons on that panel — see this
   *  file's own "Contact History card" doc comment above. */
  onSelectEntry?: (entry: ContactHistoryEntry) => void;
  /** `selectedContactHistoryEntry?.id` (main component) — which row (if
   *  any) currently has its summary open in that shared panel, so that row
   *  can get a visibly selected treatment instead of looking identical to
   *  every unselected one while its own detail is on screen. Same
   *  `bg-lyra-status-info-subtle` "highlighted" swap `ChannelRow` already
   *  uses for its own selected-row state (channel-row.tsx), not a one-off
   *  style. */
  selectedEntryId?: string | null;
  /** Built by `buildContactHistoryByRange` (main component, via `useMemo`
   *  keyed on `dismissedContactHistory`) — passed down rather than read
   *  from a module-level constant, since "Today" is real, growing state
   *  (see this card's own doc comment above), not a fixed fixture. */
  historyByRange: Record<ContactHistoryDateFilterValue, ContactHistoryEntry[]>;
  /**
   * Per explicit request, Agent Workspace 2.0 only: rows show
   * `contactHistoryDisplayIdentity(entry)` (a real reach-back address —
   * phone for Voice/SMS, email for Email, the row's own WhatsApp handle
   * for WhatsApp — falling back to `name` for Chat, which has no separate
   * "handle" concept) in place of `entry.name`. Defaults to false/unset —
   * Agent Workspace 2.0 Premium/Advanced don't pass this, so both keep
   * showing real customer names exactly as before, per that same explicit
   * request ("keep as-is in advanced and premium").
   */
  hideCustomerNames?: boolean;
  /** Per explicit request ("add a button to My Contact History that says
   *  'All Contacts' and when clicked take over the entire home container
   *  with the table in the contacts panel") — fired by the new "All
   *  Contacts" button in this card's own header (below). Each of the 3
   *  page files wires this to the same open-then-maximize sequence its
   *  own shared-panel "Search" header button + "Full Screen" action
   *  already provide (`handlePanelButtonClick("search")` +
   *  `setPanelFullScreen(true)`), combined into one click — see each
   *  page's own `handleOpenAllContacts` for the real implementation.
   *  Omit to render the card with no such button at all (no consumer
   *  currently does this — all 3 tiers pass it). */
  onOpenAllContacts?: () => void;
  /** Per explicit request, Phase 1 (Advanced) only ("default the phase 1
   *  contact history filter to last 72 hours") — `AgentWorkspaceAdvancedPage
   *  .tsx`'s own call site passes `"last72h"`; every other consumer (Agent
   *  Workspace 2.0, Premium) omits this and keeps the original "Last 48
   *  Hours" default. Threaded straight into this card's own `dateFilter`
   *  state below AND into `ContactHistoryDateFilterChip`'s matching
   *  `defaultValue` a few lines down, so the trigger label and the actual
   *  filtered rows never start out of sync. */
  defaultDateFilter?: ContactHistoryDateFilterValue;
}) {
  // Seeded from `defaultDateFilter` (default "Last 48 Hours", was "Today"
  // before that) — see `ContactHistoryDateFilterChip`'s own `value` state
  // above for why this default must stay matched to that one.
  const [dateFilter, setDateFilter] = useState<ContactHistoryDateFilterValue>(defaultDateFilter ?? "last48h");
  const [searchQuery, setSearchQuery] = useState("");
  // Footer pagination (replaces the old reliance on `DashboardCard`'s own
  // `max-h-[600px] overflow-y-auto` body scroll — see `CONTACT_HISTORY_STRESS_BATCH`'s
  // own doc comment above for why "Last 72 Hours" needs this: 125 fixed rows
  // don't fit in a scrolling 600px box in any usable way). Default 5 rows/page
  // per explicit request, with 10/25 as user-selectable alternatives — same
  // `currentPage`/`rowsPerPage` state shape `CustomersListView` already uses
  // for its own `TableFooter` (agent-next-gen-customers-table.tsx).
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const entries = historyByRange[dateFilter];

  // Filters the already date-ranged `entries` down to whatever matches the
  // search box — name, case ID, channel, or the one-line case summary, so
  // a query like "billing" or "CST-30164" both find their row. Case-
  // insensitive substring match, same convention as every other quick
  // search in this app (e.g. `DesktopDesignsPage`'s table toolbar).
  // `hideCustomerNames` also matches on whatever identity is actually
  // showing (`contactHistoryDisplayIdentity`) — a phone/email/handle
  // search should find its row even though `entry.name` itself is never
  // on screen in that mode.
  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) =>
      [
        entry.name,
        entry.description,
        entry.caseId,
        entry.channelLabel,
        ...(hideCustomerNames ? [contactHistoryDisplayIdentity(entry)] : []),
      ].some((field) => field.toLowerCase().includes(query))
    );
  }, [entries, searchQuery, hideCustomerNames]);

  // Reset back to page 1 whenever the date range, search query, or page
  // size changes — otherwise switching from "Last 72 Hours" (page 9 of a
  // 25-page list) to "Today" (0-3 rows) could leave `currentPage` pointing
  // past the end of the new, much shorter list until the `safePage` clamp
  // below catches up on next render.
  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter, searchQuery, rowsPerPage]);

  const totalRecords = filteredEntries.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * rowsPerPage;
  const pageEntries = filteredEntries.slice(startIdx, startIdx + rowsPerPage);
  const displayStart = totalRecords === 0 ? 0 : startIdx + 1;
  const displayEnd = Math.min(startIdx + rowsPerPage, totalRecords);

  return (
    <DashboardCard
      variant="neutral-subtle"
      // Establishes the CSS container-query boundary `headerActionsWrap`
      // below relies on (`.lyra-container-header-query-boundary`,
      // lyra-tokens.css) — per explicit follow-up request ("I want the
      // query to be not on the widget itself but the parent container"),
      // after the shared threshold bump to 768px (raised for THIS card)
      // leaked into Performance/Productivity's own narrower `DateFilterChip`
      // collapse, since they used to share the exact same boundary
      // automatically via `actionsWrap` alone. Now opt-in per card, applied
      // here on the card's own root rather than inside `ContainerHeader`
      // itself — see that class's own doc comment for the full story.
      className="lyra-container-header-query-boundary"
      headerTitle="My Contact History"
      headerIcon={<Icon icon={History} size="md" background="info" shape="rounded" decorative />}
      // "All Contacts" — per explicit follow-up request (a reference
      // screenshot showing it as a small outline pill sitting immediately
      // after the title, not out with search/date-filter on the right) —
      // moved from `headerActions` into `headerTitleBadge`, the slot
      // `ContainerHeader` renders inline right after the title text itself
      // (see that component's own doc comment) rather than a one-off
      // wrapper here. Omitted entirely when the prop isn't passed, same as
      // every other optional action in this header.
      headerTitleBadge={
        onOpenAllContacts && (
          // `size="md"` (32px) per follow-up request ("make the all
          // contacts button the same height as the search and date filter
          // chips") — matches `SearchInput`'s own `size="sm"` (32px,
          // confusingly a different name for the same height) and
          // `ContactHistoryDateFilterChip`'s default `filterChipVariants`
          // size (also 32px), all three of which sit in this same header
          // row. `variant="outline"` — briefly tried `variant="default"`
          // (primary-colored) per the same request, reverted one turn
          // later ("make it an outline button - it's too prominent") back
          // to the original outline treatment, keeping only the height fix.
          <Button variant="outline" size="md" onClick={onOpenAllContacts}>
            All Contacts
          </Button>
        )
      }
      headerActionsWrap
      // Two real `SearchInput`s, both bound to the same `searchQuery` state
      // — one lives in `headerActions` (visible ≥480px, inline beside the
      // date filter), the other in `headerTabs` (visible <480px, its own
      // full-width row below the title). CSS toggles which one shows (see
      // lyra-tokens.css's "Search inline/below" family); the date filter
      // chip stays in `headerActions` either way and never moves — only
      // search needed room, so search is the only thing that relocates
      // (confirmed from a screenshot: forcing the whole actions block to
      // move together, the previous approach, shoved a lone filter chip
      // onto its own line even on cards with no search box at all).
      headerActions={
        <>
          <SearchInput
            value={searchQuery}
            onValueChange={setSearchQuery}
            placeholder="Search contact history"
            size="sm"
            className="lyra-container-header-search-inline flex-1 min-w-[240px]"
          />
          <ContactHistoryDateFilterChip onValueChange={setDateFilter} defaultValue={defaultDateFilter ?? "last48h"} />
        </>
      }
      headerTabs={
        // The `-search-below` toggle class goes on this plain OUTER div,
        // not on `SearchInput`'s own className — `SearchInput`'s root is
        // itself `position: relative` and its search icon is positioned
        // `absolute left-3` against that same box, so padding added
        // directly to `SearchInput`'s className would shift the padding
        // edge the icon measures from, throwing the icon out of alignment
        // with the input's own baked-in `pl-9` text padding. Padding lives
        // out here instead, where it can't affect that inner math.
        //
        // `pt-3` — `ContainerHeader`'s `tabs` slot (which this reuses, see
        // its own doc comment) drops the header's normal bottom padding to
        // 0 whenever `tabs` is set, on the assumption its content (usually
        // a `TabList`) supplies its own visual separation via a `border-b`.
        // A `SearchInput` has no such border, so without this it sat
        // flush against the title row above it — confirmed from a
        // screenshot. Plain static padding, not container-query-gated:
        // this whole div is already only visible in the narrow state (see
        // `.lyra-container-header-search-below` in lyra-tokens.css), so
        // there's no "wide" state where this padding needs to disappear.
        <div className="lyra-container-header-search-below px-4 pt-3 pb-3">
          <SearchInput
            value={searchQuery}
            onValueChange={setSearchQuery}
            placeholder="Search contact history"
            size="sm"
            className="w-full"
          />
        </div>
      }
      // `border-t-0 py-0` cancels `TableFooter`'s own top border/vertical
      // padding — `DashboardCard`'s `footer` slot already wraps whatever's
      // passed in with its own `border-t border-lyra-border-subtle px-4
      // py-3` row (see that component's own doc comment), so without this
      // override the two would stack into a doubled border + extra ~22px
      // of combined top/bottom padding.
      footer={
        totalRecords > 0 ? (
          <TableFooter
            className="border-t-0 py-0"
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={setRowsPerPage}
            rowsPerPageOptions={[5, 10, 25]}
            totalRecords={totalRecords}
            displayStart={displayStart}
            displayEnd={displayEnd}
          />
        ) : undefined
      }
    >
      {filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
          <Inbox className="h-6 w-6 text-lyra-fg-secondary" strokeWidth={1.5} aria-hidden="true" />
          <span className="lyra-body-md text-lyra-fg-secondary">
            {entries.length === 0 ? "Nothing to Display" : "No matching contacts"}
          </span>
        </div>
      ) : (
        <div className="flex flex-col">
          {pageEntries.map((entry, i) => {
            const isSelected = entry.id === selectedEntryId;
            const displayName = hideCustomerNames ? contactHistoryDisplayIdentity(entry) : entry.name;
            return (
              <div
                key={entry.id}
                role={onSelectEntry ? "button" : undefined}
                tabIndex={onSelectEntry ? 0 : undefined}
                aria-current={isSelected ? "true" : undefined}
                onClick={() => onSelectEntry?.(entry)}
                onKeyDown={(e) => {
                  if (onSelectEntry && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onSelectEntry(entry);
                  }
                }}
                className={cn(
                  "flex items-start justify-between gap-4 px-4 py-4 transition-colors",
                  // Selected (this row's summary is the one currently open
                  // in the shared panel) — same `bg-lyra-status-info-subtle`
                  // swap `ChannelRow`'s own `highlighted` state uses
                  // (channel-row.tsx), in place of the plain hover tint.
                  isSelected ? "bg-lyra-status-info-subtle" : "hover:bg-lyra-state-hover",
                  onSelectEntry && "cursor-pointer",
                  i > 0 && "border-t border-lyra-border-subtle"
                )}
              >
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="lyra-body-md-emphasis text-lyra-fg-default">{displayName}</span>
                    {/* Status badge — dot + label, matching the reference
                        screenshot's status-dropdown rows (colored dot,
                        plain text, no pill background) rather than Tag's
                        bordered/tinted pill: critical=red (Escalated),
                        info=blue (In Progress), success=green (Resolved),
                        neutral=gray (New). Per explicit follow-up request
                        ("hide the status in the contact history row
                        itself") — voice has no real status concept, only
                        a disposition (shown in the detail panel's own gray
                        card instead), so this whole badge is hidden for
                        voice rows, same reasoning as the detail panel's
                        own status line. */}
                    {entry.channelType !== "voice" && (
                      <span className="inline-flex items-center gap-1.5">
                        <Badge shape="circle" dot size="sm" variant={entry.statusVariant} aria-hidden="true" />
                        <span className="lyra-body-sm-emphasis text-lyra-fg-default">{entry.statusLabel}</span>
                      </span>
                    )}
                  </div>
                  <span className="lyra-body-md text-lyra-fg-secondary">{entry.description}</span>
                  {/* Per explicit follow-up, with a screenshot: this row
                      shows the routing skill instead of the customer id —
                      `entry.caseId` itself is untouched everywhere else
                      (redial/reopen, search, the summary panel's own
                      subhead) — this is purely a display swap for this one
                      line. See `skillName`'s own doc comment. */}
                  <span className="lyra-body-sm text-lyra-fg-secondary">{entry.skillName}</span>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {/* Channel-type pill — "purple"/"teal"/"pink" per
                      CONTACT_HISTORY_CHANNEL_TAG_VARIANT (Voice/Chat/
                      Email), matching the same three `lyra-accent-*`
                      hues CONTRIBUTING.md's "Channel type colors"
                      convention documents, not a one-off tint. */}
                  <Tooltip content={contactHistoryChannelTooltipLabel(entry)} placement="top">
                    <Tag
                      label={entry.channelLabel}
                      variant={CONTACT_HISTORY_CHANNEL_TAG_VARIANT[entry.channelType]}
                      shape="pill"
                      icon={contactHistoryChannelIcon(entry)}
                    />
                  </Tooltip>
                  <span className="lyra-body-sm text-lyra-fg-secondary whitespace-nowrap">{entry.timeAgo}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}

/** Summary content shown in `AgentNextGenPage`'s shared right-docked
 *  `InteriorPanel` slot when a Contact History row is clicked (that file's
 *  own `selectedContactHistoryEntry` state) — same "one-line status ·
 *  handle · when" meta line, then a bordered card with Duration + a notes
 *  field, that the Customer Information panel's own past-session
 *  "Conversation" tab already uses for its voice entries
 *  (`CustomerHistoryConversationContent` in
 *  agent-next-gen-customer-info-panel.tsx), reused here for visual
 *  consistency between the two "read a past contact's summary" experiences
 *  in this app. Not imported from that file directly, to avoid a circular
 *  import (that file already imports `ContactHistoryStatusVariant` from
 *  this one) — this is a small enough shape to redeclare locally instead.
 *
 *  `ContactHistoryEntry` (this card's own, simpler data shape) has no
 *  separate message-thread/email-subject fields to branch its layout on
 *  the way that richer `CustomerHistorySessionEntry` type does, and no real
 *  captured Date/timestamp either — every channel type here just shows
 *  `duration` + `description` under one notes label ("Call Notes" for
 *  voice, matching that same convention's own wording; "Chat Summary"/
 *  "Email Summary" for the other two), and the meta line uses `timeAgo`
 *  (a relative string, e.g. "8m ago") in place of that other panel's real
 *  formatted timestamp.
 *
 *  Per explicit follow-up request, the meta line's middle segment is
 *  `contactHistoryDisplayIdentity(entry)` (phone/email/WhatsApp handle,
 *  falling back to name only for Chat/unpopulated fields — see that
 *  function's own doc comment), not `entry.name` — the panel's own
 *  `headerTitle` (this component's caller, `AgentNextGenPage.tsx` et al.)
 *  already shows the customer's real name immediately above this line, so
 *  repeating it here was pure duplication (a customer's name showing up
 *  twice back to back). Unlike `ContactHistoryCard`'s own identical-looking
 *  swap, this one isn't gated behind `hideCustomerNames` — it always shows
 *  the handle, in every tier, since the point here isn't masking a name but
 *  avoiding restating one already on screen.
 *
 *  Per a further explicit follow-up ("please display the transcript/email
 *  body content/chat below the info box"), a second section renders below
 *  the Duration/notes box: voice/chat/SMS/WhatsApp rows get a synthesized
 *  message thread (`buildContactHistoryMessages`), and email rows get a
 *  synthesized, longer "Body" (`buildContactHistoryEmailBody`) distinct
 *  from the info box's own short summary. See those builders' own doc
 *  comments for why none of this is case-specific.
 *
 *  Per one more explicit follow-up on a voice row's own screenshot ("for
 *  voice can you have a fake transcript?" — then, with a reference
 *  screenshot of the desired layout: "i would prefer the voice transcript
 *  formatting like this"), voice's own section is labeled "Transcript"
 *  (the other three stay "Conversation") and renders each turn with
 *  `ContactHistoryTranscriptLine` (bold name + timestamp, spoken line
 *  below — see that component's own doc comment) instead of
 *  `ContactHistoryMessageBubble`'s chat-bubble layout, matching that
 *  reference screenshot exactly. */
export function ContactHistoryEntryDetail({
  entry,
  // Per explicit request, Agent Workspace 2.0 only (Phase 1) — matches
  // `ContactHistoryCard`'s own identically-named/gated prop (this file,
  // above): non-chat contacts show their reach-back address in place of
  // their name in the Transcript/Conversation turns below, same as that
  // card's own rows already do. Defaults to false/unset — Premium/
  // Advanced don't pass this, so both keep showing real names in the
  // transcript exactly as before. Deliberately independent of the identity
  // meta line above (`displayIdentity`, always shown regardless of this
  // prop — see that line's own doc comment for why), which already reads
  // correctly either way.
  hideCustomerNames,
  // Per explicit request ("move the redial button up directly below the
  // gray box"): the Redial/Takeover-Assignment button used to live in the
  // caller's own `InteriorPanel`'s separate `footer` slot, which pins to
  // the bottom of the panel — leaving a big gap below this component's
  // own content for a channel (voice) with nothing else rendered beneath
  // the gray card. Rendered here instead, immediately after the gray
  // card, so it's always directly below it regardless of panel height.
  // Optional — the OTHER consumer of this component (the "All Contacts"
  // row detail, AgentWorkspaceAdvancedPage.tsx) doesn't pass this and
  // keeps using its own `footer` slot exactly as before.
  actionButton,
}: {
  entry: ContactHistoryEntry;
  hideCustomerNames?: boolean;
  actionButton?: ReactNode;
}) {
  const notesLabel =
    entry.channelType === "voice" ? "Call Notes" : entry.channelType === "email" ? "Email Summary" : "Chat Summary";
  const displayIdentity = contactHistoryDisplayIdentity(entry);
  // Same "chat keeps the real name, everything else shows the reach-back
  // address instead" swap `contactHistoryDisplayIdentity` already makes
  // for `displayIdentity` above — reused here (not recomputed) since it's
  // the exact same value for a non-chat entry; only chat differs (`entry.
  // name`, unmasked, vs. `displayIdentity`, which is ALSO `entry.name` for
  // chat — so this only ever changes anything for a non-chat entry).
  const transcriptCustomerName = hideCustomerNames ? displayIdentity : entry.name;
  const isVoice = entry.channelType === "voice";
  const isMessageChannel =
    (isVoice && SHOW_VOICE_TRANSCRIPT_IN_CONTACT_HISTORY) ||
    entry.channelType === "chat" ||
    entry.channelType === "sms" ||
    entry.channelType === "whatsapp";
  // Per explicit bug report, with a screenshot of a Marcus Webb Contact
  // History row's own detail panel showing generic wrap-up chatter that
  // never actually happened in his real chat: "contact history of Marcus
  // Webb should reflect the actual conversation in the right conversation
  // area of the interior panel." `entry.messages` (see that field's own doc
  // comment) is the row's real transcript, when one exists — preferred over
  // this component's own synthesized `buildContactHistoryMessages` fallback,
  // which stays exactly as it was for every row with no real transcript
  // behind it (every hand-authored/`CREATE_NEW_CUSTOMERS`-backed row, and
  // any dismissed row whose primary channel just never had real messages —
  // e.g. voice).
  const messages = entry.messages ?? buildContactHistoryMessages(entry);
  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Per explicit follow-up request ("add the channel chip to the
          right of the Resolved | Name | Time row in the contact history
          panels") — the exact same channel-type `Tag` pill the list row
          above already renders (`CONTACT_HISTORY_CHANNEL_TAG_VARIANT`/
          `CONTACT_HISTORY_CHANNEL_ICON`, this file's own top-of-file
          constants — see that row's own doc comment), just placed here
          on this summary line instead of stacked in its own trailing
          column, since this line has no row layout of its own to stack
          against. */}
      <div className="flex items-center justify-between gap-2">
        <span className="lyra-body-sm text-lyra-fg-secondary">
          {/* Per explicit request ("hide resolved as there is no status
              for a voice call") — voice has no real status concept, only
              a disposition (shown in the gray card below instead). */}
          {[isVoice ? null : entry.statusLabel, displayIdentity, entry.timeAgo].filter(Boolean).join(" · ")}
        </span>
        <Tooltip content={contactHistoryChannelTooltipLabel(entry)} placement="top">
          <Tag
            label={entry.channelLabel}
            variant={CONTACT_HISTORY_CHANNEL_TAG_VARIANT[entry.channelType]}
            shape="pill"
            icon={contactHistoryChannelIcon(entry)}
          />
        </Tooltip>
      </div>
      <div className="rounded-lyra-md border border-lyra-border-subtle bg-lyra-bg-control-subtle overflow-hidden flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-1 min-w-0">
          <Label label="Duration" />
          <span className="lyra-body-md text-lyra-fg-default break-words">{entry.duration}</span>
        </div>
        {/* Per explicit request ("add disposition to the gray box ...
            below Duration") — only shown when the agent actually logged
            one via the Outcome popover before dismissing (see
            `ContactHistoryEntry.dispositionLabel`'s own doc comment). */}
        {entry.dispositionLabel && (
          <div className="flex flex-col gap-1 min-w-0">
            <Label label="Disposition" />
            <span className="lyra-body-md text-lyra-fg-default break-words">{entry.dispositionLabel}</span>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <Label label={notesLabel} />
          <p className="lyra-body-md text-lyra-fg-default">{entry.description}</p>
        </div>
        {/* Per explicit request ("add tags below call notes in the gray
            box") — same conditional-on-populated treatment as Disposition
            above. */}
        {entry.tags && entry.tags.length > 0 && (
          <div className="flex flex-col gap-1">
            <Label label="Tags" />
            <div className="flex flex-wrap gap-1.5">
              {entry.tags.map((tag) => (
                <Tag key={tag} label={tag} shape="pill" />
              ))}
            </div>
          </div>
        )}
      </div>
      {actionButton}
      {isMessageChannel ? (
        <div className="flex flex-col gap-2">
          <Label label={isVoice ? "Transcript" : "Conversation"} />
          <div className="rounded-lyra-md border border-lyra-border-subtle flex flex-col gap-4 p-4">
            {messages.map((message, i) =>
              isVoice ? (
                <ContactHistoryTranscriptLine key={i} message={message} customerName={transcriptCustomerName} />
              ) : (
                <ContactHistoryMessageBubble key={i} message={message} customerName={transcriptCustomerName} agentName={CURRENT_AGENT_NAME} />
              )
            )}
          </div>
        </div>
      ) : entry.channelType === "email" ? (
        <div className="rounded-lyra-md border border-lyra-border-subtle bg-lyra-bg-control-subtle overflow-hidden flex flex-col gap-1 p-4">
          <Label label="Body" />
          {/* `entry.emailBody` (see that field's own doc comment) preferred
              over the generic synthesized paragraph — same "real content
              when hand-authored, generic filler otherwise" preference
              `messages`/`buildContactHistoryMessages` already establish just
              above for every other channel type. */}
          <p className="lyra-body-md text-lyra-fg-default">{entry.emailBody ?? buildContactHistoryEmailBody(entry)}</p>
        </div>
      ) : null}
    </div>
  );
}
